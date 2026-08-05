import { Router, Request, Response } from 'express';
import { snapshotService } from '../services/SnapshotService';

export const evidenceRouter = Router();

// Freeze evidence set
evidenceRouter.post('/freeze', (req: Request, res: Response) => {
    try {
        const { borrower, nodeIds } = req.body;
        if (!borrower || !Array.isArray(nodeIds)) {
            return res.status(400).json({ error: "borrower and nodeIds[] required" });
        }

        const commitment = snapshotService.freezeEvidenceSet(borrower, nodeIds);
        res.json({ commitment });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});
