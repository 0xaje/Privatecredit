import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

// The native Creditcoin BlockProver precompile. It does not exist on the local Hardhat
// EVM, so tests install a mock at this address with `setCode`.
const PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000FD2";

const TRANSFER_EVENT_SIGNATURE = ethers.id("Transfer(address,address,uint256)");

const SOURCE_CHAIN_ID = 11155111n; // Ethereum Sepolia
const SOURCE_CHAIN_KEY = 1n;
const BLOCK_HEIGHT = 8_000_000n;

const EVIDENCE_INFLOW = 0;
const EVIDENCE_REPAYMENT = 1;

const RISK_TIER_LOW = 0;

function topicFor(address: string): string {
  return ethers.zeroPadValue(address, 32);
}

/**
 * Builds the `bytes[]`-chunked transaction encoding that EvmV1Decoder expects.
 *
 * Layout is abi.encode(uint8 txType, bytes[] chunks) where, for tx types 0-2:
 *   chunks[0] = common tx fields
 *   chunks[1] = type-specific fields (unread by USCVerifier)
 *   chunks[2] = receipt fields
 */
function encodeTransaction(options: {
  from: string;
  to: string;
  logs: { token: string; from: string; to: string; value: bigint }[];
  receiptStatus?: number;
  nonce?: bigint;
}): string {
  const coder = ethers.AbiCoder.defaultAbiCoder();

  const commonChunk = coder.encode(
    ["uint64", "uint64", "address", "bool", "address", "uint256", "bytes"],
    [options.nonce ?? 7n, 120_000n, options.from, false, options.to, 0n, "0x"]
  );

  // Type 2 (EIP-1559) specific fields. USCVerifier never decodes this chunk, but the
  // decoder requires exactly three chunks to be present for tx types 0-2.
  const typeSpecificChunk = coder.encode(
    ["uint64", "uint128", "uint128", "tuple(address,bytes32[])[]", "uint8", "bytes32", "bytes32"],
    [SOURCE_CHAIN_ID, 1_000_000_000n, 2_000_000_000n, [], 0, ethers.ZeroHash, ethers.ZeroHash]
  );

  const logs = options.logs.map((log) => [
    log.token,
    [TRANSFER_EVENT_SIGNATURE, topicFor(log.from), topicFor(log.to)],
    coder.encode(["uint256"], [log.value]),
  ]);

  const receiptChunk = coder.encode(
    ["uint8", "uint64", "tuple(address,bytes32[],bytes)[]", "bytes"],
    [options.receiptStatus ?? 1, 90_000n, logs, "0x"]
  );

  return coder.encode(
    ["uint8", "bytes[]"],
    [2, [commonChunk, typeSpecificChunk, receiptChunk]]
  );
}

