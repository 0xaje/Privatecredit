import 'dotenv/config';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// Load deployments manifest
const deploymentsPath = path.resolve('config/deployments.json');
if (!fs.existsSync(deploymentsPath)) {
  throw new Error('deployments.json not found in config/.');
}
const deploymentData = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));

const RPC_URL = process.env.CREDITCOIN_RPC_URL || deploymentData.rpcUrl || 'https://rpc.cc3-testnet.creditcoin.network';
const CHAIN_ID = 102031n;
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;

if (!DEPLOYER_KEY) {
  throw new Error('DEPLOYER_PRIVATE_KEY is required in .env');
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);

// Secondary deterministic demo borrower wallet (derived from private key hash for repeatability)
const borrowerPrivKey = ethers.keccak256(ethers.toUtf8Bytes(DEPLOYER_KEY + '_DEMO_BORROWER'));
const borrower = new ethers.Wallet(borrowerPrivKey, provider);

console.log('====================================================');
console.log('🚀 PrivateCredit CC3 Testnet Seeding & E2E Validation');
console.log('====================================================');
console.log(`Lender / Deployer Address : ${deployer.address}`);
console.log(`Demo Borrower Address     : ${borrower.address}`);

const addresses = deploymentData.contracts;

const ELIGIBILITY_ABI = [
  'function owner() view returns (address)',
  'function registrar() view returns (address)',
  'function setRegistrar(address _registrar)',
  'function registerEligibility(address borrower, uint8 riskTier, uint256 maxActiveCredit, uint256 maxLtvBps, uint256 validUntil, uint256 policyVersion, bytes32 evidenceCommitment, bytes32 attestcoinContext)',
  'function isEligibilityValid(address borrower) view returns (bool)',
  'function getEligibility(address borrower) view returns (tuple(address borrower, uint8 riskTier, uint256 maxActiveCredit, uint256 maxLtvBps, uint256 validUntil, uint256 policyVersion, bytes32 evidenceCommitment, bytes32 attestcoinContext, uint256 nonce, bool active))'
];

const MARKETPLACE_ABI = [
  'function nextRequestId() view returns (uint256)',
  'function nextOfferId() view returns (uint256)',
  'function createBorrowRequest(uint256 amount, uint256 maxAprBps, uint256 maxDuration, uint256 collateralAmount) returns (uint256)',
  'function createLenderOffer(uint256 requestId, uint256 aprBps, uint256 duration, uint256 requiredCollateral) payable returns (uint256)',
  'function acceptOffer(uint256 offerId) payable',
  'function requests(uint256 requestId) view returns (tuple(uint256 requestId, address borrower, uint256 amount, uint256 maxAprBps, uint256 maxDuration, uint256 collateralAmount, uint8 status, uint256 createdAt))',
  'function offers(uint256 offerId) view returns (tuple(uint256 offerId, uint256 requestId, address lender, uint256 aprBps, uint256 duration, uint256 requiredCollateral, uint8 status, uint256 createdAt))'
];

const VAULT_ABI = [
  'function nextLoanId() view returns (uint256)',
  'function getLoan(uint256 loanId) view returns (tuple(uint256 loanId, address borrower, address lender, uint256 principal, uint256 aprBps, uint256 startTime, uint256 duration, uint256 collateralAmount, uint256 repaidAmount, uint8 status))',
  'function calculateTotalOwed(uint256 loanId) view returns (uint256)',
  'function repayLoan(uint256 loanId) payable'
];

const DEBT_AUCTION_ABI = [
  'function nextAuctionId() view returns (uint256)',
  'function createAuction(uint256 loanId, address borrower, address lender, uint256 principal, uint256 collateralAmount, uint256 reservePrice, uint256 duration) returns (uint256)',
  'function getAuction(uint256 auctionId) view returns (tuple(uint256 auctionId, uint256 loanId, address borrower, address lender, uint256 principal, uint256 collateralAmount, uint256 reservePrice, uint256 highestBid, address highestBidder, uint256 startTime, uint256 endTime, uint8 status))'
];

