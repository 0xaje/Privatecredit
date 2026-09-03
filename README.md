# PrivateCredit Graph

[![Live dApp App](https://img.shields.io/badge/Live_dApp-privatecredit--beige.vercel.app-0ea5e9?style=for-the-badge&logo=vercel)](https://privatecredit-beige.vercel.app/)
[![Render API Backend](https://img.shields.io/badge/Backend_API-privatecredit.onrender.com-10b981?style=for-the-badge&logo=render)](https://privatecredit.onrender.com/health)
[![Network](https://img.shields.io/badge/Creditcoin_CC3-Chain_102031-8b5cf6?style=for-the-badge)](https://creditcoin.blockscout.com)
[![Attestcoin Precompile](https://img.shields.io/badge/Attestcoin_Precompile-0x0FD2_Active-3b82f6?style=for-the-badge)](https://creditcoin.blockscout.com)

> **Creditcoin CC3 Testnet Hackathon Official Submission**  
> **Official Web dApp**: [https://privatecredit-beige.vercel.app/](https://privatecredit-beige.vercel.app/)  
> **Live API Gateway**: [https://privatecredit.onrender.com](https://privatecredit.onrender.com)  
> Autonomous Cross-Chain Credit Underwriting & Peer-to-Peer Lending Marketplace built natively for **Creditcoin CC3 Testnet** (`Chain ID 102031`), powered by the **Attestcoin Protocol** (formerly Universal Smart Contracts / USC) and Creditcoin's native `0x0FD2` BlockProver precompile.

---

## Executive Overview

Uncollateralized and under-collateralized lending in Web3 requires verifiable, tamper-proof credit history across disparate blockchains. **PrivateCredit Graph** brings a visual, graph-first intelligence workspace to credit underwriting.

By ingesting cross-chain reputation data (Ethereum Mainnet/Sepolia inflows, Arbitrum repayments, and cross-chain obligations) via the Attestcoin Protocol SDK (`@gluwa/usc-sdk`), evidence is proved against Creditcoin's native `0x0FD2` BlockProver precompile. Once verified on-chain via `USCVerifier.sol`, an off-chain Risk Engine evaluates the borrower's evidence graph to issue a deterministic **Eligibility Badge** and maximum **LTV / Credit Capacity** bounds on Creditcoin.

---

## Key System Features

### 1. Native Attestcoin Protocol & 0x0FD2 Precompile Proofing
- Uses the Attestcoin Protocol SDK (`@gluwa/usc-sdk`) proof builder service to construct SPV header continuity and Merkle receipt proofs.
- Executes `USCVerifier.verifyEvidence()` directly against Creditcoin's `0x0FD2` precompile.
- Rejects replayed evidence, unconfigured source tokens, and invalid cross-chain transfer semantics.

### 2. Graph-First Underwriting Terminal (DAG Visualizer)
- Visualizes borrower reputation as a Directed Acyclic Graph (DAG) using ReactFlow:
  - **Wallet Node**: Root credit identity.
  - **Evidence Node**: Verified cross-chain inflow / repayment records.
  - **Eligibility Node**: On-chain badge committing verified evidence history.
  - **Loan Node**: Active loans, interest rate, duration, and vault status.
  - **Auction Node**: Collateral liquidation Dutch auctions for defaulted loans.

### 3. Institutional Credit Marketplace & Vault Escrow
- **`LoanMarketplace.sol`**: Borrower request creation, max APR matching, and lender offer submission.
- **`LoanVault.sol`**: Escrow vault managing loan origination, collateral locking, interest calculation, and repayment releases.
- **`CapacityManager.sol`**: Prevents over-borrowing by enforcing active credit limits across multiple concurrent loans.

### 4. Collateral Liquidation Auctions
- **`DebtAuctionManager.sol`**: Lenders can trigger an on-chain Dutch auction for defaulted loans to liquidate locked collateral and recover principal.

### 5. Zero-Trust Auditor Workspace
- **`ArtefactRegistry.sol`**: Protocol auditors and judges can commit immutable keccak256 graph state snapshots to the Creditcoin ledger for complete historical auditability.

---

## Attestcoin Protocol Integration

The Attestcoin Protocol is the trust root of this system: no credit decision is reachable
without a proof that the `0x0FD2` BlockProver precompile has accepted.

**Integration path** ([`contracts/usc/USCVerifier.sol`](contracts/usc/USCVerifier.sol)):

1. **Proof construction (off-chain).** `AttestcoinService` calls the Attestcoin Protocol SDK
   (`@gluwa/usc-sdk`) proof builder to produce the SPV header-continuity proof and the Merkle
   receipt proof for a source-chain transaction.
2. **Native verification (on-chain).** `USCVerifier.verifyEvidence()` calls
   `INativeQueryVerifier.verify()` at `0x0000000000000000000000000000000000000FD2`. If the
   precompile returns false, the call reverts with `InvalidProof` and nothing is recorded.
3. **Independent semantic re-validation.** A passing proof establishes only that the transaction
   is real. `USCVerifier` then decodes the receipt with `EvmV1Decoder` and independently checks
   that the receipt succeeded, that a `Transfer` log came from a configured source token, and
   that the transfer direction matches the claimed evidence type (an INFLOW must credit the
   borrower; a REPAYMENT must debit them). Caller-supplied amounts are never trusted — the
   amount is taken from the decoded log.
4. **Replay protection, in three independent layers.** `processedQueries` rejects a re-submitted
   proof; `processedEvidence` rejects the same underlying transaction re-proved under a different
   proof envelope (for example at a different block height); `evidenceUsedForEligibility` prevents
   one verified inflow being spent for two eligibility badges.
5. **Eligibility issuance.** `registerEligibilityFromEvidence()` is the only path that can write a
   badge, and it consumes verified evidence IDs in strictly ascending order, which makes
   in-batch duplicates unrepresentable.

Each of these five properties is covered by the test suite in
[`test/USCVerifier.ts`](test/USCVerifier.ts), which installs a mock BlockProver at `0x0FD2` via
`setCode` so that both the accepting and rejecting precompile paths can be exercised locally.

---

## Live Creditcoin CC3 Testnet Deployment Registry

All core smart contracts are compiled with Solidity `0.8.23` (`viaIR` optimizer enabled) and deployed live on **Creditcoin CC3 Testnet (`Chain ID 102031`)**:

| Smart Contract | Deployed Contract Address | Explorer Link |
| :--- | :--- | :--- |
| **`LoanMarketplace`** | `0xDEf64f40AfFeFD2182148cdFCeF8DAf81EC99C9a` | [Blockscout](https://creditcoin.blockscout.com/address/0xDEf64f40AfFeFD2182148cdFCeF8DAf81EC99C9a) |
| **`LoanVault`** | `0x84e16815CfA7FacABac6678eC1B0CdE5Fc52B5AF` | [Blockscout](https://creditcoin.blockscout.com/address/0x84e16815CfA7FacABac6678eC1B0CdE5Fc52B5AF) |
| **`EligibilityRegistry`** | `0xd106C554567470b5a8a0894b3A210D175d4fD7BA` | [Blockscout](https://creditcoin.blockscout.com/address/0xd106C554567470b5a8a0894b3A210D175d4fD7BA) |
| **`CapacityManager`** | `0xBDCd79e468a05BaD60cc0822Df42c11B4e0E4f3D` | [Blockscout](https://creditcoin.blockscout.com/address/0xBDCd79e468a05BaD60cc0822Df42c11B4e0E4f3D) |
| **`DebtAuctionManager`** | `0x33526D6AF4d1A7c925274dA542Eb2b06eE342b72` | [Blockscout](https://creditcoin.blockscout.com/address/0x33526D6AF4d1A7c925274dA542Eb2b06eE342b72) |
| **`ArtefactRegistry`** | `0x4DbBd27F6e557860564bD1aa8e0596d62a2735C4` | [Blockscout](https://creditcoin.blockscout.com/address/0x4DbBd27F6e557860564bD1aa8e0596d62a2735C4) |
| **`USCVerifier`** | `0x6c35e07Ca0E0234220145F33f8Bedb41eFde45b6` | [Blockscout](https://creditcoin.blockscout.com/address/0x6c35e07Ca0E0234220145F33f8Bedb41eFde45b6) |
| **`EvmV1Decoder`** | `0x70BD41c4A9E7c849337549CD6EEb71266f2Ddd96` | [Blockscout](https://creditcoin.blockscout.com/address/0x70BD41c4A9E7c849337549CD6EEb71266f2Ddd96) |
| **`RepaymentRegistry`** | `0xa2DBeB94c0a151e071A6c29999FE1c6B38217b85` | [Blockscout](https://creditcoin.blockscout.com/address/0xa2DBeB94c0a151e071A6c29999FE1c6B38217b85) |
| **`Attestcoin BlockProver Precompile`** | `0x0000000000000000000000000000000000000FD2` | Native Precompile |

---

## Technical Architecture

```
                               ┌────────────────────────────────────────┐
                               │   Cross-Chain Source Transactions      │
                               │   (Ethereum Sepolia / Mainnet / Arb)   │
                               └──────────────────┬─────────────────────┘
                                                  │
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │   Attestcoin Protocol SDK (usc-sdk)    │
                               │   (SPV Header & Merkle Proof Gen)      │
                               └──────────────────┬─────────────────────┘
                                                  │
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │   Creditcoin Native 0x0FD2 Precompile  │
                               │   (On-Chain BlockProver Verification)  │
                               └──────────────────┬─────────────────────┘
                                                  │
                                                  ▼
 ┌──────────────────────┐      ┌────────────────────────────────────────┐      ┌──────────────────────┐
 │ Eligibility Registry │ ◄─── │           USCVerifier.sol              │ ───► │  Risk Policy Engine  │
 │ (On-Chain Badges)    │      │ (Validates Receipts & Transfers)       │      │  (Insight Scores)    │
 └──────────┬───────────┘      └────────────────────────────────────────┘      └──────────────────────┘
            │
            ▼
 ┌──────────────────────┐      ┌────────────────────────────────────────┐      ┌──────────────────────┐
 │ Capacity Manager     │ ◄─── │          LoanMarketplace.sol           │ ───► │  Debt Auction Mgr    │
 │ (Credit Line Bounds) │      │  & LoanVault.sol (Escrow Vault)        │      │  (Collateral Bids)   │
 └──────────────────────┘      └────────────────────────────────────────┘      └──────────────────────┘
```

---

## Repository Structure

```
contracts/              Solidity source files (*.sol) and unit tests (*.t.sol)
  ├── core/             LoanMarketplace, LoanVault, CapacityManager, DebtAuctionManager, etc.
  ├── usc/              USCVerifier, EvmV1Decoder
  └── interfaces/       Interface definitions for core system components
config/                 Deployment manifests (deployments.json, privatecredit-cc3-live-v3.json)
backend/                Express + TypeScript API server & risk policy engine
  ├── src/services/     GraphStore, AttestcoinService, EventStream (SSE), AssessmentService
  ├── src/policy/       PolicyEngine (Risk tier & LTV score calculator)
  └── src/routes/       REST endpoints for evidence, graph, loans, auctions, and judge view
frontend/               React + Vite + Wagmi v2 + RainbowKit v2 + ReactFlow dApp
  ├── src/components/   GraphCanvas, Inspector, CustomConnectButton, Nodes
  └── src/views/        ReputationView, LoansView, JudgeView
scripts/                Deployment & configuration scripts
test/                   Integration tests for Hardhat & Mocha
```

---

## Required Environment Setup

Copy `.env.example` to root and `backend/.env`. Sensitive private keys and environment variables are strictly ignored from source control.

### Root & Backend `.env`
```env
APP_MODE=live
CREDITCOIN_RPC_URL=https://rpc.cc3-testnet.creditcoin.network
CREDITCOIN_PROOF_BUILDER_URL=https://proof-gen-api.cc3-testnet.creditcoin.network/
DEPLOYER_PRIVATE_KEY=your_funded_deployer_key
USC_VERIFIER_ADDR=0x6c35e07Ca0E0234220145F33f8Bedb41eFde45b6
SOURCE_CHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
SOURCE_CHAIN_ID=11155111
SOURCE_CHAIN_KEY=1
```

### Frontend `.env` (`frontend/.env`)
```env
VITE_REOWN_PROJECT_ID=your_reown_project_id
VITE_USC_VERIFIER_ADDRESS=0x6c35e07Ca0E0234220145F33f8Bedb41eFde45b6
VITE_API_URL=/api
```

---

## Quickstart & Local Execution

### 1. Start the Backend API
```bash
cd backend
npm install
npm run typecheck
npm run dev
```
*Backend runs on `http://localhost:3001`.*

### 2. Start the Frontend App
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5174` (or `http://localhost:5173`).*

---

## Validation & Testing

Run the full automated test suite to verify contract invariants, policy engine logic, and frontend build integrity:

```bash
# Test smart contracts (20 tests: 5 Solidity unit, 15 integration/Attestcoin)
npm run compile
npm test

# Test backend API
cd backend && npm run typecheck

# Test frontend build
cd ../frontend && npx tsc -b --noEmit
```

---

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
