import { Router, Request, Response } from 'express';
import { assessmentService } from '../services/AssessmentService';

export const assessmentRouter = Router();

// Request Eligibility (runs Policy Engine and registers on-chain)
assessmentRouter.post('/request', async (req: Request, res: Response) => {
    try {
        const { borrower, nodeIds } = req.body;
        if (!borrower || !Array.isArray(nodeIds)) {
            return res.status(400).json({ error: "borrower and nodeIds[] required" });
        }

        const policyOutput = await assessmentService.requestEligibility(borrower, nodeIds);
        res.json({ success: true, policy: policyOutput });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
