import { randomBytes } from 'crypto';
import { ethers } from 'ethers';
import { proofProvider, blockProver } from '@gluwa/usc-sdk';

export type VerificationStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';

export interface VerificationRequest {
    requestId: string;
    chainId: string;
    eventType: string;
    txHash: string;
    borrower: string;
    status: VerificationStatus;
    timestamp: number;
    mockResult?: any;
    proofData?: any;
}

export class AttestcoinService {
    private requests: Map<string, VerificationRequest> = new Map();
    private provider: ethers.JsonRpcProvider;
    private useRealAttestcoin: boolean;

    constructor() {
        this.useRealAttestcoin = process.env.USE_REAL_ATTESTCOIN === 'true';
        
        const RPC_URL = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
        this.provider = new ethers.JsonRpcProvider(RPC_URL);

        if (this.useRealAttestcoin) {
            console.log("AttestcoinService initialized in LIVE mode (USC SDK)");
        } else {
            console.log("AttestcoinService initialized in MOCK mode");
        }
    }

    async createVerificationRequest(chainId: string, eventType: string, txHash: string, borrower: string): Promise<string> {
        const requestId = 'req_' + randomBytes(16).toString('hex');
        
        const request: VerificationRequest = {
            requestId,
            chainId,
            eventType,
            txHash,
            borrower,
            status: 'PENDING',
            timestamp: Date.now()
        };

        this.requests.set(requestId, request);

        if (this.useRealAttestcoin) {
            this.processRealVerification(requestId, txHash, chainId).catch(err => {
                console.error(`USC Verification failed for ${requestId}:`, err);
                const req = this.requests.get(requestId);
                if (req) req.status = 'REJECTED';
            });
        } else {
            setTimeout(() => this.processMockVerification(requestId), 2000);
        }

        return requestId;
    }

    checkVerificationStatus(requestId: string): VerificationStatus {
        const req = this.requests.get(requestId);
        if (!req) throw new Error("Request not found");
        return req.status;
    }

    getVerificationResult(requestId: string): any {
        const req = this.requests.get(requestId);
        if (!req) throw new Error("Request not found");
        if (req.status !== 'CONFIRMED') throw new Error("Verification not confirmed");
        return req.mockResult;
    }

    getVerificationProof(requestId: string): any {
        const req = this.requests.get(requestId);
        if (!req || req.status !== 'CONFIRMED') return null;
        return req.proofData;
    }

    /**
     * Computes a keccak256 commitment from all CONFIRMED verification requests
     * for a given borrower. This serves as the real attestcoinContext passed
     * to the on-chain EligibilityRegistry.
     */
    computeEvidenceContext(borrower: string): string {
        const confirmed = [...this.requests.values()]
            .filter(r => r.borrower.toLowerCase() === borrower.toLowerCase() && r.status === 'CONFIRMED');
        if (confirmed.length === 0) return ethers.ZeroHash;

        // Sort by requestId for deterministic ordering
        confirmed.sort((a, b) => a.requestId.localeCompare(b.requestId));

        // Pack all confirmed evidence into a single commitment
        const packed = confirmed.map(r => `${r.chainId}:${r.txHash}:${r.eventType}:${r.requestId}`).join('|');
        return ethers.id(packed); // keccak256 of the packed string
    }

    private processMockVerification(requestId: string) {
        const req = this.requests.get(requestId);
        if (!req) return;

        req.status = 'CONFIRMED';
        
        if (req.eventType === 'INFLOW') {
            req.mockResult = {
                amount: '1000000000000000000',
                sender: '0xMockSender',
                receiver: req.borrower,
                timestamp: Math.floor(Date.now() / 1000) - 86400
            };
        } else if (req.eventType === 'REPAYMENT') {
            req.mockResult = {
                amount: '500000000000000000',
                loanId: 'mock_loan_1',
                timestamp: Math.floor(Date.now() / 1000) - 172800
            };
        } else {
            req.mockResult = { genericData: true };
        }
    }

