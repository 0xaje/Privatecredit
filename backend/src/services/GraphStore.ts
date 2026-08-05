export interface GraphNode {
    id: string;
    type: 'WALLET' | 'EVIDENCE' | 'ELIGIBILITY' | 'BORROW_REQUEST' | 'LOAN' | 'REPAYMENT';
    data: Record<string, any>;
    verified: boolean;
    attestcoinRef?: string;
    creditcoinTxHash?: string;
}

export interface GraphEdge {
    id: string;
    source: string; // node id
    target: string; // node id
    type: 'INFLOW_TO' | 'REPAID_BY' | 'ELIGIBILITY_FOR' | 'FUNDED_BY' | 'COLLATERAL_FOR' | 'CONSUMES_CAPACITY';
    verified: boolean;
}

export class GraphStore {
    private nodes: Map<string, GraphNode> = new Map();
    private edges: Map<string, GraphEdge> = new Map();

    addNode(node: GraphNode): void {
        this.nodes.set(node.id, node);
    }

    addEdge(edge: GraphEdge): void {
        this.edges.set(edge.id, edge);
    }

    getNode(id: string): GraphNode | undefined {
        return this.nodes.get(id);
    }

    getGraphForBorrower(borrower: string): { nodes: GraphNode[], edges: GraphEdge[] } {
        // Return all nodes and edges. For MVP, we filter based on connected components to the borrower's wallet node
        // In a real Graph DB, this would be a Cypher query.
        
        const borrowerNodeId = `wallet_${borrower.toLowerCase()}`;
        
        const connectedNodeIds = new Set<string>();
        connectedNodeIds.add(borrowerNodeId);

        const relevantEdges: GraphEdge[] = [];
        
        // Very basic 1-hop traversal for MVP
        for (const edge of this.edges.values()) {
            if (edge.source === borrowerNodeId || edge.target === borrowerNodeId) {
                connectedNodeIds.add(edge.source);
                connectedNodeIds.add(edge.target);
                relevantEdges.push(edge);
            }
        }

        const relevantNodes: GraphNode[] = [];
        for (const id of connectedNodeIds) {
            const node = this.nodes.get(id);
            if (node) relevantNodes.push(node);
        }

        return {
            nodes: relevantNodes,
            edges: relevantEdges
        };
    }
}

// Singleton for MVP
export const graphStore = new GraphStore();