describe("USCVerifier", function () {
  async function deployFixture() {
    const [deployer, borrower, payer] = await ethers.getSigners();

    // Source-chain ERC20 whose Transfer events count as credit evidence. Only the address
    // matters, since evidence is proved from the encoded receipt rather than read on-chain.
    const sourceToken = ethers.getAddress("0x1c7d4b196cb0c7b01d743fbc6116a902379c7238");

    const eligibilityRegistry = await ethers.deployContract("EligibilityRegistry");
    const evmV1Decoder = await ethers.deployContract("EvmV1Decoder");
    const uscVerifier = await ethers.deployContract(
      "USCVerifier",
      [await eligibilityRegistry.getAddress()],
      { libraries: { EvmV1Decoder: await evmV1Decoder.getAddress() } }
    );

    // USCVerifier is the only contract permitted to write eligibility badges.
    await eligibilityRegistry.setRegistrar(await uscVerifier.getAddress());

    await uscVerifier.setSourceChainKey(SOURCE_CHAIN_KEY);
    await uscVerifier.setSourceToken(SOURCE_CHAIN_ID, sourceToken);

    // Install the accepting precompile double at 0x0FD2 by default.
    const accepting = await ethers.deployContract("MockAcceptingVerifier");
    await networkHelpers.setCode(
      PRECOMPILE_ADDRESS,
      await ethers.provider.getCode(await accepting.getAddress())
    );

    return { eligibilityRegistry, uscVerifier, sourceToken, deployer, borrower, payer };
  }

  async function installRejectingPrecompile() {
    const rejecting = await ethers.deployContract("MockRejectingVerifier");
    await networkHelpers.setCode(
      PRECOMPILE_ADDRESS,
      await ethers.provider.getCode(await rejecting.getAddress())
    );
  }

  function inflowProof(sourceToken: string, borrower: string, payer: string, value = ethers.parseUnits("2500", 6)) {
    return encodeTransaction({
      from: payer,
      to: sourceToken,
      logs: [{ token: sourceToken, from: payer, to: borrower, value }],
    });
  }

  // Fixed proof envelope. The mock precompile ignores these, but they participate in the
  // queryId preimage, so tests vary them deliberately rather than by accident.
  const merkleRoot = ethers.id("merkle-root");
  const siblings: { hash: string; isLeft: boolean }[] = [];
  const lowerEndpointDigest = ethers.id("lower-endpoint");
  const continuityRoots: string[] = [];

  function verifyArgs(evidenceType: number, borrower: string, encodedTransaction: string, blockHeight = BLOCK_HEIGHT) {
    return [
      evidenceType,
      borrower,
      SOURCE_CHAIN_KEY,
      blockHeight,
      encodedTransaction,
      merkleRoot,
      siblings,
      lowerEndpointDigest,
      continuityRoots,
    ] as const;
  }

  describe("verifyEvidence", function () {
    it("records a verified cross-chain inflow with the decoded Transfer semantics", async function () {
      const { uscVerifier, sourceToken, borrower, payer } = await networkHelpers.loadFixture(deployFixture);
      const amount = ethers.parseUnits("2500", 6);
      const encodedTransaction = inflowProof(sourceToken, borrower.address, payer.address, amount);
      const args = verifyArgs(EVIDENCE_INFLOW, borrower.address, encodedTransaction);

      const [evidenceId, returnedAmount, transactionHash] = await uscVerifier.verifyEvidence.staticCall(...args);

      // The verifier must report the amount it decoded from the receipt, not a caller-supplied value.
      expect(returnedAmount).to.equal(amount);
      expect(transactionHash).to.equal(ethers.keccak256(encodedTransaction));

      await expect(uscVerifier.verifyEvidence(...args)).to.emit(uscVerifier, "EvidenceVerified");

      const stored = await uscVerifier.verifiedEvidence(evidenceId);
      expect(stored.borrower).to.equal(borrower.address);
      expect(stored.evidenceType).to.equal(EVIDENCE_INFLOW);
      expect(stored.amount).to.equal(amount);
      expect(stored.sender).to.equal(payer.address);
      expect(stored.blockHeight).to.equal(BLOCK_HEIGHT);
      expect(stored.active).to.equal(true);
      expect(await uscVerifier.borrowerEvidenceNonces(borrower.address)).to.equal(1n);
    });

    it("rejects evidence when the 0x0FD2 precompile fails the proof", async function () {
      const { uscVerifier, sourceToken, borrower, payer } = await networkHelpers.loadFixture(deployFixture);
      await installRejectingPrecompile();

      const encodedTransaction = inflowProof(sourceToken, borrower.address, payer.address);

      await expect(
        uscVerifier.verifyEvidence(...verifyArgs(EVIDENCE_INFLOW, borrower.address, encodedTransaction))
      ).to.be.revertedWithCustomError(uscVerifier, "InvalidProof");

      expect(await uscVerifier.borrowerEvidenceNonces(borrower.address)).to.equal(0n);
    });

    it("rejects a replayed proof via the queryId guard", async function () {
      const { uscVerifier, sourceToken, borrower, payer } = await networkHelpers.loadFixture(deployFixture);
      const encodedTransaction = inflowProof(sourceToken, borrower.address, payer.address);
      const args = verifyArgs(EVIDENCE_INFLOW, borrower.address, encodedTransaction);

      await uscVerifier.verifyEvidence(...args);

      await expect(uscVerifier.verifyEvidence(...args)).to.be.revertedWithCustomError(
        uscVerifier,
        "QueryAlreadyProcessed"
      );
    });

    it("rejects the same transaction re-proved at a different block height", async function () {
      const { uscVerifier, sourceToken, borrower, payer } = await networkHelpers.loadFixture(deployFixture);
      const encodedTransaction = inflowProof(sourceToken, borrower.address, payer.address);

      await uscVerifier.verifyEvidence(...verifyArgs(EVIDENCE_INFLOW, borrower.address, encodedTransaction));

      // A different block height yields a fresh queryId, so only the separate evidenceId
      // guard can stop the same underlying transaction being counted twice.
      await expect(
        uscVerifier.verifyEvidence(
          ...verifyArgs(EVIDENCE_INFLOW, borrower.address, encodedTransaction, BLOCK_HEIGHT + 1n)
        )
      ).to.be.revertedWithCustomError(uscVerifier, "EvidenceAlreadyProcessed");

      expect(await uscVerifier.borrowerEvidenceNonces(borrower.address)).to.equal(1n);
    });

    it("rejects a receipt whose transaction reverted on the source chain", async function () {
      const { uscVerifier, sourceToken, borrower, payer } = await networkHelpers.loadFixture(deployFixture);
      const encodedTransaction = encodeTransaction({
        from: payer.address,
        to: sourceToken,
        logs: [{ token: sourceToken, from: payer.address, to: borrower.address, value: 1_000n }],
        receiptStatus: 0,
      });

      await expect(
        uscVerifier.verifyEvidence(...verifyArgs(EVIDENCE_INFLOW, borrower.address, encodedTransaction))
      ).to.be.revertedWithCustomError(uscVerifier, "InvalidTransaction");
    });

    it("ignores Transfer logs emitted by an unconfigured token", async function () {
      const { uscVerifier, borrower, payer } = await networkHelpers.loadFixture(deployFixture);
      const unknownToken = ethers.getAddress("0x000000000000000000000000000000000000dead");
      const encodedTransaction = encodeTransaction({
        from: payer.address,
        to: unknownToken,
        logs: [{ token: unknownToken, from: payer.address, to: borrower.address, value: 5_000n }],
      });

      await expect(
        uscVerifier.verifyEvidence(...verifyArgs(EVIDENCE_INFLOW, borrower.address, encodedTransaction))
      ).to.be.revertedWithCustomError(uscVerifier, "InvalidTransaction");
    });

    it("rejects an inflow credited to somebody other than the borrower", async function () {
      const { uscVerifier, sourceToken, borrower, payer, deployer } = await networkHelpers.loadFixture(deployFixture);
      // A real transfer, but the value landed on a third party.
      const encodedTransaction = encodeTransaction({
        from: payer.address,
        to: sourceToken,
        logs: [{ token: sourceToken, from: payer.address, to: deployer.address, value: 9_000n }],
      });

      await expect(
        uscVerifier.verifyEvidence(...verifyArgs(EVIDENCE_INFLOW, borrower.address, encodedTransaction))
      ).to.be.revertedWithCustomError(uscVerifier, "InvalidTransaction");
    });

    it("rejects evidence from an unsupported source chain", async function () {
      const { uscVerifier, sourceToken, borrower, payer } = await networkHelpers.loadFixture(deployFixture);
      const encodedTransaction = inflowProof(sourceToken, borrower.address, payer.address);

      await expect(
        uscVerifier.verifyEvidence(
          EVIDENCE_INFLOW,
          borrower.address,
          999n, // never configured
          BLOCK_HEIGHT,
          encodedTransaction,
          merkleRoot,
          siblings,
          lowerEndpointDigest,
          continuityRoots
        )
      ).to.be.revertedWithCustomError(uscVerifier, "UnsupportedSourceChain");
    });
  });

  describe("registerEligibilityFromEvidence", function () {
    async function verifiedInflowFixture() {
      const context = await networkHelpers.loadFixture(deployFixture);
      const { uscVerifier, sourceToken, borrower, payer } = context;

      const encodedTransaction = inflowProof(sourceToken, borrower.address, payer.address);
      const args = verifyArgs(EVIDENCE_INFLOW, borrower.address, encodedTransaction);
      const [evidenceId] = await uscVerifier.verifyEvidence.staticCall(...args);
      await uscVerifier.verifyEvidence(...args);

      return { ...context, evidenceId };
    }

    async function validUntil() {
      const latest = await networkHelpers.time.latest();
      return BigInt(latest) + 30n * 24n * 60n * 60n;
    }

    it("writes an eligibility badge committing the verified evidence", async function () {
      const { uscVerifier, eligibilityRegistry, borrower, evidenceId } = await verifiedInflowFixture();

      await expect(
        uscVerifier.registerEligibilityFromEvidence(
          borrower.address,
          RISK_TIER_LOW,
          ethers.parseEther("10000"),
          6500,
          await validUntil(),
          [evidenceId]
        )
      ).to.emit(uscVerifier, "EligibilityRegisteredFromEvidence");

      expect(await eligibilityRegistry.getEligibilityNonce(borrower.address)).to.equal(1n);
      expect(await uscVerifier.evidenceUsedForEligibility(evidenceId)).to.equal(true);
    });

    it("refuses to spend the same evidence for a second badge", async function () {
      const { uscVerifier, borrower, evidenceId } = await verifiedInflowFixture();
      const deadline = await validUntil();

      await uscVerifier.registerEligibilityFromEvidence(
        borrower.address,
        RISK_TIER_LOW,
        ethers.parseEther("10000"),
        6500,
        deadline,
        [evidenceId]
      );

      await expect(
        uscVerifier.registerEligibilityFromEvidence(
          borrower.address,
          RISK_TIER_LOW,
          ethers.parseEther("10000"),
          6500,
          deadline,
          [evidenceId]
        )
      ).to.be.revertedWithCustomError(uscVerifier, "EvidenceAlreadyUsed");
    });

    it("refuses evidence belonging to a different borrower", async function () {
      const { uscVerifier, deployer, evidenceId } = await verifiedInflowFixture();

      await expect(
        uscVerifier.registerEligibilityFromEvidence(
          deployer.address,
          RISK_TIER_LOW,
          ethers.parseEther("10000"),
          6500,
          await validUntil(),
          [evidenceId]
        )
      ).to.be.revertedWithCustomError(uscVerifier, "EligibilityRejected");
    });

    it("refuses a duplicated evidenceId inside a single batch", async function () {
      const { uscVerifier, borrower, evidenceId } = await verifiedInflowFixture();

      // The ascending-order requirement is what makes in-batch duplicates unrepresentable.
      await expect(
        uscVerifier.registerEligibilityFromEvidence(
          borrower.address,
          RISK_TIER_LOW,
          ethers.parseEther("10000"),
          6500,
          await validUntil(),
          [evidenceId, evidenceId]
        )
      ).to.be.revertedWithCustomError(uscVerifier, "EligibilityRejected");
    });

    it("refuses an empty evidence set", async function () {
      const { uscVerifier, borrower } = await verifiedInflowFixture();

      await expect(
        uscVerifier.registerEligibilityFromEvidence(
          borrower.address,
          RISK_TIER_LOW,
          ethers.parseEther("10000"),
          6500,
          await validUntil(),
          []
        )
      ).to.be.revertedWithCustomError(uscVerifier, "EligibilityRejected");
    });
  });
});
