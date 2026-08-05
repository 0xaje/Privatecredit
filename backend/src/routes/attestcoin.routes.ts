import { Router, Request, Response } from 'express';
import { attestcoinService } from '../services/AttestcoinService';
import { evidenceNormalizer } from '../services/EvidenceNormalizer';

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
            
            // In a real app, you'd fetch the original request details from DB to know the borrower/type
            // For MVP, we'll extract them from the mockResult if possible, or use placeholders.
            const borrower = rawResult.receiver || '0xMockBorrower';
            const chainId = '1';
            const eventType = rawResult.loanId ? 'REPAYMENT' : 'INFLOW';
            const txHash = '0xmocktxhash';

            const feature = evidenceNormalizer.normalizeAndStore(
                borrower,
                requestId,
                chainId,
                eventType,
                txHash,
                rawResult
            );

            return res.json({ status, feature });
        }
        
        res.json({ status });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});
