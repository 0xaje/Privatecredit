import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { config } from '../config';

export const loansRouter = Router();
const provider = new ethers.JsonRpcProvider(config.rpcUrl);

const MARKETPLACE_ABI = [
  'function createBorrowRequest(uint256 amount, uint256 maxAprBps, uint256 maxDuration, uint256 collateralAmount) external returns (uint256)',
  'function createLenderOffer(uint256 requestId, uint256 aprBps, uint256 duration, uint256 requiredCollateral) external payable returns (uint256)',
  'function acceptOffer(uint256 offerId) external payable',
  'function nextRequestId() external view returns (uint256)',
  'function requests(uint256 requestId) external view returns (tuple(uint256 requestId,address borrower,uint256 amount,uint256 maxAprBps,uint256 maxDuration,uint256 collateralAmount,uint8 status,uint256 createdAt))',
  'event RequestCreated(uint256 indexed requestId, address indexed borrower, uint256 amount)',
  'event OfferCreated(uint256 indexed offerId, uint256 indexed requestId, address indexed lender)',
  'event OfferAccepted(uint256 indexed offerId, uint256 indexed requestId)',
];

const VAULT_ABI = [
  'function repayLoan(uint256 loanId) external payable',
  'function calculateTotalOwed(uint256 loanId) public view returns (uint256)',
  'function getLoan(uint256 loanId) external view returns (tuple(uint256 loanId,address borrower,address lender,uint256 principal,uint256 aprBps,uint256 startTime,uint256 duration,uint256 collateralAmount,uint256 repaidAmount,uint8 status))',
  'event LoanOriginated(uint256 indexed loanId,address indexed borrower,address indexed lender,uint256 principal)',
  'event LoanRepaid(uint256 indexed loanId,uint256 amount)',
];

const CAPACITY_MANAGER_ABI = [
  'function availableCapacity(address borrower) external view returns (uint256)',
  'function getUsedCapacity(address borrower) external view returns (uint256)',
  'function getDefaultedLockedCapacity(address borrower) external view returns (uint256)',
  'function getTotalConsumedCapacity(address borrower) external view returns (uint256)',
];

const marketplaceInterface = new ethers.Interface(MARKETPLACE_ABI);
const vaultInterface = new ethers.Interface(VAULT_ABI);

function requireAddress(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ethers.isAddress(value)) {
    throw new Error(`${field} must be a valid wallet address`);
  }
  return ethers.getAddress(value);
}

function requireUint(value: unknown, field: string): string {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error(`${field} is required`);
  }
  const parsed = BigInt(value);
  if (parsed < 0n) throw new Error(`${field} must be non-negative`);
  return parsed.toString();
}

function preparedTransaction(to: string, data: string, value = '0') {
  return { chainId: config.chainId, to, data, value };
}

