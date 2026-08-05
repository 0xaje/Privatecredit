# PrivateCredit Graph

A cross-chain credit underwriting and lending marketplace built on **Creditcoin + Attestcoin Protocol**.
This repo contains the smart contracts, the Risk Policy Engine, and the API backend.

## Architecture
- **Contracts**: Smart contracts managing credit capacity, borrowing, and lending (OpenZeppelin + Hardhat).
- **Backend API**: Express + TypeScript server connecting the frontend to the blockchain via Ethers.js.
- **Attestcoin**: Verifies cross-chain financial activity using `@gluwa/usc-sdk` (Creditcoin USC).

---

## 🚀 Running the Project (Mocked Local Mode)

By default, the backend and contracts are configured to run locally against a Hardhat node using mocked Attestcoin data, allowing rapid frontend iteration without requiring testnet tokens.

1. **Start the Local Blockchain**:
   ```bash
   npx hardhat node
   ```
2. **Deploy Contracts Locally** (in a new terminal):
   ```bash
   npm run deploy:local
   ```
   *(If prompted, confirm the deployment by typing `y`)*
3. **Start the Backend API**:
   ```bash
   cd backend
   npm run dev
   ```

---

## 🌐 Transitioning to Live Testnet (Phase 5)

The project is fully ready for the official **Creditcoin Testnet** and the real **Attestcoin Protocol**. All code is already in the repository and secured behind feature flags. 

Once your deployer wallet is funded with **tCTC** (testnet tokens), follow these steps:

### 1. Configure the Environment
1. Copy `.env.example` to `.env` in both the root directory and the `backend` directory.
2. Insert your funded `DEPLOYER_PRIVATE_KEY` (ensure it has tCTC from the Discord faucet).

### 2. Deploy to Creditcoin Testnet
From the root directory, run the official testnet deployment script:
```bash
npm run deploy:testnet
```
This will compile and deploy all core contracts to Chain ID 102031. Note the deployed contract addresses.

### 3. Flip the Feature Flags
In the `backend/.env` file, enable the real-world integrations:
```env
USE_REAL_NETWORK=true
USE_REAL_ATTESTCOIN=true
```
*(Optionally, update the contract addresses in `.env` if they changed during deployment).*

### 4. Run the Live Backend
Restart the backend API:
```bash
cd backend
npm run dev
```
The API will now route all traffic to the `creditcoinTestnet`, use the real funded wallets to execute transactions, and the `AttestcoinService` will verify incoming cross-chain events against the live `0x0FD2` precompile via the USC SDK!
