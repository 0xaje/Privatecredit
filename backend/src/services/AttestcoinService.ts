import { ethers } from 'ethers';
import { blockProver, proofProvider } from '@gluwa/usc-sdk';
import { config } from '../config';
import { evidenceNormalizer, CreditFeature } from './EvidenceNormalizer';

export type VerificationStatus =
  | 'PENDING_ATTESTATION'
  | 'PROOF_GENERATING'
  | 'PROOF_READY'
  | 'SUBMITTING'
  | 'VERIFIED'
  | 'FAILED'
  | 'UNSUPPORTED';

export interface VerificationRequest {
  requestId: string;
  chainId: number;
  chainKey: number;
  eventType: 'INFLOW' | 'REPAYMENT';
  txHash: string;
  borrower: string;
  status: VerificationStatus;
  createdAt: number;
  sourceBlock?: number;
  proof?: any;
  creditcoinTxHash?: string;
  evidenceId?: string;
  error?: string;
  feature?: CreditFeature;
}

const USC_VERIFIER_ABI = [
  'function verifiedEvidence(bytes32 evidenceId) external view returns (tuple(address borrower,uint8 evidenceType,uint64 chainKey,uint64 blockHeight,address token,address sender,uint256 amount,bytes32 transactionHash,bool active))',
  'event EvidenceVerified(bytes32 indexed queryId,bytes32 indexed evidenceId,address indexed borrower,uint64 chainKey,uint64 blockHeight,address token,address sender,uint256 amount,uint8 evidenceType,bytes32 transactionHash)',
];

export class AttestcoinService {
  private readonly requests = new Map<string, VerificationRequest>();
  private readonly creditcoinProvider = new ethers.JsonRpcProvider(config.rpcUrl);
  private readonly sourceProvider?: ethers.JsonRpcProvider;

  constructor() {
    const sourceRpc = process.env.SOURCE_CHAIN_RPC_URL;
    if (sourceRpc) this.sourceProvider = new ethers.JsonRpcProvider(sourceRpc);
  }

  async createVerificationRequest(
    chainIdInput: string,
    eventTypeInput: string,
    txHash: string,
    borrower: string,
  ): Promise<string> {
    const chainId = Number(chainIdInput);
    if (!Number.isInteger(chainId) || chainId !== config.sourceChainId) {
      throw new Error(`Unsupported source chain ${chainIdInput}; configured live chain is ${config.sourceChainId}.`);
    }
    if (eventTypeInput !== 'INFLOW' && eventTypeInput !== 'REPAYMENT') {
      throw new Error(`Unsupported evidence type: ${eventTypeInput}`);
    }
    if (!ethers.isAddress(borrower)) throw new Error('Borrower must be a valid address');
    if (!ethers.isHexString(txHash, 32)) throw new Error('Source transaction hash must be 32-byte hex');
    if (!config.sourceToken) throw new Error('SOURCE_TOKEN_ADDRESS is not configured');
    if (!this.sourceProvider) throw new Error('SOURCE_CHAIN_RPC_URL is required for live verification');
    if (!config.addresses.uscVerifier) throw new Error('USC_VERIFIER_ADDR is required for live verification');

    const requestId = `req_${ethers.hexlify(ethers.randomBytes(16)).slice(2)}`;
    const request: VerificationRequest = {
      requestId,
      chainId,
      chainKey: config.sourceChainKey,
      eventType: eventTypeInput as 'INFLOW' | 'REPAYMENT',
      txHash: txHash.toLowerCase(),
      borrower: ethers.getAddress(borrower),
      status: 'PENDING_ATTESTATION',
      createdAt: Date.now(),
    };
    this.requests.set(requestId, request);
    void this.prepareProof(requestId);
    return requestId;
  }

  get(requestId: string): VerificationRequest {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Verification request not found');
    return request;
  }

  checkVerificationStatus(requestId: string): VerificationRequest {
    return this.get(requestId);
  }

