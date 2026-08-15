import { ethers } from 'ethers';
import { blockProver, proofProvider } from '@gluwa/usc-sdk';
import type { ContinuityResponse } from '@gluwa/usc-sdk/dist/proof-provider';
import type { MerkleProofEntry } from '@gluwa/usc-sdk/dist/proof-provider/merkle';
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
  proof?: ContinuityResponse;
  creditcoinTxHash?: string;
  evidenceId?: string;
  error?: string;
  feature?: CreditFeature;
}

export interface PreparedVerification {
  to: string;
  data: string;
  value: 0;
  requestId: string;
  borrower: string;
  sourceTxHash: string;
  chainId: number;
  chainKey: number;
  blockHeight: number;
}

const USC_VERIFIER_ABI = [
  'function verifyEvidence(uint8 evidenceType,address borrower,uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,bytes32 merkleRoot,tuple(bytes32 hash,bool isLeft)[] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots)',
  'function verifiedEvidence(bytes32 evidenceId) external view returns (tuple(address borrower,uint8 evidenceType,uint64 chainKey,uint64 blockHeight,address token,address sender,uint256 amount,bytes32 transactionHash,bool active))',
  'event EvidenceVerified(bytes32 indexed queryId,bytes32 indexed evidenceId,address indexed borrower,uint64 chainKey,uint64 blockHeight,address token,address sender,uint256 amount,uint8 evidenceType,bytes32 transactionHash)',
];

const verifierInterface = new ethers.Interface(USC_VERIFIER_ABI);

function requireBytes32(value: unknown, label: string): string {
  if (typeof value !== 'string' || !ethers.isHexString(value, 32)) {
    throw new Error(`${label} must be a 32-byte hex value`);
  }
  return value;
}

function requireEncodedBytes(value: unknown, label: string): string {
  if (typeof value !== 'string' || !ethers.isHexString(value) || value === '0x') {
    throw new Error(`${label} must be non-empty encoded transaction bytes`);
  }
  return value;
}

