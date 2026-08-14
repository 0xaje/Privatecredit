import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { ethers } from 'ethers';

const EXPECTED_CHAIN_ID = 102031n;
const EXPECTED_DEPLOYER = '0xD29CC27f6D1545158a935EC97001ab3967FA4ee1';
const DEFAULT_RPC_URL = 'https://rpc.cc3-testnet.creditcoin.network';

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
  throw new Error('DEPLOYER_PRIVATE_KEY is required and must be injected as a runtime secret.');
}

let deployerAddress;
try {
  deployerAddress = ethers.getAddress(new ethers.Wallet(privateKey).address);
} catch {
  throw new Error('DEPLOYER_PRIVATE_KEY is invalid.');
}

if (deployerAddress !== ethers.getAddress(EXPECTED_DEPLOYER)) {
  throw new Error(`Deployment wallet mismatch: expected ${EXPECTED_DEPLOYER}, got ${deployerAddress}.`);
}

const rpcUrl = process.env.CREDITCOIN_RPC_URL || DEFAULT_RPC_URL;
const provider = new ethers.JsonRpcProvider(rpcUrl);
const network = await provider.getNetwork();
if (network.chainId !== EXPECTED_CHAIN_ID) {
  throw new Error(`Wrong deployment chain: expected ${EXPECTED_CHAIN_ID}, got ${network.chainId}.`);
}

console.log(`Deployment preflight passed: creditcoinTestnet chain ${network.chainId}, deployer ${deployerAddress}.`);

const hardhatArgs = [
  'hardhat',
  'ignition',
  'deploy',
  'ignition/modules/PrivateCredit.ts',
  '--network',
  'creditcoinTestnet',
];

let result;
if (process.platform === 'win32') {
  result = spawnSync(
    process.env.ComSpec || 'cmd.exe',
    ['/d', '/s', '/c', 'npx', ...hardhatArgs],
    {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
    },
  );
} else {
  result = spawnSync(
    'npx',
    hardhatArgs,
    {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
    },
  );
}

if (result.error) throw result.error;
process.exit(typeof result.status === 'number' ? result.status : 1);
