import { ethers } from 'ethers';
import { snapshotService } from './SnapshotService';
import { policyEngine, PolicyOutput, riskTierToEnum } from '../policy/PolicyEngine';
import { graphStore } from './GraphStore';
import { CreditFeature } from './EvidenceNormalizer';
import { attestcoinService } from './AttestcoinService';

const USE_REAL_NETWORK = process.env.USE_REAL_NETWORK === 'true';
const RPC_URL = USE_REAL_NETWORK 
    ? (process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network') 
    : 'http://127.0.0.1:8545';

// Hardhat Account #0 private key (the deployer/registrar) for mock, else use real env
const DEPLOYER_PK = USE_REAL_NETWORK 
    ? process.env.DEPLOYER_PRIVATE_KEY! 
    : '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Note: Ensure this matches the latest local deployment address when mocking
const ELIGIBILITY_REGISTRY_ADDRESS = process.env.ELIGIBILITY_REGISTRY_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

// Minimal ABI required for registration
const ELIGIBILITY_ABI = [
    "function registerEligibility(address borrower, uint8 riskTier, uint256 maxActiveCredit, uint256 maxLtvBps, uint256 validUntil, uint256 policyVersion, bytes32 evidenceCommitment, bytes32 attestcoinContext) external"
];

export class AssessmentService {
    private provider: ethers.JsonRpcProvider;
    private registrarWallet: ethers.Wallet;
    private registryContract: ethers.Contract;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.registrarWallet = new ethers.Wallet(DEPLOYER_PK, this.provider);
        this.registryContract = new ethers.Contract(ELIGIBILITY_REGISTRY_ADDRESS, ELIGIBILITY_ABI, this.registrarWallet);
    }

    /**
     * Complete Assessment Flow:
     * 1. Freeze Evidence
     * 2. Run Policy Engine
     * 3. Register on-chain
     */
    async requestEligibility(borrower: string, nodeIds: string[]): Promise<PolicyOutput> {
        // 1. Freeze Evidence (throws if unverified nodes are passed)
        const commitment = snapshotService.freezeEvidenceSet(borrower, nodeIds);

        // Fetch the node data to pass to policy engine
        const frozenEvidence: CreditFeature[] = nodeIds.map(id => {
            const node = graphStore.getNode(id);
            if (!node || node.type !== 'EVIDENCE') throw new Error(`Invalid node ${id}`);
            return node.data as CreditFeature;
        });

        // 2. Score
        const policyOutput = policyEngine.evaluate({
            borrower,
            frozenEvidence,
            evidenceCommitment: commitment
        });

        // If rejected, don't register on chain
        if (policyOutput.riskTier === 'REJECTED') {
            return policyOutput;
        }

        // 3. Register On-Chain
        const riskTierEnum = riskTierToEnum(policyOutput.riskTier);
        
        console.log(`Registering eligibility on-chain for ${borrower}...`);
        
        try {
            const tx = await this.registryContract.registerEligibility(
                borrower,
                riskTierEnum,
                policyOutput.maxActiveCredit,
                policyOutput.maxLtvBps,
                policyOutput.validUntil,
                policyOutput.policyVersion,
                commitment,
                attestcoinService.computeEvidenceContext(borrower) // real cross-chain evidence commitment
            );
            await tx.wait();
            console.log(`Registered! TxHash: ${tx.hash}`);
        } catch (e: any) {
            console.error("On-chain registration failed:", e);
            throw new Error(`Blockchain transaction failed: ${e.message}`);
        }

        return policyOutput;
    }
}

export const assessmentService = new AssessmentService();
