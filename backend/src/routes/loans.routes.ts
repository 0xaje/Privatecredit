import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';

export const loansRouter = Router();

const USE_REAL_NETWORK = process.env.USE_REAL_NETWORK === 'true';
const RPC_URL = USE_REAL_NETWORK 
    ? (process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network') 
    : 'http://127.0.0.1:8545';
const provider = new ethers.JsonRpcProvider(RPC_URL);

const MARKETPLACE_ADDR = process.env.MARKETPLACE_ADDR || '0x776645cD81Ab903c573De406615A2f4c429ca9cc';
const VAULT_ADDR = process.env.LOAN_VAULT_ADDR || '0x2773338984c5036374E02496848335C24cBd975b';
const CAPACITY_MANAGER_ADDR = process.env.CAPACITY_MANAGER_ADDR || '0x4f55B2668e74d7AB350b7d105aAc8b914B9aEDBc';


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
    "function getLoan(uint256 loanId) external view returns (tuple(uint256 loanId, address borrower, address lender, uint256 principal, uint256 aprBps, uint256 startTime, uint256 duration, uint256 collateralAmount, uint256 repaidAmount, uint8 status))",
    "event LoanOriginated(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 principal)",
    "event LoanRepaid(uint256 indexed loanId, uint256 amount)"
];

const CAPACITY_MANAGER_ABI = [
    "function availableCapacity(address borrower) external view returns (uint256)",
    "function getUsedCapacity(address borrower) external view returns (uint256)"
];


loansRouter.get('/total-owed/:loanId', async (req: Request, res: Response) => {
    try {
        const loanId = parseInt(req.params.loanId as string);
        const contract = new ethers.Contract(VAULT_ADDR, VAULT_ABI, provider);
        const totalOwed = await contract.calculateTotalOwed(loanId);
        res.json({ loanId, totalOwed: totalOwed.toString() });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.get('/capacity/:address', async (req: Request, res: Response) => {
    try {
        const borrower = req.params.address as string;
        const contract = new ethers.Contract(CAPACITY_MANAGER_ADDR, CAPACITY_MANAGER_ABI, provider);
        
        const [available, used] = await Promise.all([
            contract.availableCapacity(borrower),
            contract.getUsedCapacity(borrower)
        ]);

        res.json({
            success: true,
            availableCapacity: available.toString(),
            usedCapacity: used.toString()
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

loansRouter.get('/:loanId', async (req: Request, res: Response) => {
    try {
        const loanId = parseInt(req.params.loanId as string);
        const contract = new ethers.Contract(VAULT_ADDR, VAULT_ABI, provider);
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
                status: Number(loan.status)
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