function requireSafeUint(value: unknown, label: string): number {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return numberValue;
}

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

  prepareVerification(requestId: string): PreparedVerification {
    const request = this.get(requestId);
    if (request.status !== 'PROOF_READY') {
      throw new Error(`Request is not PROOF_READY: ${request.status}`);
    }
    if (request.chainId !== config.sourceChainId) {
      throw new Error(`Request source chain ${request.chainId} does not match configured chain ${config.sourceChainId}`);
    }
    if (!request.proof) throw new Error('PROOF_READY request has no proof data');
    if (!config.addresses.uscVerifier || !ethers.isAddress(config.addresses.uscVerifier)) {
      throw new Error('USC_VERIFIER_ADDR is not configured with a valid address');
    }

    const proof = request.proof;
    const proofChainKey = requireSafeUint(proof.chainKey, 'Proof chainKey');
    const blockHeight = requireSafeUint(proof.headerNumber, 'Proof headerNumber');
    if (proofChainKey !== request.chainKey) {
      throw new Error(`Proof chainKey ${proofChainKey} does not match request chainKey ${request.chainKey}`);
    }
    if (request.sourceBlock !== undefined && blockHeight !== request.sourceBlock) {
      throw new Error(`Proof block ${blockHeight} does not match source block ${request.sourceBlock}`);
    }
    if (typeof proof.txHash !== 'string' || proof.txHash.toLowerCase() !== request.txHash.toLowerCase()) {
      throw new Error('Proof transaction hash does not match the verification request');
    }

    const merkleProof = proof.merkleProof;
    if (!merkleProof || typeof merkleProof !== 'object' || !Array.isArray(merkleProof.siblings)) {
      throw new Error('Proof is missing its SDK Merkle proof and sibling array');
    }
    const siblings = merkleProof.siblings.map((entry: MerkleProofEntry, index: number) => {
      if (!entry || typeof entry !== 'object' || typeof entry.isLeft !== 'boolean') {
        throw new Error(`Merkle sibling ${index} has an invalid isLeft flag`);
      }
      return {
        hash: requireBytes32(entry.hash, `Merkle sibling ${index} hash`),
        isLeft: entry.isLeft,
      };
    });

    const continuityProof = proof.continuityProof;
    if (!continuityProof || typeof continuityProof !== 'object' || !Array.isArray(continuityProof.roots)) {
      throw new Error('Proof is missing its SDK continuity proof and roots array');
    }
    const continuityRoots = continuityProof.roots.map((root: string, index: number) =>
      requireBytes32(root, `Continuity root ${index}`),
    );

    const encodedTransaction = requireEncodedBytes(proof.txBytes, 'Proof txBytes');
    const merkleRoot = requireBytes32(merkleProof.root, 'Merkle root');
    const lowerEndpointDigest = requireBytes32(
      continuityProof.lowerEndpointDigest,
      'Continuity lowerEndpointDigest',
    );
    const evidenceType = request.eventType === 'REPAYMENT' ? 1 : 0;
    const borrower = ethers.getAddress(request.borrower);
    const to = ethers.getAddress(config.addresses.uscVerifier);
    const data = verifierInterface.encodeFunctionData('verifyEvidence', [
      evidenceType,
      borrower,
      proofChainKey,
      blockHeight,
      encodedTransaction,
      merkleRoot,
      siblings,
      lowerEndpointDigest,
      continuityRoots,
    ]);

    return {
      to,
      data,
      value: 0,
      requestId,
      borrower,
      sourceTxHash: request.txHash,
      chainId: request.chainId,
      chainKey: proofChainKey,
      blockHeight,
    };
  }

  async completeVerification(requestId: string, creditcoinTxHash: string, evidenceId: string): Promise<CreditFeature> {
    const request = this.get(requestId);
    const network = await this.creditcoinProvider.getNetwork();
    if (network.chainId !== BigInt(config.chainId)) {
      request.status = 'FAILED';
      request.error = `Wrong Creditcoin network: expected chain ID ${config.chainId}, got ${network.chainId}`;
      throw new Error(request.error);
    }
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
    if (receipt.from?.toLowerCase() !== request.borrower.toLowerCase()) {
      request.status = 'FAILED';
      request.error = 'Creditcoin transaction signer does not match the request borrower';
      throw new Error(request.error);
    }

    const expectedEvidenceId = evidenceId.toLowerCase();
    const expectedEvidenceType = request.eventType === 'REPAYMENT' ? 1 : 0;
    let emittedEvidenceId: string | undefined;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== config.addresses.uscVerifier.toLowerCase()) continue;
      try {
        const parsed = verifierInterface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === 'EvidenceVerified') {
          emittedEvidenceId = String(parsed.args.evidenceId);
          if (emittedEvidenceId.toLowerCase() !== expectedEvidenceId) {
            request.status = 'FAILED';
            request.error = 'EvidenceVerified event evidence ID does not match completion payload';
            throw new Error(request.error);
          }
          if (String(parsed.args.borrower).toLowerCase() !== request.borrower.toLowerCase()) {
            request.status = 'FAILED';
            request.error = 'EvidenceVerified event borrower does not match the request borrower';
            throw new Error(request.error);
          }
          if (Number(parsed.args.chainKey) !== request.chainKey) {
            request.status = 'FAILED';
            request.error = 'EvidenceVerified event chain key does not match the request';
            throw new Error(request.error);
          }
          if (Number(parsed.args.evidenceType) !== expectedEvidenceType) {
            request.status = 'FAILED';
            request.error = 'EvidenceVerified event type does not match the request';
            throw new Error(request.error);
          }
          if (request.sourceBlock !== undefined && Number(parsed.args.blockHeight) !== request.sourceBlock) {
            request.status = 'FAILED';
            request.error = 'EvidenceVerified event block does not match the request';
            throw new Error(request.error);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('EvidenceVerified event')) throw error;
      }
    }
    if (!emittedEvidenceId) {
      request.status = 'FAILED';
      request.error = 'Creditcoin receipt is missing the USCVerifier EvidenceVerified event';
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
    if (Number(evidence.evidenceType) !== expectedEvidenceType) {
      request.status = 'FAILED';
      request.error = 'Verified evidence type does not match the request';
      throw new Error(request.error);
    }
    if (request.sourceBlock !== undefined && Number(evidence.blockHeight) !== request.sourceBlock) {
      request.status = 'FAILED';
      request.error = 'Verified evidence block does not match the proof request';
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
      creditcoinTxHash,
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
