import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

describe("PrivateCredit Graph Integration Demo", function () {
  async function deployFixture() {
    const [deployer, alice, lender] = await ethers.getSigners();

    // Deploy registries
    const eligibilityRegistry = await ethers.deployContract("EligibilityRegistry");
    const repaymentRegistry = await ethers.deployContract("RepaymentRegistry");
    const artefactRegistry = await ethers.deployContract("ArtefactRegistry");

    // Deploy capacity manager
    const capacityManager = await ethers.deployContract("CapacityManager", [
      await eligibilityRegistry.getAddress(),
    ]);

    // Deploy vault
    const loanVault = await ethers.deployContract("LoanVault", [
      await capacityManager.getAddress(),
    ]);

    // Deploy marketplace
    const loanMarketplace = await ethers.deployContract("LoanMarketplace", [
      await eligibilityRegistry.getAddress(),
      await capacityManager.getAddress(),
      await loanVault.getAddress(),
    ]);

    // Wire up authorization
    await eligibilityRegistry.setRegistrar(deployer.address);
    await capacityManager.setAuthorizedCaller(await loanVault.getAddress(), true);
    await loanVault.setMarketplace(await loanMarketplace.getAddress());
    await loanVault.setRepaymentRegistry(await repaymentRegistry.getAddress());
    await repaymentRegistry.setAuthorizedRecorder(await loanVault.getAddress());

    return {
      eligibilityRegistry,
      capacityManager,
      loanMarketplace,
      loanVault,
      repaymentRegistry,
      artefactRegistry,
      deployer,
      alice,
      lender,
    };
  }

  it("Executes the full demo scenario (Whitepaper §22)", async function () {
    const {
      eligibilityRegistry,
      capacityManager,
      loanMarketplace,
      loanVault,
      repaymentRegistry,
      artefactRegistry,
      deployer,
      alice,
      lender,
    } = await networkHelpers.loadFixture(deployFixture);

    // 1-6: Alice gets officially assessed -> Eligibility is registered
    const LOW_RISK = 0n; // RiskTier.LOW
    const MAX_CREDIT = ethers.parseEther("7500");
    const MAX_LTV_BPS = 6500n; // 65%
    const VALID_UNTIL = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
    const POLICY_VERSION = 1n;
    const EVIDENCE_COMMITMENT = ethers.id("evidence123");
    const ATTESTCOIN_CONTEXT = ethers.id("attestcoinContext123");

    await eligibilityRegistry.registerEligibility(
      alice.address,
      LOW_RISK,
      MAX_CREDIT,
      MAX_LTV_BPS,
      VALID_UNTIL,
      POLICY_VERSION,
      EVIDENCE_COMMITMENT,
      ATTESTCOIN_CONTEXT
    );

    expect(await capacityManager.availableCapacity(alice.address)).to.equal(MAX_CREDIT);

    // 7: Alice requests $5,000
    const LOAN_AMOUNT = ethers.parseEther("5000");
    const MAX_APR = 500n; // 5%
    const DURATION = 30n * 24n * 60n * 60n; // 30 days
    const COLLATERAL = ethers.parseEther("0.1"); // Dummy collateral amount

    const txRequest = await loanMarketplace.connect(alice).createBorrowRequest(
      LOAN_AMOUNT,
      MAX_APR,
      DURATION,
      COLLATERAL
    );
    const rcRequest = await txRequest.wait();
    const requestEvent = rcRequest?.logs.find(e => e.fragment?.name === 'RequestCreated');
    const requestId = requestEvent?.args?.[0] ?? 1n;

    // 8: Lender funds an offer
    const txOffer = await loanMarketplace.connect(lender).createLenderOffer(
      requestId,
      MAX_APR,
      DURATION,
      COLLATERAL,
      { value: LOAN_AMOUNT }
    );
    const rcOffer = await txOffer.wait();
    const offerEvent = rcOffer?.logs.find(e => e.fragment?.name === 'OfferCreated');
    const offerId = offerEvent?.args?.[0] ?? 1n;

    // 9: Alice accepts; $5,000 capacity is consumed and $2,500 remains
    const balanceBefore = await ethers.provider.getBalance(alice.address);
    const txAccept = await loanMarketplace.connect(alice).acceptOffer(offerId, { value: COLLATERAL });
    
    // Check Alice received the principal (minus gas, but we can check roughly)
    const balanceAfter = await ethers.provider.getBalance(alice.address);
    expect(balanceAfter).to.be.greaterThan(balanceBefore);

    const availableAfterLoan = await capacityManager.availableCapacity(alice.address);
    expect(availableAfterLoan).to.equal(ethers.parseEther("2500"));
    expect(await capacityManager.getUsedCapacity(alice.address)).to.equal(ethers.parseEther("5000"));

    // 10: An over-capacity request is deliberately rejected
    const OVER_CAPACITY_AMOUNT = ethers.parseEther("3000");
    await expect(
      loanMarketplace.connect(alice).createBorrowRequest(
        OVER_CAPACITY_AMOUNT,
        MAX_APR,
        DURATION,
        COLLATERAL
      )
    ).to.be.revertedWithCustomError(loanMarketplace, "InsufficientEligibility");

    // 11: Alice repays; capacity is released and a repayment outcome appears
    // Let's mine some blocks/time to generate interest
    await networkHelpers.time.increase(15 * 24 * 60 * 60); // 15 days
    
    const loanId = 1n; // First loan
    const totalOwed = await loanVault.calculateTotalOwed(loanId);
    
    // Add a small buffer for interest that accrues during the transaction block
    const buffer = ethers.parseEther("0.001");
    
    await loanVault.connect(alice).repayLoan(loanId, { value: totalOwed + buffer });
    
    expect(await capacityManager.availableCapacity(alice.address)).to.equal(MAX_CREDIT);
    expect(await capacityManager.getUsedCapacity(alice.address)).to.equal(0n);
    
    const repayments = await repaymentRegistry.getBorrowerRepayments(alice.address);
    expect(repayments.length).to.equal(1);
    const record = await repaymentRegistry.getRepayment(repayments[0]);
    expect(record.outcome).to.equal(0n); // RepaymentOutcome.ON_TIME

    // 12: The final decision view is committed through ArtefactRegistry
    const snapshotCommitment = ethers.id("final_snapshot");
    await artefactRegistry.connect(alice).commitArtefact(
      snapshotCommitment,
      1n, // nonce
      ethers.id("policy_v1"),
      "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
    );

    const artefacts = await artefactRegistry.getArtefactsByCreator(alice.address);
    expect(artefacts.length).to.equal(1);
    const isVerified = await artefactRegistry.verifyArtefact(artefacts[0], snapshotCommitment);
    expect(isVerified).to.be.true;
  });
});
