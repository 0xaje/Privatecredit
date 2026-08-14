import { Router, Request, Response } from 'express';
import { assessmentService } from '../services/AssessmentService';

export const assessmentRouter = Router();

assessmentRouter.post('/preview', (req: Request, res: Response) => {
  try {
    const { borrower, nodeIds } = req.body;
    if (!borrower || !Array.isArray(nodeIds)) throw new Error('borrower and nodeIds[] required');
    const policy = assessmentService.previewEligibility(borrower, nodeIds);
    res.json({ success: true, policy, mutatesOnchain: false });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

assessmentRouter.post('/prepare', async (req: Request, res: Response) => {
  try {
    const { borrower, nodeIds } = req.body;
    if (!borrower || !Array.isArray(nodeIds)) throw new Error('borrower and nodeIds[] required');
    const prepared = await assessmentService.prepareEligibility(borrower, nodeIds);
    res.json({ success: true, policy: prepared, transaction: prepared.transaction });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

assessmentRouter.get('/eligibility/:address', async (req: Request, res: Response) => {
  try {
    const eligibility = await assessmentService.getEligibility(req.params.address as string);
    res.json({ success: true, eligibility });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
