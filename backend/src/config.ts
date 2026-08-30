import dotenv from 'dotenv';
import legacyDeployment from '../../config/deployments.json';
import liveDeployment from '../../config/privatecredit-cc3-live-v3.json';

dotenv.config();

const deployment = {
  ...legacyDeployment,
  ...liveDeployment,
  contracts: liveDeployment.contracts,
};

export type AppMode = 'live' | 'local-test';

const rawMode = process.env.APP_MODE || 'live';
if (rawMode !== 'live' && rawMode !== 'local-test') {
  throw new Error(`Unsupported APP_MODE: ${rawMode}. Use live or local-test.`);
}

const appMode = rawMode as AppMode;
const isLive = appMode === 'live';
const rpcUrl = isLive
  ? (process.env.CREDITCOIN_RPC_URL || deployment.rpcUrl)
  : (process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545');

const addresses = {
  artefactRegistry: process.env.ARTEFACT_REGISTRY_ADDR || deployment.contracts.artefactRegistry,
  eligibilityRegistry: process.env.ELIGIBILITY_REGISTRY_ADDRESS || deployment.contracts.eligibilityRegistry,
  repaymentRegistry: process.env.REPAYMENT_REGISTRY_ADDR || deployment.contracts.repaymentRegistry,
  capacityManager: process.env.CAPACITY_MANAGER_ADDR || deployment.contracts.capacityManager,
  loanVault: process.env.LOAN_VAULT_ADDR || deployment.contracts.loanVault,
  loanMarketplace: process.env.MARKETPLACE_ADDR || deployment.contracts.loanMarketplace,
  debtAuctionManager: process.env.DEBT_AUCTION_MANAGER_ADDR || deployment.contracts.debtAuctionManager,
  uscVerifier: process.env.USC_VERIFIER_ADDR || deployment.contracts.uscVerifier,
};

if (isLive && !addresses.uscVerifier) {
  throw new Error('USC_VERIFIER_ADDR is required in live mode after deployment.');
}

if (isLive && !process.env.CREDITCOIN_PROOF_BUILDER_URL) {
  process.env.CREDITCOIN_PROOF_BUILDER_URL = deployment.attestcoin.proofBuilderUrl;
}

export const config = {
  appMode,
  isLive,
  chainId: deployment.chainId,
  rpcUrl,
  proofBuilderUrl: process.env.CREDITCOIN_PROOF_BUILDER_URL || deployment.attestcoin.proofBuilderUrl,
  explorerUrl: process.env.CREDITCOIN_EXPLORER || deployment.explorerUrl,
  sourceToken: process.env.SOURCE_TOKEN_ADDRESS || '',
  sourceChainKey: Number(process.env.SOURCE_CHAIN_KEY || '1'),
  sourceChainId: Number(process.env.SOURCE_CHAIN_ID || '11155111'),
  addresses,
  port: Number(process.env.PORT || '3001'),
};

if (config.isLive && !config.sourceToken) {
  console.warn('SOURCE_TOKEN_ADDRESS is not configured; USC Transfer evidence will be unavailable until configured.');
}

export function assertLive(): void {
  if (!config.isLive) throw new Error('This operation is available only in APP_MODE=live.');
}
