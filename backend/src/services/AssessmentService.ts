import { ethers } from 'ethers';
import { snapshotService } from './SnapshotService';
import { policyEngine, PolicyOutput, riskTierToEnum } from '../policy/PolicyEngine';
import { graphStore } from './GraphStore';
import { CreditFeature } from './EvidenceNormalizer';
import { config } from '../config';

const USC_VERIFIER_ABI = [
  'function registerEligibilityFromEvidence(address borrower,uint8 riskTier,uint256 maxActiveCredit,uint256 maxLtvBps,uint256 validUntil,bytes32[] evidenceIds) external',
];
const ELIGIBILITY_ABI = [
  'function getEligibility(address borrower) external view returns (tuple(address borrower,uint8 riskTier,uint256 maxActiveCredit,uint256 maxLtvBps,uint256 validUntil,uint256 policyVersion,bytes32 evidenceCommitment,bytes32 attestcoinContext,uint256 nonce,bool active))',
];

export interface PreparedEligibility extends PolicyOutput {
  evidenceCommitment: string;
  evidenceIds: string[];
  transaction?: { chainId: number; to: string; data: string; value: string };
}

export class AssessmentService {
  private readonly provider = new ethers.JsonRpcProvider(config.rpcUrl);

  previewEligibility(borrower: string, nodeIds: string[]): PolicyOutput {
    const frozenEvidence: CreditFeature[] = nodeIds.map(id => {
      const node = graphStore.getNode(id);
      if (!node || node.type !== 'EVIDENCE') throw new Error(`Invalid node ${id}`);
      return node.data as CreditFeature;
    });
    return policyEngine.evaluate({ borrower, frozenEvidence, evidenceCommitment: ethers.ZeroHash });
  }

  async prepareEligibility(borrower: string, nodeIds: string[]): Promise<PreparedEligibility> {
    if (!ethers.isAddress(borrower)) throw new Error('Borrower must be a valid address');
    const evidenceCommitment = snapshotService.freezeEvidenceSet(borrower, nodeIds);
    const evidenceIds = snapshotService.getEvidenceIds(borrower, nodeIds);
    const frozenEvidence: CreditFeature[] = snapshotService
      .getVerifiedEvidence(borrower, nodeIds)
      .map(node => node.data as CreditFeature);
    const policyOutput = policyEngine.evaluate({ borrower, frozenEvidence, evidenceCommitment });

    const output: PreparedEligibility = { ...policyOutput, evidenceCommitment, evidenceIds };
    if (policyOutput.riskTier === 'REJECTED') return output;
    if (!config.addresses.uscVerifier) throw new Error('USC_VERIFIER_ADDR is required to prepare official eligibility');

    const iface = new ethers.Interface(USC_VERIFIER_ABI);
    output.transaction = {
      chainId: config.chainId,
      to: config.addresses.uscVerifier,
      data: iface.encodeFunctionData('registerEligibilityFromEvidence', [
        borrower,
        riskTierToEnum(policyOutput.riskTier),
        policyOutput.maxActiveCredit,
        policyOutput.maxLtvBps,
        policyOutput.validUntil,
        evidenceIds,
      ]),
      value: '0',
    };
    return output;
  }

  async getEligibility(borrower: string): Promise<any> {
    const contract = new ethers.Contract(config.addresses.eligibilityRegistry, ELIGIBILITY_ABI, this.provider);
    const eligibility = await contract.getEligibility(borrower);
    return {
      borrower: eligibility.borrower,
      riskTier: Number(eligibility.riskTier),
      maxActiveCredit: eligibility.maxActiveCredit.toString(),
      maxLtvBps: eligibility.maxLtvBps.toString(),
      validUntil: eligibility.validUntil.toString(),
      policyVersion: eligibility.policyVersion.toString(),
      evidenceCommitment: eligibility.evidenceCommitment,
      attestcoinContext: eligibility.attestcoinContext,
      nonce: eligibility.nonce.toString(),
      active: eligibility.active,
    };
  }
}

export const assessmentService = new AssessmentService();
