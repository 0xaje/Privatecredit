import { graphStore } from './GraphStore';

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
  evidenceId: string;
  verificationContext: string;
  sourceChainKey: number;
  sourceBlock: number;
}

export class EvidenceNormalizer {
  normalizeAndStore(
    borrower: string,
    requestId: string,
    chainId: string,
    eventType: string,
    txHash: string,
    rawResult: any,
  ): CreditFeature {
    const type: CreditFeature['type'] = eventType === 'REPAYMENT' ? 'REPAYMENT' : 'INFLOW';
    const evidenceId = String(rawResult.evidenceId);
    if (!/^0x[0-9a-fA-F]{64}$/.test(evidenceId)) throw new Error('USC evidence ID is required');

    const feature: CreditFeature = {
      featureId: `feat_${evidenceId.slice(2, 18)}`,
      borrower,
      type,
      sourceChain: chainId,
      sourceTxHash: txHash,
      amount: String(rawResult.amount),
      timestamp: Number(rawResult.timestamp),
      verified: true,
      attestcoinRequestId: requestId,
      evidenceId,
      verificationContext: String(rawResult.verificationContext),
      sourceChainKey: Number(rawResult.sourceChainKey),
      sourceBlock: Number(rawResult.sourceBlock),
    };

    const walletNodeId = `wallet_${borrower.toLowerCase()}`;
    if (!graphStore.getNode(walletNodeId)) {
      graphStore.addNode({ id: walletNodeId, type: 'WALLET', data: { address: borrower }, verified: true });
    }

    const evidenceNodeId = `evidence_${evidenceId.toLowerCase()}`;
    graphStore.addNode({
      id: evidenceNodeId,
      type: 'EVIDENCE',
      data: feature,
      verified: true,
      proofStatus: 'VERIFIED',
      uscEvidenceId: evidenceId,
      sourceChainKey: feature.sourceChainKey,
      sourceBlock: feature.sourceBlock,
      attestcoinRef: requestId,
      creditcoinTxHash: rawResult.creditcoinTxHash,
    });

    const edgeType = type === 'INFLOW' ? 'INFLOW_TO' : 'REPAID_BY';
    graphStore.addEdge({
      id: `edge_${evidenceNodeId}_${walletNodeId}`,
      source: evidenceNodeId,
      target: walletNodeId,
      type: edgeType,
      verified: true,
    });

    return feature;
  }
}

export const evidenceNormalizer = new EvidenceNormalizer();