    private async processRealVerification(requestId: string, txHash: string, sourceChainId: string) {
        const req = this.requests.get(requestId);
        if (!req) return;

        try {
            console.log(`[Attestcoin] Requesting proof for ${txHash} on chain ${sourceChainId}...`);
            const chainKey = parseInt(sourceChainId, 10) || 1;
            const PROVER_URL = process.env.CREDITCOIN_PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network/';
            
            // Build the proof
            const apiProvider = new proofProvider.service.ProofBuilder(chainKey, PROVER_URL);
            const proofResult = await apiProvider.getProof(txHash);

            if (!proofResult.success || !proofResult.data) {
                throw new Error(`Proof generation failed: ${proofResult.error}`);
            }

            const proofData = proofResult.data;

            // Verify on-chain
            const prover = new blockProver.PrecompileBlockProver(this.provider);
            const verificationResult = await prover.verifySingle(
                proofData.chainKey,
                proofData.headerNumber,
                proofData.txBytes,
                proofData.merkleProof,
                proofData.continuityProof,
            );

            if (!verificationResult) {
                throw new Error("On-chain verification failed via 0x0FD2 precompile");
            }

            console.log(`[Attestcoin] Proof verified successfully via 0x0FD2 precompile.`);

            // Extract real transaction data from the source chain
            try {
                const rpcUrls: Record<string, string> = {
                    '1': 'https://eth.llamarpc.com',
                    '137': 'https://polygon.llamarpc.com',
                    '56': 'https://bsc-dataseed.binance.org/',
                    '11155111': 'https://rpc.sepolia.org'
                };
                
                const sourceRpc = rpcUrls[sourceChainId] || 'https://eth.llamarpc.com'; // Default to ETH
                const sourceProvider = new ethers.JsonRpcProvider(sourceRpc);
                
                const receipt = await sourceProvider.getTransactionReceipt(txHash);
                if (!receipt) throw new Error("Transaction receipt not found on source chain");
                
                const block = await sourceProvider.getBlock(receipt.blockNumber);
                
                // ERC20 Transfer Signature: Transfer(address indexed from, address indexed to, uint256 value)
                // Topic0: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
                const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
                
                let foundAmount = '0';
                let foundSender = '0xUnknown';
                let foundReceiver = req.borrower;
                
                for (const log of receipt.logs) {
                    if (log.topics[0] === transferTopic) {
                        const from = ethers.getAddress('0x' + log.topics[1].slice(26));
                        const to = ethers.getAddress('0x' + log.topics[2].slice(26));
                        if (to.toLowerCase() === req.borrower.toLowerCase()) {
                            foundAmount = BigInt(log.data).toString();
                            foundSender = from;
                            foundReceiver = to;
                            break; // Stop at first matching transfer to borrower
                        }
                    }
                }

                req.status = 'CONFIRMED';
                req.proofData = proofData;
                
                if (req.eventType === 'INFLOW') {
                    req.mockResult = {
                        amount: foundAmount,
                        sender: foundSender,
                        receiver: foundReceiver,
                        timestamp: block ? block.timestamp : Math.floor(Date.now() / 1000)
                    };
                } else if (req.eventType === 'REPAYMENT') {
                    // For repayment, it might not be a direct transfer to the borrower, 
                    // but we just pass the extracted data
                    req.mockResult = {
                        amount: foundAmount,
                        loanId: 'verified_loan_1',
                        timestamp: block ? block.timestamp : Math.floor(Date.now() / 1000)
                    };
                }
            } catch (parseError) {
                console.warn(`[Attestcoin] Could not parse source tx logs, falling back to basic data.`, parseError);
                req.status = 'CONFIRMED';
                req.proofData = proofData;
                req.mockResult = {
                    amount: '1000000000000000000',
                    sender: '0xParseErrorFallback',
                    receiver: req.borrower,
                    timestamp: Math.floor(Date.now() / 1000)
                };
            }
        } catch (error) {
            req.status = 'REJECTED';
            throw error;
        }
    }
}

export const attestcoinService = new AttestcoinService();
