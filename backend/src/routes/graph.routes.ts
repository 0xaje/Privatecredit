import { Router, Request, Response } from 'express';
import { graphStore } from '../services/GraphStore';

export const graphRouter = Router();

// Get the full graph for a borrower
graphRouter.get('/:borrower', async (req: Request, res: Response) => {
    try {
        const borrower = req.params.borrower as string;
        const graph = await graphStore.getGraphForBorrower(borrower);
        res.json(graph);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Get a specific node
graphRouter.get('/node/:nodeId', (req: Request, res: Response) => {
    try {
        const nodeId = req.params.nodeId as string;
        const node = graphStore.getNode(nodeId);
        if (!node) return res.status(404).json({ error: "Node not found" });
        res.json(node);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
