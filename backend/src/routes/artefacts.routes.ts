import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';

export const artefactsRouter = Router();

const USE_REAL_NETWORK = process.env.USE_REAL_NETWORK === 'true';
const RPC_URL = USE_REAL_NETWORK 
    ? (process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network') 
    : 'http://127.0.0.1:8545';
const provider = new ethers.JsonRpcProvider(RPC_URL);
const ARTEFACT_REGISTRY_ADDR = process.env.ARTEFACT_REGISTRY_ADDR || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

const borrowerPk = USE_REAL_NETWORK ? process.env.BORROWER_PK! : '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const wallet = new ethers.Wallet(borrowerPk, provider);

const ARTEFACT_ABI = [
    "function commitArtefact(bytes32 snapshotCommitment, uint256 eligibilityNonce, bytes32 policyReference, string calldata contentReference) external"
];

artefactsRouter.post('/commit', async (req: Request, res: Response) => {
    try {
        const { snapshotCommitment, eligibilityNonce, contentReference } = req.body;
        const contract = new ethers.Contract(ARTEFACT_REGISTRY_ADDR, ARTEFACT_ABI, wallet);
        
        const tx = await contract.commitArtefact(
            snapshotCommitment, 
            eligibilityNonce || 1, 
            ethers.ZeroHash, // mock policy reference
            contentReference || ""
        );
        await tx.wait();
        
        res.json({ success: true, txHash: tx.hash });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
