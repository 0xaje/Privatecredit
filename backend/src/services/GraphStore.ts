import { ethers } from 'ethers';
import { database } from './Database';
import { eventStream } from './EventStream';
import { config } from '../config';

export interface GraphNode {
  id: string;
  type: 'WALLET' | 'EVIDENCE' | 'ELIGIBILITY' | 'BORROW_REQUEST' | 'LOAN' | 'REPAYMENT' | 'AUCTION';
  data: Record<string, any>;
  verified: boolean;
  proofStatus?: 'PENDING_ATTESTATION' | 'PROOF_GENERATING' | 'PROOF_READY' | 'SUBMITTING' | 'VERIFIED' | 'FAILED' | 'UNSUPPORTED';
  uscEvidenceId?: string;
  sourceChainKey?: number;
  sourceBlock?: number;
  attestcoinRef?: string;
  creditcoinTxHash?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'INFLOW_TO' | 'REPAID_BY' | 'ELIGIBILITY_FOR' | 'BORROW_REQUESTED_BY' | 'FUNDED_BY' | 'COLLATERAL_FOR' | 'CONSUMES_CAPACITY' | 'AUCTIONED_FROM';
  verified: boolean;
}

const ELIGIBILITY_ABI = [
  'function isEligibilityValid(address borrower) external view returns (bool)',
  'function getEligibility(address borrower) external view returns (tuple(address borrower, uint8 riskTier, uint256 maxActiveCredit, uint256 maxLtvBps, uint256 validUntil, uint256 policyVersion, bytes32 evidenceCommitment, bytes32 attestcoinContext, uint256 nonce, bool active))',
];

const CAPACITY_ABI = [
  'function availableCapacity(address borrower) external view returns (uint256)',
  'function getUsedCapacity(address borrower) external view returns (uint256)',
];

const MARKETPLACE_ABI = [
  'function nextRequestId() external view returns (uint256)',
  'function requests(uint256 requestId) external view returns (tuple(uint256 requestId,address borrower,uint256 amount,uint256 maxAprBps,uint256 maxDuration,uint256 collateralAmount,uint8 status,uint256 createdAt))',
];

const VAULT_ABI = [
  'function nextLoanId() external view returns (uint256)',
  'function getLoan(uint256 loanId) external view returns (tuple(uint256 loanId,address borrower,address lender,uint256 principal,uint256 aprBps,uint256 startTime,uint256 duration,uint256 collateralAmount,uint256 repaidAmount,uint8 status))',
];

const provider = new ethers.JsonRpcProvider(config.rpcUrl);

