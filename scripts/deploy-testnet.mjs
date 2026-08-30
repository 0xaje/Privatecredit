import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';

const EXPECTED_CHAIN_ID = 102031n;
const EXPECTED_DEPLOYER = process.env.EXPECTED_DEPLOYER || '';
const DEFAULT_RPC_URL = 'https://rpc.cc3-testnet.creditcoin.network';
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID || 'privatecredit-cc3-live-v4';

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
  throw new Error('DEPLOYER_PRIVATE_KEY is required and must be set in your .env file.');
}

let deployerAddress;
try {
  deployerAddress = ethers.getAddress(new ethers.Wallet(privateKey).address);
} catch {
  throw new Error('DEPLOYER_PRIVATE_KEY is invalid.');
}

if (EXPECTED_DEPLOYER && deployerAddress !== ethers.getAddress(EXPECTED_DEPLOYER)) {
  throw new Error(`Deployment wallet mismatch: expected ${EXPECTED_DEPLOYER}, got ${deployerAddress}.`);
}

const rpcUrl = process.env.CREDITCOIN_RPC_URL || DEFAULT_RPC_URL;
const provider = new ethers.JsonRpcProvider(rpcUrl);
const network = await provider.getNetwork();
if (network.chainId !== EXPECTED_CHAIN_ID) {
  throw new Error(`Wrong deployment chain: expected ${EXPECTED_CHAIN_ID}, got ${network.chainId}.`);
}

const balance = await provider.getBalance(deployerAddress);
console.log(`Deployer ${deployerAddress} balance: ${ethers.formatEther(balance)} tCTC on Creditcoin CC3.`);
if (balance === 0n) {
  throw new Error(`Deployer wallet ${deployerAddress} has 0 tCTC. Please fund it from the CC3 testnet faucet.`);
}

console.log(
  `Deployment preflight passed: creditcoinTestnet chain ${network.chainId}, deployer ${deployerAddress}.`,
);

const hardhatArgs = [
  'hardhat',
  '--build-profile',
  'production',
  'ignition',
  'deploy',
  'ignition/modules/PrivateCredit.ts',
  '--network',
  'creditcoinTestnet',
  '--deployment-id',
  DEPLOYMENT_ID,
];

let result;
if (process.platform === 'win32') {
  result = spawnSync(
    process.env.ComSpec || 'cmd.exe',
    ['/d', '/s', '/c', 'npx', ...hardhatArgs],
    {
      stdio: ['pipe', 'inherit', 'inherit'],
      input: 'y\n',
      env: process.env,
      cwd: process.cwd(),
    },
  );
} else {
  result = spawnSync(
    'npx',
    hardhatArgs,
    {
      stdio: ['pipe', 'inherit', 'inherit'],
      input: 'y\n',
      env: process.env,
      cwd: process.cwd(),
    },
  );
}

if (result.error) throw result.error;
if (typeof result.status !== 'number' || result.status !== 0) {
  process.exit(typeof result.status === 'number' ? result.status : 1);
}

const deploymentAddressFile = path.join(
  process.cwd(),
  'ignition',
  'deployments',
  DEPLOYMENT_ID,
  'deployed_addresses.json',
);
if (!existsSync(deploymentAddressFile)) {
  throw new Error(`Successful deployment did not produce ${deploymentAddressFile}.`);
}

const deployed = JSON.parse(readFileSync(deploymentAddressFile, 'utf8'));
const addressFor = (contractName) => {
  const key = `PrivateCreditModule#${contractName}`;
  const address = deployed[key];
  if (typeof address !== 'string' || !ethers.isAddress(address)) {
    throw new Error(`Missing deployed address for ${key}.`);
  }
  return ethers.getAddress(address);
};

const contracts = {
  eligibilityRegistry: addressFor('EligibilityRegistry'),
  evmV1Decoder: addressFor('EvmV1Decoder'),
  repaymentRegistry: addressFor('RepaymentRegistry'),
  artefactRegistry: addressFor('ArtefactRegistry'),
  capacityManager: addressFor('CapacityManager'),
  uscVerifier: addressFor('USCVerifier'),
  loanVault: addressFor('LoanVault'),
  loanMarketplace: addressFor('LoanMarketplace'),
  debtAuctionManager: addressFor('DebtAuctionManager'),
};

const exportPath = path.join(
  process.cwd(),
  'config',
  'privatecredit-cc3-live-v3.json',
);
const exportPayload = {
  deploymentId: DEPLOYMENT_ID,
  network: 'creditcoinTestnet',
  chainId: Number(network.chainId),
  rpcUrl,
  contracts,
};
writeFileSync(exportPath, `${JSON.stringify(exportPayload, null, 2)}\n`, 'utf8');
console.log(`New deployment addresses exported to ${exportPath}`);

const deploymentsJsonPath = path.join(process.cwd(), 'config', 'deployments.json');
if (existsSync(deploymentsJsonPath)) {
  const currentDeployments = JSON.parse(readFileSync(deploymentsJsonPath, 'utf8'));
  currentDeployments.contracts = { ...currentDeployments.contracts, ...contracts };
  writeFileSync(deploymentsJsonPath, `${JSON.stringify(currentDeployments, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify(contracts, null, 2));
