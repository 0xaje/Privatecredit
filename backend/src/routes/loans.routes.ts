import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';

export const loansRouter = Router();

const USE_REAL_NETWORK = process.env.USE_REAL_NETWORK === 'true';
const RPC_URL = USE_REAL_NETWORK 
    ? (process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network') 
    : 'http://127.0.0.1:8545';
const provider = new ethers.JsonRpcProvider(RPC_URL);

const MARKETPLACE_ADDR = process.env.MARKETPLACE_ADDR || '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853';

// For local, use hardhat accounts 1 and 2. For real network, these must be populated.
const borrowerPk = USE_REAL_NETWORK ? process.env.BORROWER_PK! : '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const lenderPk = USE_REAL_NETWORK ? process.env.LENDER_PK! : '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';

const borrowerWallet = new ethers.Wallet(borrowerPk, provider);
const lenderWallet = new ethers.Wallet(lenderPk, provider);

const MARKETPLACE_ABI = [
    "function createBorrowRequest(uint256 amount, uint256 maxAprBps, uint256 maxDuration, uint256 collateralAmount) external returns (uint256)",
    "function createLenderOffer(uint256 requestId, uint256 aprBps, uint256 duration, uint256 requiredCollateral) external payable returns (uint256)",
    "function acceptOffer(uint256 offerId) external payable"
];

loansRouter.post('/borrow-request', async (req: Request, res: Response) => {
    try {
        const { amount, maxAprBps, maxDuration, collateralAmount } = req.body;
        const contract = new ethers.Contract(MARKETPLACE_ADDR, MARKETPLACE_ABI, borrowerWallet);
        const tx = await contract.createBorrowRequest(amount, maxAprBps, maxDuration, collateralAmount);
        await tx.wait();
        res.json({ success: true, txHash: tx.hash });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.post('/offer', async (req: Request, res: Response) => {
    try {
        const { requestId, aprBps, duration, requiredCollateral, principal } = req.body;
        const contract = new ethers.Contract(MARKETPLACE_ADDR, MARKETPLACE_ABI, lenderWallet);
        const tx = await contract.createLenderOffer(requestId, aprBps, duration, requiredCollateral, { value: principal });
        await tx.wait();
        res.json({ success: true, txHash: tx.hash });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.post('/accept-offer', async (req: Request, res: Response) => {
    try {
        const { offerId, collateralAmount } = req.body;
        const contract = new ethers.Contract(MARKETPLACE_ADDR, MARKETPLACE_ABI, borrowerWallet);
        const tx = await contract.acceptOffer(offerId, { value: collateralAmount });
        await tx.wait();
        res.json({ success: true, txHash: tx.hash });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
