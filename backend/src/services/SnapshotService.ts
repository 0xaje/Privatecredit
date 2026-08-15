import { ethers } from 'ethers';
import { graphStore, GraphNode } from './GraphStore';

const POLICY_VERSION = 1;

function canonicalEvidence(node: GraphNode) {
  const data = node.data;
  return {
    featureId: String(data.featureId || node.id),
    borrower: String(data.borrower).toLowerCase(),
    type: String(data.type),
    sourceChain: String(data.sourceChain),
    sourceTxHash: String(data.sourceTxHash).toLowerCase(),
    amount: String(data.amount || '0'),
    timestamp: Number(data.timestamp),
    uscEvidenceId: String(node.uscEvidenceId).toLowerCase(),
    sourceChainKey: Number(node.sourceChainKey),
    sourceBlock: Number(node.sourceBlock),
    verificationContext: String(data.verificationContext || '').toLowerCase(),
    policyVersion: POLICY_VERSION,
  };
}

export class SnapshotService {
  getVerifiedEvidence(borrower: string, nodeIds: string[]): GraphNode[] {
    if (nodeIds.length === 0) throw new Error('At least one evidence node is required');
    const normalizedBorrower = borrower.toLowerCase();
    const uniqueIds = new Set(nodeIds);
    if (uniqueIds.size !== nodeIds.length) throw new Error('Duplicate evidence node IDs are not allowed');

    const nodes = nodeIds.map(id => {
      const node = graphStore.getNode(id);
      if (!node || node.type !== 'EVIDENCE') throw new Error(`Invalid evidence node: ${id}`);
      if (!node.verified || node.proofStatus !== 'VERIFIED') throw new Error(`Evidence is not USC verified: ${id}`);
      if (!node.uscEvidenceId || !ethers.isHexString(node.uscEvidenceId, 32)) {
        throw new Error(`Evidence is missing its on-chain USC identity: ${id}`);
      }
      if (String(node.data.borrower).toLowerCase() !== normalizedBorrower) {
        throw new Error(`Evidence does not belong to borrower: ${id}`);
      }
      return node;
    });

    return nodes.sort((a, b) => String(a.uscEvidenceId).toLowerCase().localeCompare(String(b.uscEvidenceId).toLowerCase()));
  }

  freezeEvidenceSet(borrower: string, nodeIds: string[]): string {
    const nodes = this.getVerifiedEvidence(borrower, nodeIds);
    const evidence = nodes.map(canonicalEvidence);
    return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({
      borrower: borrower.toLowerCase(),
      policyVersion: POLICY_VERSION,
      evidence,
    })));
  }

  getEvidenceIds(borrower: string, nodeIds: string[]): string[] {
    return this.getVerifiedEvidence(borrower, nodeIds)
      .map(node => ethers.getBytes(String(node.uscEvidenceId)))
      .sort((a, b) => ethers.hexlify(a).localeCompare(ethers.hexlify(b)))
      .map(bytes => ethers.hexlify(bytes));
  }

  getPolicyVersion(): number {
    return POLICY_VERSION;
  }
}

export const snapshotService = new SnapshotService();
