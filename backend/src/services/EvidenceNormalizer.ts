import { graphStore, GraphNode, GraphEdge } from './GraphStore';

export interface CreditFeature {
    featureId: string;
    borrower: string;
    type: 'INFLOW' | 'REPAYMENT' | 'TRANSFER' | 'LIQUIDITY' | 'OBLIGATION';
    sourceChain: string;
    sourceTxHash: string;
    amount: string;
    timestamp: number;
    verified: boolean;
    attestcoinRequestId: string;
}

export class EvidenceNormalizer {
    /**
     * Transforms raw Attestcoin results into structured credit features
     * and adds them to the Graph Store.
     */
    normalizeAndStore(
        borrower: string,
        requestId: string,
        chainId: string,
        eventType: string,
        txHash: string,
        rawResult: any
    ): CreditFeature {
        
        let type: CreditFeature['type'] = 'INFLOW';
        if (eventType === 'REPAYMENT') type = 'REPAYMENT';
        
        const feature: CreditFeature = {
            featureId: `feat_${requestId}`,
            borrower,
            type,
            sourceChain: chainId,
            sourceTxHash: txHash,
            amount: rawResult.amount || '0',
            timestamp: rawResult.timestamp || Math.floor(Date.now() / 1000),
            verified: true,
            attestcoinRequestId: requestId
        };

        // Create Wallet Node if not exists
        const walletNodeId = `wallet_${borrower.toLowerCase()}`;
        if (!graphStore.getNode(walletNodeId)) {
            graphStore.addNode({
                id: walletNodeId,
                type: 'WALLET',
                data: { address: borrower },
                verified: true
            });
        }

        // Create Evidence Node
        const evidenceNodeId = `evidence_${feature.featureId}`;
        graphStore.addNode({
            id: evidenceNodeId,
            type: 'EVIDENCE',
            data: feature,
            verified: true,
            attestcoinRef: requestId,
            creditcoinTxHash: txHash
        });

        // Link Evidence to Wallet
        const edgeType = type === 'INFLOW' ? 'INFLOW_TO' : 'REPAID_BY';
        graphStore.addEdge({
            id: `edge_${evidenceNodeId}_${walletNodeId}`,
            source: evidenceNodeId,
            target: walletNodeId,
            type: edgeType,
            verified: true
        });

        return feature;
    }
}

export const evidenceNormalizer = new EvidenceNormalizer();