  async completeVerification(requestId: string, creditcoinTxHash: string, evidenceId: string): Promise<CreditFeature> {
    const request = this.get(requestId);
    if (request.status !== 'PROOF_READY' && request.status !== 'SUBMITTING') {
      throw new Error(`Request is not ready for completion: ${request.status}`);
    }
    if (!ethers.isHexString(creditcoinTxHash, 32) || !ethers.isHexString(evidenceId, 32)) {
      throw new Error('Creditcoin transaction hash and evidence ID must be 32-byte hex');
    }
    if (!config.addresses.uscVerifier) throw new Error('USC_VERIFIER_ADDR is not configured');

    request.status = 'SUBMITTING';
    request.creditcoinTxHash = creditcoinTxHash;
    request.evidenceId = evidenceId;
    const receipt = await this.creditcoinProvider.getTransactionReceipt(creditcoinTxHash);
    if (!receipt || receipt.status !== 1) {
      request.status = 'FAILED';
      request.error = 'Creditcoin USC verification transaction is not confirmed successfully';
      throw new Error(request.error);
    }
    if (receipt.to?.toLowerCase() !== config.addresses.uscVerifier.toLowerCase()) {
      request.status = 'FAILED';
      request.error = 'Creditcoin transaction did not target USCVerifier';
      throw new Error(request.error);
    }

    const verifier = new ethers.Contract(config.addresses.uscVerifier, USC_VERIFIER_ABI, this.creditcoinProvider);
    const evidence = await verifier.verifiedEvidence(evidenceId);
    if (String(evidence.borrower).toLowerCase() !== request.borrower.toLowerCase()) {
      request.status = 'FAILED';
      request.error = 'Verified evidence borrower does not match the request borrower';
      throw new Error(request.error);
    }
    if (!evidence.active || Number(evidence.chainKey) !== request.chainKey) {
      request.status = 'FAILED';
      request.error = 'Verified evidence is inactive or from an unexpected source chain';
      throw new Error(request.error);
    }

    const rawResult = {
      amount: evidence.amount.toString(),
      sender: evidence.sender,
      timestamp: Math.floor(request.createdAt / 1000),
      evidenceId,
      verificationContext: evidence.transactionHash,
      sourceBlock: Number(evidence.blockHeight),
      sourceChainKey: Number(evidence.chainKey),
    };
    request.feature = evidenceNormalizer.normalizeAndStore(
      request.borrower,
      request.requestId,
      String(request.chainId),
      request.eventType,
      request.txHash,
      rawResult,
    );
    request.status = 'VERIFIED';
    return request.feature;
  }

  private async prepareProof(requestId: string): Promise<void> {
    const request = this.get(requestId);
    try {
      if (!this.sourceProvider) throw new Error('SOURCE_CHAIN_RPC_URL is required for live verification');
      const sourceTx = await this.sourceProvider.getTransaction(request.txHash);
      if (!sourceTx || sourceTx.blockNumber === null) throw new Error('Source transaction is not mined');
      request.sourceBlock = sourceTx.blockNumber;
      request.status = 'PROOF_GENERATING';

      const builder = new proofProvider.service.ProofBuilder(
        request.chainKey,
        config.proofBuilderUrl,
        Number(process.env.ATTESTCOIN_HTTP_TIMEOUT_MS || 10_000),
      );
      await builder.waitUntilHeightAttested(
        request.chainKey,
        request.sourceBlock,
        Number(process.env.ATTESTCOIN_POLL_INTERVAL_MS || 15_000),
        Number(process.env.ATTESTCOIN_WAIT_TIMEOUT_MS || 900_000),
      );
      const proofResult = await builder.getProof(request.txHash);
      if (!proofResult.success || !proofResult.data) throw new Error(proofResult.error || 'Proof builder returned no proof');

      request.proof = proofResult.data;
      request.status = 'PROOF_READY';
    } catch (error: any) {
      request.status = 'FAILED';
      request.error = error.message || 'Proof generation failed';
    }
  }

  static getVerifierPrecompile(): string {
    return blockProver.BLOCK_PROVER_PRECOMPILE_ADDRESS;
  }
}

export const attestcoinService = new AttestcoinService();