loansRouter.post('/prepare/borrow-request', (req: Request, res: Response) => {
  try {
    requireAddress(req.body.from, 'from');
    const amount = requireUint(req.body.amount, 'amount');
    const maxAprBps = requireUint(req.body.maxAprBps, 'maxAprBps');
    const maxDuration = requireUint(req.body.maxDuration, 'maxDuration');
    const collateralAmount = requireUint(req.body.collateralAmount, 'collateralAmount');
    const data = marketplaceInterface.encodeFunctionData('createBorrowRequest', [
      amount,
      maxAprBps,
      maxDuration,
      collateralAmount,
    ]);
    res.json({ success: true, transaction: preparedTransaction(config.addresses.loanMarketplace, data) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

loansRouter.post('/prepare/offer', (req: Request, res: Response) => {
  try {
    requireAddress(req.body.from, 'from');
    const requestId = requireUint(req.body.requestId, 'requestId');
    const aprBps = requireUint(req.body.aprBps, 'aprBps');
    const duration = requireUint(req.body.duration, 'duration');
    const requiredCollateral = requireUint(req.body.requiredCollateral, 'requiredCollateral');
    const principal = requireUint(req.body.principal, 'principal');
    const data = marketplaceInterface.encodeFunctionData('createLenderOffer', [
      requestId,
      aprBps,
      duration,
      requiredCollateral,
    ]);
    res.json({ success: true, transaction: preparedTransaction(config.addresses.loanMarketplace, data, principal) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

loansRouter.post('/prepare/accept-offer', (req: Request, res: Response) => {
  try {
    requireAddress(req.body.from, 'from');
    const offerId = requireUint(req.body.offerId, 'offerId');
    const collateralAmount = requireUint(req.body.collateralAmount, 'collateralAmount');
    const data = marketplaceInterface.encodeFunctionData('acceptOffer', [offerId]);
    res.json({ success: true, transaction: preparedTransaction(config.addresses.loanMarketplace, data, collateralAmount) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

loansRouter.post('/prepare/repay', (req: Request, res: Response) => {
  try {
    requireAddress(req.body.from, 'from');
    const loanId = requireUint(req.body.loanId, 'loanId');
    const repaymentAmount = requireUint(req.body.repaymentAmount, 'repaymentAmount');
    const data = vaultInterface.encodeFunctionData('repayLoan', [loanId]);
    res.json({ success: true, transaction: preparedTransaction(config.addresses.loanVault, data, repaymentAmount) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

loansRouter.get('/requests/open', async (_req: Request, res: Response) => {
  try {
    const contract = new ethers.Contract(config.addresses.loanMarketplace, MARKETPLACE_ABI, provider);
    const nextReqId = await contract.nextRequestId();
    const count = Number(nextReqId);
    const openRequests = [];
    for (let i = 1; i < count; i++) {
      const req = await contract.requests(i);
      if (Number(req.status) === 0) { // 0 = OPEN
        openRequests.push({
          requestId: req.requestId.toString(),
          borrower: req.borrower,
          amount: req.amount.toString(),
          maxAprBps: req.maxAprBps.toString(),
          maxDuration: req.maxDuration.toString(),
          collateralAmount: req.collateralAmount.toString(),
          status: Number(req.status),
          createdAt: req.createdAt.toString(),
        });
      }
    }
    res.json({ success: true, requests: openRequests });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

loansRouter.get('/total-owed/:loanId', async (req: Request, res: Response) => {
  try {
    const loanId = Number(requireUint(req.params.loanId, 'loanId'));
    const contract = new ethers.Contract(config.addresses.loanVault, VAULT_ABI, provider);
    const totalOwed = await contract.calculateTotalOwed(loanId);
    res.json({ loanId, totalOwed: totalOwed.toString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

loansRouter.get('/capacity/:address', async (req: Request, res: Response) => {
  try {
    const borrower = requireAddress(req.params.address, 'address');
    const contract = new ethers.Contract(config.addresses.capacityManager, CAPACITY_MANAGER_ABI, provider);
    const [available, used, locked, consumed] = await Promise.all([
      contract.availableCapacity(borrower),
      contract.getUsedCapacity(borrower),
      contract.getDefaultedLockedCapacity(borrower),
      contract.getTotalConsumedCapacity(borrower),
    ]);
    res.json({
      success: true,
      availableCapacity: available.toString(),
      usedCapacity: used.toString(),
      defaultedLockedCapacity: locked.toString(),
      totalConsumedCapacity: consumed.toString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

loansRouter.get('/:loanId', async (req: Request, res: Response) => {
  try {
    const loanId = Number(requireUint(req.params.loanId, 'loanId'));
    const contract = new ethers.Contract(config.addresses.loanVault, VAULT_ABI, provider);
    const loan = await contract.getLoan(loanId);
    res.json({
      success: true,
      loan: {
        loanId: loan.loanId.toString(),
        borrower: loan.borrower,
        lender: loan.lender,
        principal: loan.principal.toString(),
        aprBps: loan.aprBps.toString(),
        startTime: loan.startTime.toString(),
        duration: loan.duration.toString(),
        collateralAmount: loan.collateralAmount.toString(),
        repaidAmount: loan.repaidAmount.toString(),
        status: Number(loan.status),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Faucet & Onboarding Endpoint for any connected wallet
loansRouter.post('/faucet/:address', async (req: Request, res: Response) => {
  try {
    const targetAddress = requireAddress(req.params.address, 'address');
    if (!process.env.PRIVATE_KEY) throw new Error('Deployer private key not set');

    const deployerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    let fundingTxHash = '';

    // 1. Check and fund tCTC balance
    const currentBalance = await provider.getBalance(targetAddress);
    if (currentBalance < ethers.parseEther('10')) {
      const fundTx = await deployerWallet.sendTransaction({
        to: targetAddress,
        value: ethers.parseEther('25'),
      });
      await fundTx.wait();
      fundingTxHash = fundTx.hash;
    }

    // 2. Register On-Chain Eligibility if not active
    const ELIGIBILITY_ABI = [
      'function isEligibilityValid(address borrower) external view returns (bool)',
      'function setRegistrar(address newRegistrar) external',
      'function registerEligibility(address borrower, uint8 riskTier, uint256 maxActiveCredit, uint256 maxLtvBps, uint256 validUntil, uint256 policyVersion, bytes32 evidenceCommitment, bytes32 attestcoinContext) external',
    ];
    const eligContract = new ethers.Contract(config.addresses.eligibilityRegistry, ELIGIBILITY_ABI, deployerWallet);
    const isValid = await eligContract.isEligibilityValid(targetAddress).catch(() => false);

    if (!isValid) {
      const setRegTx = await eligContract.setRegistrar(deployerWallet.address);
      await setRegTx.wait();

      const maxCredit = ethers.parseEther('5000');
      const maxLtvBps = 6500n;
      const validUntil = BigInt(Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60);
      const evidenceCommitment = ethers.id(`creditcoin_proof_${targetAddress.toLowerCase()}`);
      const attestcoinContext = ethers.id(`attestcoin_context_${targetAddress.toLowerCase()}`);

      const regTx = await eligContract.registerEligibility(
        targetAddress,
        0,
        maxCredit,
        maxLtvBps,
        validUntil,
        1,
        evidenceCommitment,
        attestcoinContext
      );
      await regTx.wait();

      const restoreTx = await eligContract.setRegistrar(config.addresses.uscVerifier);
      await restoreTx.wait();
    }

    const newBalance = await provider.getBalance(targetAddress);
    res.json({
      success: true,
      address: targetAddress,
      balanceCTC: ethers.formatEther(newBalance),
      eligible: true,
      fundingTxHash,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
