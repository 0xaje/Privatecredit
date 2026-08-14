# PrivateCredit Graph

PrivateCredit Graph is a cross-chain credit-underwriting and lending marketplace for **Creditcoin CC3 testnet**. Source-chain evidence is proved through Attestcoin USC, verified on Creditcoin through the native `0x0FD2` Block Prover precompile, and only then becomes eligible for deterministic policy assessment.

## Architecture

| Layer | Implementation |
|---|---|
| Solidity | Hardhat 3, Solidity 0.8.23, OpenZeppelin 5, Ignition deployment |
| USC verification | `USCVerifier` calls the native `0x0FD2` precompile, decodes verified receipts, validates source-token `Transfer` events, and rejects replayed queries/evidence |
| Eligibility | `EligibilityRegistry` accepts writes only from `USCVerifier` and enforces policy-tier credit/LTV bounds |
| Lending | `LoanMarketplace`, `LoanVault`, `CapacityManager`, and `RepaymentRegistry` enforce eligibility, LTV, exact repayment, default locks, and one-time outcomes |
| Backend | Express + TypeScript + ethers read provider; proof-builder orchestration and transaction-calldata preparation only |
| Frontend | React + Vite + TypeScript + Reown AppKit + Ethers adapter |
| State | Runtime graph state is in memory; production deployments must provide an external persistence layer before horizontal scaling |

## Creditcoin CC3 testnet

The authoritative deployment manifest is [`config/deployments.json`](config/deployments.json). It records chain ID `102031`, the CC3 RPC, explorer, deployed core addresses, the Attestcoin Proof Builder URL, and the native precompile addresses. `USC_VERIFIER_ADDR` remains an explicit post-deployment configuration value because each deployment produces a new verifier address.

The live backend uses `APP_MODE=live`. Local execution is available only through the explicit `APP_MODE=local-test` setting and never silently changes the live path to localhost or synthetic evidence.

## Required environment

Copy `.env.example` to the root and `backend/.env` as appropriate for the command being run. Do not place borrower or lender private keys in the backend. The deployer key is used only by the deployment command and is not used to sign user-facing loan or eligibility actions.

```env
APP_MODE=live
CREDITCOIN_RPC_URL=https://rpc.cc3-testnet.creditcoin.network
CREDITCOIN_PROOF_BUILDER_URL=https://proof-gen-api.cc3-testnet.creditcoin.network/
DEPLOYER_PRIVATE_KEY=
USC_VERIFIER_ADDR=
SOURCE_CHAIN_RPC_URL=
SOURCE_CHAIN_ID=11155111
SOURCE_CHAIN_KEY=1
SOURCE_TOKEN_ADDRESS=
```

The frontend additionally requires a Reown Cloud project ID and the deployed verifier address:

```env
VITE_REOWN_PROJECT_ID=
VITE_USC_VERIFIER_ADDRESS=
VITE_API_URL=/api
```

The source chain and token are deliberately explicit. The verifier rejects unsupported source chains, unconfigured tokens, failed receipts, wrong emitting contracts, wrong sender/receiver semantics, zero transfers, and duplicate proof identities.

## Deployment

Install dependencies, compile, and deploy the complete Ignition module:

```bash
npm install
npm run compile
npm run deploy:testnet
```

After deployment, update `config/deployments.json` and `USC_VERIFIER_ADDR` with the emitted `USCVerifier` address. The deployment wiring sets `USCVerifier` as the sole eligibility registrar, authorizes `LoanVault` for capacity and repayment state transitions, and does not grant the backend a user-signing role. Before accepting live evidence, the verifier owner must configure both the source-chain key and source token through owner-controlled transactions:

```text
USCVerifier.setSourceChainKey(1)                 # Ethereum Sepolia in CC3 USC
USCVerifier.setSourceToken(11155111, <token>)    # source chain ID and ERC-20 token
```

The source chain key, source chain ID, and token are enforced by the verifier for every proof.

## Run the application

Start the backend with live configuration:

```bash
cd backend
npm install
npm run typecheck
npm start
```

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Connect through Reown AppKit, switch to Creditcoin CC3 testnet, request an Attestcoin proof for a mined supported source-chain transaction, and approve the Creditcoin `USCVerifier.verifyEvidence` transaction. Eligibility, loan requests, lender offers, offer acceptance, repayments, and artefact commits are all signed by the connected wallet. The backend only reads chain state or prepares calldata.

## Validation commands

```bash
npm run compile
npm test
cd backend && npm run typecheck && npm test
cd ../frontend && npm run build && npm run lint
```

The contract integration test uses a local fixture only to exercise loan lifecycle invariants. It does not represent live USC proof success; live proof success requires the Creditcoin precompile and an actual Attestcoin proof. The backend guard test verifies that invalid evidence is rejected and that no borrower/lender private-key execution or synthetic confirmation path is available.
