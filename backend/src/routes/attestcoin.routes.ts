import { Router, Request, Response } from 'express';
import { attestcoinService } from '../services/AttestcoinService';
import { evidenceNormalizer } from '../services/EvidenceNormalizer';
import { graphStore } from '../services/GraphStore';

export const attestcoinRouter = Router();

// 1. Trigger verification
attestcoinRouter.post('/verify', async (req: Request, res: Response) => {
    try {
        const { chainId, eventType, txHash, borrower } = req.body;
        if (!chainId || !eventType || !txHash || !borrower) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        
        const requestId = await attestcoinService.createVerificationRequest(chainId, eventType, txHash, borrower);
        res.json({ requestId, status: 'PENDING' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Check status and process if confirmed
attestcoinRouter.get('/status/:requestId', (req: Request, res: Response) => {
    try {
        const requestId = req.params.requestId as string;
        const status = attestcoinService.checkVerificationStatus(requestId);
        
        if (status === 'CONFIRMED') {
            const rawResult = attestcoinService.getVerificationResult(requestId);
            
            const reqInfo = attestcoinService.getRequest(requestId);
            const borrower = reqInfo.borrower;
            const chainId = reqInfo.chainId;
            const eventType = reqInfo.eventType;
            const txHash = reqInfo.txHash;

            const evidenceNodeId = `evidence_feat_${requestId}`;
            if (!graphStore.getNode(evidenceNodeId)) {
                evidenceNormalizer.normalizeAndStore(
                    borrower,
                    requestId,
                    chainId,
                    eventType,
                    txHash,
                    rawResult
                );
            }

            return res.json({ status, borrower, chainId, eventType, txHash });
        }
        
        res.json({ status });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});