export class GraphStore {
  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    const existing = database.getAllNodes();
    if (existing.length === 0) {
      this.seedDefaultProfiles();
    }
  }

  private seedDefaultProfiles(): void {
    // 1. Whale Profile
    const whale = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
    const wNodeId = `wallet_${whale}`;
    this.addNode({ id: wNodeId, type: 'WALLET', data: { address: whale, evidenceCount: 2, eligible: true }, verified: true });

    const ev1Id = `ev_whale_1`;
    this.addNode({
      id: ev1Id,
      type: 'EVIDENCE',
      data: {
        type: 'INFLOW',
        amount: '5000000000000000000',
        sourceChain: 'Ethereum Sepolia',
        sourceTxHash: '0x3aef91204859a1bc294857201948572019485720194857201948572019485720',
        verified: true,
        attestcoinRequestId: 'req_whale_inflow_1',
      },
      verified: true,
      proofStatus: 'VERIFIED',
    });
    this.addEdge({ id: `edge_w1`, source: wNodeId, target: ev1Id, type: 'INFLOW_TO', verified: true });

    const elWhale = `elig_whale`;
    this.addNode({
      id: elWhale,
      type: 'ELIGIBILITY',
      data: { riskTier: 0, maxActiveCredit: '10000000000000000000000', maxLtvBps: 6500, validUntil: Math.floor(Date.now() / 1000) + 2592000, policyVersion: 1 },
      verified: true,
    });
    this.addEdge({ id: `edge_w3`, source: wNodeId, target: elWhale, type: 'ELIGIBILITY_FOR', verified: true });
  }

  addNode(node: GraphNode): void {
    database.setNode(node.id, node);
    eventStream.broadcast('NODE_ADDED', node);
  }

  updateNode(id: string, patch: Partial<GraphNode>): GraphNode {
    const current = database.getNode(id);
    if (!current) throw new Error(`Node not found: ${id}`);
    const updated = { ...current, ...patch };
    database.setNode(id, updated);
    eventStream.broadcast('NODE_UPDATED', updated);
    return updated;
  }

  addEdge(edge: GraphEdge): void {
    database.setEdge(edge.id, edge);
    eventStream.broadcast('EDGE_ADDED', edge);
  }

  getNode(id: string): GraphNode | undefined {
    return database.getNode(id);
  }

  getAllNodes(): GraphNode[] {
    return database.getAllNodes();
  }

  getAllEdges(): GraphEdge[] {
    return database.getAllEdges();
  }

  async syncOnChainGraphForWallet(walletAddress: string): Promise<void> {
    const addr = walletAddress.toLowerCase();
    const wNodeId = `wallet_${addr}`;

    try {
      // 1. Fetch balance & ensure root wallet node
      const balanceWei = await provider.getBalance(walletAddress).catch(() => 0n);
      const balanceCTC = ethers.formatEther(balanceWei);

      if (!database.getNode(wNodeId)) {
        this.addNode({
          id: wNodeId,
          type: 'WALLET',
          data: {
            address: walletAddress,
            balance: balanceCTC,
            network: 'Creditcoin CC3 Testnet',
            eligible: false,
          },
          verified: true,
        });
      } else {
        this.updateNode(wNodeId, {
          data: {
            ...database.getNode(wNodeId)!.data,
            balance: balanceCTC,
          },
        });
      }

      // 2. Check On-Chain Eligibility
      if (config.addresses.eligibilityRegistry && config.addresses.eligibilityRegistry !== ethers.ZeroAddress) {
        const eligContract = new ethers.Contract(config.addresses.eligibilityRegistry, ELIGIBILITY_ABI, provider);
        const isValid = await eligContract.isEligibilityValid(walletAddress).catch(() => false);
        if (isValid) {
          const eligData = await eligContract.getEligibility(walletAddress);
          const eligNodeId = `elig_${addr}`;
          const maxCreditFmt = ethers.formatEther(eligData.maxActiveCredit);
          const ltvPct = Number(eligData.maxLtvBps) / 100;

          if (!database.getNode(eligNodeId)) {
            this.addNode({
              id: eligNodeId,
              type: 'ELIGIBILITY',
              data: {
                borrower: walletAddress,
                riskTier: Number(eligData.riskTier),
                maxActiveCredit: maxCreditFmt,
                maxLtvBps: Number(eligData.maxLtvBps),
                ltvPct,
                validUntil: Number(eligData.validUntil),
                policyVersion: Number(eligData.policyVersion),
              },
              verified: true,
            });
            this.addEdge({
              id: `edge_elig_${addr}`,
              source: wNodeId,
              target: eligNodeId,
              type: 'ELIGIBILITY_FOR',
              verified: true,
            });
          }
          this.updateNode(wNodeId, { data: { ...database.getNode(wNodeId)!.data, eligible: true } });
        }
      }

      // 3. Check On-Chain Loans
      if (config.addresses.loanVault && config.addresses.loanVault !== ethers.ZeroAddress) {
        const vaultContract = new ethers.Contract(config.addresses.loanVault, VAULT_ABI, provider);
        const nextLoanId = await vaultContract.nextLoanId().catch(() => 1n);
        const count = Number(nextLoanId);

        for (let i = 1; i < count; i++) {
          const loan = await vaultContract.getLoan(i);
          if (loan.borrower.toLowerCase() === addr || loan.lender.toLowerCase() === addr) {
            const loanNodeId = `loan_${loan.loanId.toString()}`;
            const principalFmt = ethers.formatEther(loan.principal);
            const collateralFmt = ethers.formatEther(loan.collateralAmount);
            const aprPct = Number(loan.aprBps) / 100;

            if (!database.getNode(loanNodeId)) {
              this.addNode({
                id: loanNodeId,
                type: 'LOAN',
                data: {
                  loanId: loan.loanId.toString(),
                  borrower: loan.borrower,
                  lender: loan.lender,
                  principal: principalFmt,
                  collateral: collateralFmt,
                  aprPct,
                  status: Number(loan.status) === 0 ? 'ACTIVE' : Number(loan.status) === 1 ? 'REPAID' : 'DEFAULTED',
                },
                verified: true,
              });
              this.addEdge({
                id: `edge_loan_${loan.loanId.toString()}_${addr}`,
                source: wNodeId,
                target: loanNodeId,
                type: loan.borrower.toLowerCase() === addr ? 'CONSUMES_CAPACITY' : 'FUNDED_BY',
                verified: true,
              });
            }
          }
        }
      }

      // 4. Check On-Chain Borrow Requests
      if (config.addresses.loanMarketplace && config.addresses.loanMarketplace !== ethers.ZeroAddress) {
        const marketContract = new ethers.Contract(config.addresses.loanMarketplace, MARKETPLACE_ABI, provider);
        const nextReqId = await marketContract.nextRequestId().catch(() => 1n);
        const count = Number(nextReqId);

        for (let i = 1; i < count; i++) {
          const req = await marketContract.requests(i);
          if (req.borrower.toLowerCase() === addr) {
            const reqNodeId = `request_${req.requestId.toString()}`;
            const amountFmt = ethers.formatEther(req.amount);
            const maxAprPct = Number(req.maxAprBps) / 100;

            if (!database.getNode(reqNodeId)) {
              this.addNode({
                id: reqNodeId,
                type: 'BORROW_REQUEST',
                data: {
                  requestId: req.requestId.toString(),
                  borrower: req.borrower,
                  amount: amountFmt,
                  maxAprPct,
                  status: Number(req.status) === 0 ? 'OPEN' : Number(req.status) === 1 ? 'FUNDED' : 'CANCELLED',
                },
                verified: true,
              });
              this.addEdge({
                id: `edge_req_${req.requestId.toString()}_${addr}`,
                source: wNodeId,
                target: reqNodeId,
                type: 'BORROW_REQUESTED_BY',
                verified: true,
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`Could not sync on-chain graph for ${walletAddress}:`, err.message);
    }
  }

  async getGraphForBorrower(borrower: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    await this.syncOnChainGraphForWallet(borrower);

    const borrowerNodeId = `wallet_${borrower.toLowerCase()}`;
    const connectedNodeIds = new Set<string>([borrowerNodeId]);
    const relevantEdges: GraphEdge[] = [];

    const allEdges = database.getAllEdges();
    for (const edge of allEdges) {
      if (edge.source === borrowerNodeId || edge.target === borrowerNodeId) {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
        relevantEdges.push(edge);
      }
    }

    return {
      nodes: [...connectedNodeIds].map(id => database.getNode(id)).filter(Boolean) as GraphNode[],
      edges: relevantEdges,
    };
  }
}

export const graphStore = new GraphStore();
