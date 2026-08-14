import { Router, Request, Response } from 'express';
import { snapshotService } from '../services/SnapshotService';

export const evidenceRouter = Router();

evidenceRouter.post('/freeze', (req: Request, res: Response) => {
  try {
    const { borrower, nodeIds } = req.body;
    if (!borrower || !Array.isArray(nodeIds)) throw new Error('borrower and nodeIds[] required');
    const commitment = snapshotService.freezeEvidenceSet(borrower, nodeIds);
    const evidenceIds = snapshotService.getEvidenceIds(borrower, nodeIds);
    res.json({ commitment, evidenceIds, policyVersion: snapshotService.getPolicyVersion() });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
