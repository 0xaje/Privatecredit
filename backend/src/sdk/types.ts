/**
 * PrivateCredit Graph - Frontend SDK Types
 * Copy these types directly into the frontend React/Next.js application.
 */

// ---------------------------
// 1. Graph Entities
// ---------------------------

export type GraphNodeType = 'WALLET' | 'EVIDENCE' | 'ELIGIBILITY' | 'BORROW_REQUEST' | 'LOAN' | 'REPAYMENT';
export type CreditFeatureType = 'INFLOW' | 'REPAYMENT' | 'TRANSFER' | 'LIQUIDITY' | 'OBLIGATION';
export type GraphEdgeType = 'INFLOW_TO' | 'REPAID_BY' | 'ELIGIBILITY_FOR' | 'FUNDED_BY' | 'COLLATERAL_FOR' | 'CONSUMES_CAPACITY';

export interface CreditFeature {
    featureId: string;
    borrower: string;
    type: CreditFeatureType;
    sourceChain: string;
    sourceTxHash: string;
    amount: string;
    timestamp: number;
    verified: boolean;
    attestcoinRequestId: string;
}

export interface GraphNode {
    id: string;
    type: GraphNodeType;
    data: Record<string, any>;
    verified: boolean;
    attestcoinRef?: string;
    creditcoinTxHash?: string;
}

export interface GraphEdge {
    id: string;
    source: string; // node id
    target: string; // node id
    type: GraphEdgeType;
    verified: boolean;
}

export interface GraphPayload {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

// ---------------------------
// 2. Policy Engine Outputs
// ---------------------------

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'REJECTED';

export interface PolicyFactor {
    reason: string;
    impact: number;
}

export interface PolicyBreakdown {
    baseScore: number;
    factors: PolicyFactor[];
    finalScore: number;
}

export interface PolicyOutput {
    riskTier: RiskTier;
    maxActiveCredit: string; // BigNumber string in wei
    maxLtvBps: number;       // e.g. 6500 = 65%
    validUntil: number;      // Unix timestamp
    policyVersion: number;
    breakdown: PolicyBreakdown;
}

export interface EligibilityResponse {
    success: boolean;
    policy: PolicyOutput;
    error?: string;
}

// ---------------------------
// 3. API Requests
// ---------------------------

export interface VerifyRequest {
    chainId: string;
    eventType: CreditFeatureType;
    txHash: string;
    borrower: string; // ETH Address
}

export interface AssessmentRequest {
    borrower: string;
    nodeIds: string[]; // IDs of the evidence nodes to freeze
}

export interface BorrowRequestPayload {
    amount: string; // wei
    maxAprBps: number;
    maxDuration: number; // seconds
    collateralAmount: string; // wei
}
