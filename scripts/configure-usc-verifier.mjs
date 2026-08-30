import 'dotenv/config';
import { ethers } from 'ethers';

const CREDITCOIN_RPC_URL = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const EXPECTED_CHAIN_ID = 102031n;
const USC_VERIFIER_ADDRESS = process.env.USC_VERIFIER_ADDR || '0xFE502a51765a219b76a4Ed3Ba7899c43436e4399';
const EXPECTED_SOURCE_CHAIN_ID = BigInt(process.env.SOURCE_CHAIN_ID || '11155111');
const EXPECTED_SOURCE_CHAIN_KEY = BigInt(process.env.SOURCE_CHAIN_KEY || '1');
const EXPECTED_SOURCE_TOKEN = process.env.SOURCE_TOKEN_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

const USC_VERIFIER_ABI = [
  'function owner() view returns (address)',
  'function sourceChainId() view returns (uint256)',
  'function sourceChainKey() view returns (uint64)',
  'function sourceToken() view returns (address)',
  'function setSourceChainKey(uint64 _sourceChainKey)',
  'function setSourceToken(uint256 _sourceChainId, address _sourceToken)',
];

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
  throw new Error('DEPLOYER_PRIVATE_KEY is required in your .env file.');
}

const provider = new ethers.JsonRpcProvider(CREDITCOIN_RPC_URL);
const network = await provider.getNetwork();
if (network.chainId !== EXPECTED_CHAIN_ID) {
  throw new Error(`Wrong network: expected chain ID ${EXPECTED_CHAIN_ID}, got ${network.chainId}.`);
}

let signer;
try {
  signer = new ethers.Wallet(privateKey, provider);
} catch {
  throw new Error('DEPLOYER_PRIVATE_KEY is invalid.');
}

const signerAddress = ethers.getAddress(signer.address);
const verifierAddress = ethers.getAddress(USC_VERIFIER_ADDRESS);
const sourceTokenAddress = ethers.getAddress(EXPECTED_SOURCE_TOKEN);
const bytecode = await provider.getCode(verifierAddress);
if (bytecode === '0x') {
  throw new Error(`No contract bytecode found at USCVerifier ${verifierAddress}.`);
}

const verifier = new ethers.Contract(verifierAddress, USC_VERIFIER_ABI, signer);
const owner = ethers.getAddress(await verifier.owner());
if (owner !== signerAddress) {
  throw new Error(`USCVerifier owner mismatch: expected ${signerAddress}, got ${owner}.`);
}

const readConfiguration = async () => ({
  sourceChainId: BigInt(await verifier.sourceChainId()),
  sourceChainKey: BigInt(await verifier.sourceChainKey()),
  sourceToken: ethers.getAddress(await verifier.sourceToken()),
});

const current = await readConfiguration();
const transactionHashes = [];

if (current.sourceChainKey !== EXPECTED_SOURCE_CHAIN_KEY) {
  const transaction = await verifier.setSourceChainKey(EXPECTED_SOURCE_CHAIN_KEY);
  transactionHashes.push(transaction.hash);
  await transaction.wait();
}

if (
  current.sourceChainId !== EXPECTED_SOURCE_CHAIN_ID ||
  current.sourceToken !== sourceTokenAddress
) {
  const transaction = await verifier.setSourceToken(
    EXPECTED_SOURCE_CHAIN_ID,
    sourceTokenAddress,
  );
  transactionHashes.push(transaction.hash);
  await transaction.wait();
}

const finalConfiguration = await readConfiguration();
if (
  finalConfiguration.sourceChainId !== EXPECTED_SOURCE_CHAIN_ID ||
  finalConfiguration.sourceChainKey !== EXPECTED_SOURCE_CHAIN_KEY ||
  finalConfiguration.sourceToken !== sourceTokenAddress
) {
  throw new Error('USCVerifier configuration verification failed after transaction confirmation.');
}

console.log(
  JSON.stringify(
    {
      network: 'Creditcoin CC3 testnet',
      chainId: Number(EXPECTED_CHAIN_ID),
      uscVerifier: verifierAddress,
      owner,
      transactionHashes,
      configuration: {
        sourceChainId: finalConfiguration.sourceChainId.toString(),
        sourceChainKey: finalConfiguration.sourceChainKey.toString(),
        sourceToken: finalConfiguration.sourceToken,
      },
    },
    null,
    2,
  ),
);
