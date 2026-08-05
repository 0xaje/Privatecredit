import { ethers } from 'ethers';
import { graphStore } from './GraphStore';

export class SnapshotService {
    /**
     * Freezes a set of evidence nodes and returns a deterministic commitment hash.
     */
    freezeEvidenceSet(borrower: string, nodeIds: string[]): string {
        // Collect the node data
        const evidenceData = nodeIds.map(id => {
            const node = graphStore.getNode(id);
            if (!node || node.type !== 'EVIDENCE') {
                throw new Error(`Invalid evidence node: ${id}`);
            }
            if (!node.verified) {
                throw new Error(`Unverified evidence node cannot be frozen: ${id}`);
            }
            return node.data;
        });

        // For deterministic hashing, we sort the data by featureId
        evidenceData.sort((a, b) => a.featureId.localeCompare(b.featureId));

        // Create a canonical JSON string
        const canonicalString = JSON.stringify({ borrower, evidence: evidenceData });

        // Hash it using keccak256
        const commitment = ethers.keccak256(ethers.toUtf8Bytes(canonicalString));
        
        return commitment;
    }
}

export const snapshotService = new SnapshotService();
