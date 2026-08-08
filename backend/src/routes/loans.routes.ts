import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';

export const loansRouter = Router();

const USE_REAL_NETWORK = process.env.USE_REAL_NETWORK === 'true';
const RPC_URL = USE_REAL_NETWORK 
    ? (process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network') 
    : 'http://127.0.0.1:8545';
const provider = new ethers.JsonRpcProvider(RPC_URL);

const MARKETPLACE_ADDR = process.env.MARKETPLACE_ADDR || '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853';
const VAULT_ADDR = process.env.LOAN_VAULT_ADDR || '0x70EE13351431E8983783BCB7205745E564Bf4aB3'; // Extracted from testnet deployment

// For local, use hardhat accounts 1 and 2. For real network, these must be populated.
const borrowerPk = USE_REAL_NETWORK ? process.env.BORROWER_PK! : '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const lenderPk = USE_REAL_NETWORK ? process.env.LENDER_PK! : '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';

const borrowerWallet = new ethers.Wallet(borrowerPk, provider);
const lenderWallet = new ethers.Wallet(lenderPk, provider);

const MARKETPLACE_ABI = [
    "function createBorrowRequest(uint256 amount, uint256 maxAprBps, uint256 maxDuration, uint256 collateralAmount) external returns (uint256)",
    "function createLenderOffer(uint256 requestId, uint256 aprBps, uint256 duration, uint256 requiredCollateral) external payable returns (uint256)",
    "function acceptOffer(uint256 offerId) external payable",
    "event RequestCreated(uint256 indexed requestId, address indexed borrower, uint256 amount)",
    "event OfferCreated(uint256 indexed offerId, uint256 indexed requestId, address indexed lender)",
    "event OfferAccepted(uint256 indexed offerId, uint256 indexed requestId)"
];

const VAULT_ABI = [
    "function repayLoan(uint256 loanId) external payable",
    "function calculateTotalOwed(uint256 loanId) public view returns (uint256)",
    "event LoanOriginated(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 principal)",
    "event LoanRepaid(uint256 indexed loanId, uint256 amount)"
];

loansRouter.post('/borrow-request', async (req: Request, res: Response) => {
    try {
        const { amount, maxAprBps, maxDuration, collateralAmount } = req.body;
        const contract = new ethers.Contract(MARKETPLACE_ADDR, MARKETPLACE_ABI, borrowerWallet);
        const tx = await contract.createBorrowRequest(amount, maxAprBps, maxDuration, collateralAmount);
        const receipt = await tx.wait();
        
        // Parse the RequestCreated event to get the on-chain requestId
        const iface = new ethers.Interface(MARKETPLACE_ABI);
        let requestId: string | undefined;
        for (const log of receipt.logs) {
            try {
                const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
                if (parsed && parsed.name === 'RequestCreated') {
                    requestId = parsed.args[0].toString();
                }
            } catch { /* skip non-matching logs */ }
        }
        
        res.json({ success: true, txHash: tx.hash, requestId });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.post('/offer', async (req: Request, res: Response) => {
    try {
        const { requestId, aprBps, duration, requiredCollateral, principal } = req.body;
        const contract = new ethers.Contract(MARKETPLACE_ADDR, MARKETPLACE_ABI, lenderWallet);
        const tx = await contract.createLenderOffer(requestId, aprBps, duration, requiredCollateral, { value: principal });
        const receipt = await tx.wait();
        
        // Parse the OfferCreated event to get the on-chain offerId
        const iface = new ethers.Interface(MARKETPLACE_ABI);
        let offerId: string | undefined;
        for (const log of receipt.logs) {
            try {
                const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
                if (parsed && parsed.name === 'OfferCreated') {
                    offerId = parsed.args[0].toString();
                }
            } catch { /* skip non-matching logs */ }
        }
        
        res.json({ success: true, txHash: tx.hash, offerId });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.post('/accept-offer', async (req: Request, res: Response) => {
    try {
        const { offerId, collateralAmount } = req.body;
        const contract = new ethers.Contract(MARKETPLACE_ADDR, MARKETPLACE_ABI, borrowerWallet);
        const tx = await contract.acceptOffer(offerId, { value: collateralAmount });
        const receipt = await tx.wait();
        
        // Parse the LoanOriginated event from LoanVault to get the loanId
        const vaultIface = new ethers.Interface(VAULT_ABI);
        let loanId: string | undefined;
        for (const log of receipt.logs) {
            try {
                const parsed = vaultIface.parseLog({ topics: log.topics as string[], data: log.data });
                if (parsed && parsed.name === 'LoanOriginated') {
                    loanId = parsed.args[0].toString();
                }
            } catch { /* skip non-matching logs */ }
        }
        
        res.json({ success: true, txHash: tx.hash, loanId });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.post('/repay', async (req: Request, res: Response) => {
    try {
        const { loanId, repaymentAmount } = req.body;
        const contract = new ethers.Contract(VAULT_ADDR, VAULT_ABI, borrowerWallet);
        const tx = await contract.repayLoan(loanId, { value: repaymentAmount });
        await tx.wait();
        res.json({ success: true, txHash: tx.hash });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.get('/total-owed/:loanId', async (req: Request, res: Response) => {
    try {
        const loanId = parseInt(req.params.loanId);
        const contract = new ethers.Contract(VAULT_ADDR, VAULT_ABI, provider);
        const totalOwed = await contract.calculateTotalOwed(loanId);
        res.json({ loanId, totalOwed: totalOwed.toString() });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