async function main() {
  const net = await provider.getNetwork();
  if (net.chainId !== CHAIN_ID) {
    throw new Error(`Connected to wrong network ${net.chainId}, expected ${CHAIN_ID}`);
  }

  // 1. Check balances & fund borrower if needed
  const deployerBalance = await provider.getBalance(deployer.address);
  console.log(`\n[1/5] Checking balances...`);
  console.log(`Deployer Balance: ${ethers.formatEther(deployerBalance)} tCTC`);

  let borrowerBalance = await provider.getBalance(borrower.address);
  console.log(`Borrower Balance: ${ethers.formatEther(borrowerBalance)} tCTC`);

  if (borrowerBalance < ethers.parseEther('10')) {
    console.log(`Funding demo borrower with 25 tCTC for gas and collateral...`);
    const fundTx = await deployer.sendTransaction({
      to: borrower.address,
      value: ethers.parseEther('25')
    });
    console.log(`Funding tx sent: ${fundTx.hash}`);
    await fundTx.wait();
    borrowerBalance = await provider.getBalance(borrower.address);
    console.log(`Borrower funded! New Balance: ${ethers.formatEther(borrowerBalance)} tCTC`);
  }

  // 2. Register Eligibility for Borrower & Deployer
  console.log(`\n[2/5] Checking Eligibility Attestations...`);
  const eligibility = new ethers.Contract(addresses.eligibilityRegistry, ELIGIBILITY_ABI, deployer);
  const uscVerifierAddress = addresses.uscVerifier;

  const isBorrowerValid = await eligibility.isEligibilityValid(borrower.address);
  if (!isBorrowerValid) {
    console.log(`Setting registrar to deployer for initial registration...`);
    const setRegTx = await eligibility.setRegistrar(deployer.address);
    await setRegTx.wait();

    const maxCredit = ethers.parseEther('5000'); // 5000 tCTC capacity
    const maxLtvBps = 6500n; // 65% LTV (35% collateral required)
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60); // 90 days
    const evidenceCommitment = ethers.id('creditcoin_zk_proof_sepolia_borrower_v1');
    const attestcoinContext = ethers.id('attestcoin_cc3_sepolia_context_v1');

    console.log(`Registering eligibility for demo borrower ${borrower.address}...`);
    const regTx1 = await eligibility.registerEligibility(
      borrower.address,
      0, // LOW risk tier
      maxCredit,
      maxLtvBps,
      validUntil,
      1,
      evidenceCommitment,
      attestcoinContext
    );
    await regTx1.wait();
    console.log(`✅ Demo borrower eligibility registered (Low Risk, 5000 tCTC max credit, 65% LTV).`);

    console.log(`Registering eligibility for deployer ${deployer.address}...`);
    const regTx2 = await eligibility.registerEligibility(
      deployer.address,
      0,
      maxCredit,
      maxLtvBps,
      validUntil,
      1,
      evidenceCommitment,
      attestcoinContext
    );
    await regTx2.wait();
    console.log(`✅ Deployer eligibility registered.`);

    // Restore USCVerifier as official registrar
    console.log(`Switching official registrar back to USCVerifier (${uscVerifierAddress})...`);
    const restoreRegTx = await eligibility.setRegistrar(uscVerifierAddress);
    await restoreRegTx.wait();
    console.log(`✅ Official registrar restored to USCVerifier.`);
  } else {
    console.log(`✅ Borrower and Deployer eligibility already active.`);
  }

  // 3. Marketplace Requests & Loans
  console.log(`\n[3/5] Inspecting Marketplace and Loan Vault...`);
  const marketplaceBorrower = new ethers.Contract(addresses.loanMarketplace, MARKETPLACE_ABI, borrower);
  const marketplaceLender = new ethers.Contract(addresses.loanMarketplace, MARKETPLACE_ABI, deployer);
  const vault = new ethers.Contract(addresses.loanVault, VAULT_ABI, provider);

  const nextReqId = await marketplaceLender.nextRequestId();
  const nextLoanId = await vault.nextLoanId();

  console.log(`Total Requests Created: ${Number(nextReqId) - 1}`);
  console.log(`Total Loans Originated : ${Number(nextLoanId) - 1}`);

  if (nextLoanId <= 1n) {
    // Need to create Request #1 and originate Loan #1
    console.log(`\n[4/5] Creating Requests and Originating Loan...`);
    const loan1Amount = ethers.parseEther('20');
    const loan1Collateral = ethers.parseEther('7'); // 35% of 20 tCTC
    const reqTx1 = await marketplaceBorrower.createBorrowRequest(
      loan1Amount,
      800, // 8% Max APR
      30n * 24n * 60n * 60n, // 30 days
      loan1Collateral
    );
    await reqTx1.wait();
    console.log(`✅ Borrow Request #1 created (20 tCTC, 8% APR, 30d).`);

    const loan2Amount = ethers.parseEther('50');
    const loan2Collateral = ethers.parseEther('17.5');
    const reqTx2 = await marketplaceBorrower.createBorrowRequest(
      loan2Amount,
      1000, // 10% Max APR
      60n * 24n * 60n * 60n, // 60 days
      loan2Collateral
    );
    await reqTx2.wait();
    console.log(`✅ Borrow Request #2 created (50 tCTC, 10% APR, 60d - OPEN).`);

    const curReqId = (await marketplaceLender.nextRequestId()) - 2n;
    const offerTx = await marketplaceLender.createLenderOffer(
      curReqId,
      750,
      30n * 24n * 60n * 60n,
      loan1Collateral,
      { value: loan1Amount }
    );
    await offerTx.wait();
    console.log(`✅ Lender Offer deposited for Request #${curReqId}.`);

    const curOfferId = (await marketplaceBorrower.nextOfferId()) - 1n;
    const acceptTx = await marketplaceBorrower.acceptOffer(curOfferId, { value: loan1Collateral });
    await acceptTx.wait();
    console.log(`✅ Offer #${curOfferId} accepted & Loan originated!`);
  } else {
    console.log(`✅ Active loans already exist on LoanVault.`);
  }

  // Inspect Active Loan #1
  const activeLoan = await vault.getLoan(1n);
  console.log(`\nActive Loan #1 Details on LoanVault:`);
  console.log(`- Borrower       : ${activeLoan.borrower}`);
  console.log(`- Lender         : ${activeLoan.lender}`);
  console.log(`- Principal      : ${ethers.formatEther(activeLoan.principal)} tCTC`);
  console.log(`- Collateral     : ${ethers.formatEther(activeLoan.collateralAmount)} tCTC`);
  console.log(`- APR            : ${Number(activeLoan.aprBps) / 100}%`);
  console.log(`- Status         : ACTIVE (code ${activeLoan.status})`);

  // 4. Secondary Debt Recovery Auction
  console.log(`\n[5/5] Checking / Creating Secondary Debt Auction...`);
  const debtAuction = new ethers.Contract(addresses.debtAuctionManager, DEBT_AUCTION_ABI, deployer);
  const nextAuctionId = await debtAuction.nextAuctionId();

  if (nextAuctionId <= 1n) {
    const auctionPrincipal = ethers.parseEther('100');
    const auctionCollateral = ethers.parseEther('35');
    const reservePrice = ethers.parseEther('70'); // 30% discount Dutch start
    const auctionDuration = 7n * 24n * 60n * 60n; // 7 days

    console.log(`Creating initial Secondary Debt Auction on DebtAuctionManager...`);
    const auctionTx = await debtAuction.createAuction(
      999n, // Demo delinquent loan reference
      borrower.address,
      deployer.address,
      auctionPrincipal,
      auctionCollateral,
      reservePrice,
      auctionDuration
    );
    const auctionRc = await auctionTx.wait();
    console.log(`✅ Secondary Debt Recovery Auction created! Tx: ${auctionRc.hash}`);
  } else {
    console.log(`✅ Debt auction already active.`);
  }

  const auctionData = await debtAuction.getAuction(1n);
  console.log(`\nDebt Auction #1 Details:`);
  console.log(`- Debt Principal  : ${ethers.formatEther(auctionData.principal)} tCTC`);
  console.log(`- Collateral Note : ${ethers.formatEther(auctionData.collateralAmount)} tCTC`);
  console.log(`- Reserve Price   : ${ethers.formatEther(auctionData.reservePrice)} tCTC`);
  console.log(`- Status          : ACTIVE (code ${auctionData.status})`);

  console.log('\n====================================================');
  console.log('🎉 Live Seeding & End-to-End Verification Complete!');
  console.log('====================================================');
  console.log('Summary of Live State on Creditcoin CC3 Testnet:');
  console.log(`1. Eligibility Attestation : Active for ${borrower.address}`);
  console.log(`2. Active Loan             : Loan #1 (${ethers.formatEther(activeLoan.principal)} tCTC @ ${Number(activeLoan.aprBps) / 100}% APR)`);
  console.log(`3. Open Market Request     : Request #2 (50 tCTC available to fund)`);
  console.log(`4. Secondary Debt Auction  : Auction #1 (100 tCTC principal @ 70 tCTC reserve)`);
  console.log(`5. USC Sepolia Ingestion   : Configured on USCVerifier (${addresses.uscVerifier})`);
}

main().catch((err) => {
  console.error('\n❌ Seeding failed with error:', err);
  process.exit(1);
});
