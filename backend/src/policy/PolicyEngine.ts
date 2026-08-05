import { CreditFeature } from '../services/EvidenceNormalizer';

export interface PolicyInput {
    borrower: string;
    frozenEvidence: CreditFeature[];
    evidenceCommitment: string;
}

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'REJECTED';
// Maps to the Solidity enum: 0=LOW, 1=MEDIUM, 2=HIGH (REJECTED is handled off-chain by just not calling register)
export function riskTierToEnum(tier: RiskTier): number {
    switch (tier) {
        case 'LOW': return 0;
        case 'MEDIUM': return 1;
        case 'HIGH': return 2;
        default: throw new Error("REJECTED cannot map to enum");
    }
}

export interface PolicyBreakdown {
    baseScore: number;
    factors: { reason: string; impact: number }[];
    finalScore: number;
}

export interface PolicyOutput {
    riskTier: RiskTier;
    maxActiveCredit: string; // BigNumber in string format (wei)
    maxLtvBps: number;
    validUntil: number;
    policyVersion: number;
    breakdown: PolicyBreakdown;
}

export class PolicyEngine {
    /**
     * Evaluates a frozen set of evidence and returns deterministic eligibility bounds.
     */
    evaluate(input: PolicyInput): PolicyOutput {
        let score = 50;
        const factors: { reason: string; impact: number }[] = [];

        // 1. Evaluate features
        for (const feature of input.frozenEvidence) {
            if (feature.type === 'INFLOW') {
                score += 15;
                factors.push({ reason: `Verified inflow (${feature.amount} wei)`, impact: 15 });
            } else if (feature.type === 'REPAYMENT') {
                score += 20;
                factors.push({ reason: `Verified repayment (${feature.amount} wei)`, impact: 20 });
            } else if (feature.type === 'OBLIGATION') {
                score -= 10;
                factors.push({ reason: `Verified obligation`, impact: -10 });
            }
        }

        // Cap score
        if (score > 100) score = 100;
        if (score < 0) score = 0;

        // 2. Map Score to Risk Tier
        let riskTier: RiskTier = 'REJECTED';
        let maxActiveCredit = '0';
        let maxLtvBps = 0;

        // Use BigInt for ETH scaling (e.g. 10000e18)
        const eth = 10n ** 18n;

        if (score >= 80) {
            riskTier = 'LOW';
            maxActiveCredit = (10000n * eth).toString();
            maxLtvBps = 6500; // 65%
        } else if (score >= 50) {
            riskTier = 'MEDIUM';
            maxActiveCredit = (5000n * eth).toString();
            maxLtvBps = 5000; // 50%
        } else if (score >= 20) {
            riskTier = 'HIGH';
            maxActiveCredit = (2000n * eth).toString();
            maxLtvBps = 3500; // 35%
        }

        const validUntil = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

        return {
            riskTier,
            maxActiveCredit,
            maxLtvBps,
            validUntil,
            policyVersion: 1,
            breakdown: {
                baseScore: 50,
                factors,
                finalScore: score
            }
        };
    }
}

export const policyEngine = new PolicyEngine();
