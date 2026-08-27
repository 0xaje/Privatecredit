import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

describe("PrivateCredit Graph Integration", function () {
  async function deployFixture() {
    const [deployer, alice, lender] = await ethers.getSigners();
    const eligibilityRegistry = await ethers.deployContract("EligibilityRegistry");
    const repaymentRegistry = await ethers.deployContract("RepaymentRegistry");
    const artefactRegistry = await ethers.deployContract("ArtefactRegistry", [await eligibilityRegistry.getAddress()]);
    const capacityManager = await ethers.deployContract("CapacityManager", [await eligibilityRegistry.getAddress()]);
    const loanVault = await ethers.deployContract("LoanVault", [await capacityManager.getAddress()]);
    const loanMarketplace = await ethers.deployContract("LoanMarketplace", [
      await eligibilityRegistry.getAddress(),
      await capacityManager.getAddress(),
      await loanVault.getAddress(),
    ]);
    const evmV1Decoder = await ethers.deployContract("EvmV1Decoder");
    const uscVerifier = await ethers.deployContract("USCVerifier", [await eligibilityRegistry.getAddress()], {
      libraries: { EvmV1Decoder: await evmV1Decoder.getAddress() },
    });

    await capacityManager.setAuthorizedCaller(await loanVault.getAddress(), true);
    await loanVault.setMarketplace(await loanMarketplace.getAddress());
    await loanVault.setRepaymentRegistry(await repaymentRegistry.getAddress());
    await repaymentRegistry.setAuthorizedRecorder(await loanVault.getAddress());
    await eligibilityRegistry.setRegistrar(deployer.address);

    return { eligibilityRegistry, repaymentRegistry, artefactRegistry, capacityManager, loanVault, loanMarketplace, uscVerifier, deployer, alice, lender };
  }

  it("executes the protected request, funded offer, exact repayment, and artefact flow", async function () {
    const { eligibilityRegistry, repaymentRegistry, artefactRegistry, capacityManager, loanMarketplace, loanVault, uscVerifier, deployer, alice, lender } = await networkHelpers.loadFixture(deployFixture);
    const maxCredit = ethers.parseEther("7500");
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);

    await eligibilityRegistry.registerEligibility(alice.address, 0, maxCredit, 6500, validUntil, 1, ethers.id("evidence"), ethers.id("context"));
    await eligibilityRegistry.setRegistrar(await uscVerifier.getAddress());
    expect(await capacityManager.availableCapacity(alice.address)).to.equal(maxCredit);

    const loanAmount = ethers.parseEther("5000");
    const collateral = ethers.parseEther("3250");
    const txRequest = await loanMarketplace.connect(alice).createBorrowRequest(loanAmount, 500, 30n * 24n * 60n * 60n, collateral);
    const requestReceipt = await txRequest.wait();
    const requestEvent = requestReceipt?.logs.find((log: any) => log.fragment?.name === "RequestCreated");
    const requestId = requestEvent?.args?.[0] ?? 1n;

    const txOffer = await loanMarketplace.connect(lender).createLenderOffer(requestId, 400, 30n * 24n * 60n * 60n, collateral, { value: loanAmount });
    const offerReceipt = await txOffer.wait();
    const offerEvent = offerReceipt?.logs.find((log: any) => log.fragment?.name === "OfferCreated");
    const offerId = offerEvent?.args?.[0] ?? 1n;

    await loanMarketplace.connect(alice).acceptOffer(offerId, { value: collateral });
    expect(await capacityManager.availableCapacity(alice.address)).to.equal(ethers.parseEther("2500"));
    expect(await capacityManager.getUsedCapacity(alice.address)).to.equal(loanAmount);

    await expect(loanMarketplace.connect(alice).createBorrowRequest(ethers.parseEther("3000"), 500, 30n * 24n * 60n * 60n, collateral)).to.be.revertedWithCustomError(loanMarketplace, "InsufficientEligibility");

    await networkHelpers.time.increase(15 * 24 * 60 * 60);
    const totalOwed = await loanVault.calculateTotalOwed(1n);
    await loanVault.connect(alice).repayLoan(1n, { value: totalOwed + ethers.parseEther("1") });
    expect(await capacityManager.availableCapacity(alice.address)).to.equal(maxCredit);
    expect(await capacityManager.getUsedCapacity(alice.address)).to.equal(0n);
    expect((await repaymentRegistry.getBorrowerRepayments(alice.address)).length).to.equal(1);

    const snapshotCommitment = ethers.id("final_snapshot");
    await artefactRegistry.connect(alice).commitArtefact(snapshotCommitment, 1n, ethers.id("policy_v1"), "content://privatecredit/snapshot/1");
    const artefacts = await artefactRegistry.getArtefactsByCreator(alice.address);
    expect(artefacts.length).to.equal(1);
    expect(await artefactRegistry.verifyArtefact(artefacts[0], snapshotCommitment)).to.equal(true);
    expect(await eligibilityRegistry.registrar()).to.equal(await uscVerifier.getAddress());
    expect(await deployer.getAddress()).to.equal(deployer.address);
  });

  it("handles defaulted debt liquidation and secondary auction recovery", async function () {
    const [deployer, borrower, lender, liquidator] = await ethers.getSigners();
    const capacityManager = await ethers.deployContract("CapacityManager", [deployer.address]);
    const loanVault = await ethers.deployContract("LoanVault", [await capacityManager.getAddress()]);
    const debtAuction = await ethers.deployContract("DebtAuctionManager", [await loanVault.getAddress()]);
    await loanVault.setDebtAuctionManager(await debtAuction.getAddress());

    const principal = ethers.parseEther("1000");
    const collateral = ethers.parseEther("200");
    const reservePrice = ethers.parseEther("800");
    const duration = 3600n; // 1 hour

    // Create debt auction
    const tx = await debtAuction.createAuction(
      1n,
      borrower.address,
      lender.address,
      principal,
      collateral,
      reservePrice,
      duration
    );
    await tx.wait();

    const auction = await debtAuction.getAuction(1n);
    expect(auction.status).to.equal(1); // ACTIVE
    expect(auction.principal).to.equal(principal);

    // Liquidator places winning bid
    const bidAmount = ethers.parseEther("850");
    await debtAuction.connect(liquidator).placeBid(1n, { value: bidAmount });
    const updatedAuction = await debtAuction.getAuction(1n);
    expect(updatedAuction.highestBidder).to.equal(liquidator.address);
    expect(updatedAuction.highestBid).to.equal(bidAmount);

    // Settle auction after expiration
    await networkHelpers.time.increase(3601);
    const initialLenderBalance = await ethers.provider.getBalance(lender.address);
    await debtAuction.settleAuction(1n);

    const finalLenderBalance = await ethers.provider.getBalance(lender.address);
    expect(finalLenderBalance - initialLenderBalance).to.equal(bidAmount);
    expect((await debtAuction.getAuction(1n)).status).to.equal(2); // SETTLED
  });
});
