import { Router, Request, Response } from 'express';
import { graphStore } from '../services/GraphStore';

export const judgeRouter = Router();

judgeRouter.get('/:borrower', (req: Request, res: Response) => {
    try {
        const borrower = req.params.borrower as string;
        const graph = graphStore.getGraphForBorrower(borrower);
        
        // In a full implementation, this aggregates on-chain Capacity, Repayment info, and Artefacts.
        // For MVP, we'll return the graph which contains the Attestcoin references and Creditcoin txHashes.
        
        const evidenceNodes = graph.nodes.filter(n => n.type === 'EVIDENCE');
        
        res.json({
            borrower,
            totalEvidence: evidenceNodes.length,
            verifications: evidenceNodes.map(n => n.attestcoinRef),
            graph
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
