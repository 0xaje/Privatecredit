import { ethers } from 'ethers';
import EligibilityRegistryABI from '../abi/EligibilityRegistry.json';
import LoanMarketplaceABI from '../abi/LoanMarketplace.json';
import LoanVaultABI from '../abi/LoanVault.json';

const API_BASE = '/api';

// Paste testnet addresses here after deployment completes:
const ADDRESSES = {
  eligibilityRegistry: "0xbC5D48b7CcC4ABc008A470f121Ba7DAfDC28a8Df",
  loanMarketplace: "0x0Fdc9F1493190C2DE013F241A70c6dE3A287f36f",
  loanVault: "0xC5E239991E3AaB8181177506f42802242384b9E1"
};

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

async function getSigner() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No web3 wallet detected (e.g., MetaMask).");
  const provider = new ethers.BrowserProvider(eth);
  return provider.getSigner();
}

// Attestcoin
export const api = {
  // Attestcoin verification
  verify: (chainId: string, eventType: string, txHash: string, borrower: string) =>
    fetchJSON('/attestcoin/verify', { method: 'POST', body: JSON.stringify({ chainId, eventType, txHash, borrower }) }),
  
  checkVerification: (requestId: string) =>
    fetchJSON(`/attestcoin/status/${requestId}`),

  // Graph
  getGraph: (borrower: string) =>
    fetchJSON(`/graph/${borrower}`),

  getNode: (nodeId: string) =>
    fetchJSON(`/graph/node/${nodeId}`),

  // Assessment
  previewScore: (borrower: string, nodeIds: string[]) =>
    fetchJSON('/assessment/preview', { method: 'POST', body: JSON.stringify({ borrower, nodeIds }) }),

  requestEligibility: async (borrower: string, nodeIds: string[]) => {
    // 1. Get signature and proof data from the backend risk engine
    const res = await fetchJSON('/assessment/request', { method: 'POST', body: JSON.stringify({ borrower, nodeIds }) });
    
    if (res.policy && res.policy.riskTier !== 'REJECTED' && res.registrationData) {
      // 2. Perform on-chain registration via MetaMask
      const signer = await getSigner();
      const contract = new ethers.Contract(ADDRESSES.eligibilityRegistry, EligibilityRegistryABI.abi, signer);
      const { params, v, r, s, proof } = res.registrationData;
      
      const tx = await contract.registerEligibility(params, v, r, s, proof);
      await tx.wait();
    }
    return res;
  },

  getEligibility: (address: string) =>
    fetchJSON(`/assessment/eligibility/${address}`),

  // Loans (On-Chain)
  createBorrowRequest: async (amount: string, maxAprBps: number, maxDuration: number, collateralAmount: string) => {
    const signer = await getSigner();
    const contract = new ethers.Contract(ADDRESSES.loanMarketplace, LoanMarketplaceABI.abi, signer);
    const tx = await contract.createBorrowRequest(amount, maxAprBps, maxDuration, collateralAmount);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt?.hash };
  },

  createOffer: async (requestId: number, aprBps: number, duration: number, requiredCollateral: string, principal: string) => {
    const signer = await getSigner();
    const contract = new ethers.Contract(ADDRESSES.loanMarketplace, LoanMarketplaceABI.abi, signer);
    const tx = await contract.createLenderOffer(requestId, aprBps, duration, requiredCollateral, { value: principal });
    const receipt = await tx.wait();
    return { success: true, txHash: receipt?.hash };
  },

  acceptOffer: async (offerId: number, collateralAmount: string) => {
    const signer = await getSigner();
    const contract = new ethers.Contract(ADDRESSES.loanMarketplace, LoanMarketplaceABI.abi, signer);
    const tx = await contract.acceptOffer(offerId, { value: collateralAmount });
    const receipt = await tx.wait();
    return { success: true, txHash: receipt?.hash };
  },

  repayLoan: async (loanId: number, repaymentAmount: string) => {
    const signer = await getSigner();
    const contract = new ethers.Contract(ADDRESSES.loanVault, LoanVaultABI.abi, signer);
    const tx = await contract.repayLoan(loanId, { value: repaymentAmount });
    const receipt = await tx.wait();
    return { success: true, txHash: receipt?.hash };
  },

  getCapacity: (address: string) =>
    fetchJSON(`/loans/capacity/${address}`),

  getLoan: (loanId: number) =>
    fetchJSON(`/loans/${loanId}`),

  getTotalOwed: (loanId: number) =>
    fetchJSON(`/loans/total-owed/${loanId}`),

  // Judge
  getJudgeView: (borrower: string) =>
    fetchJSON(`/judge/${borrower}`),

  // Artefacts (On-Chain)
  commitArtefact: async (snapshotCommitment: string, eligibilityNonce: number, contentReference: string) => {
    const signer = await getSigner();
    // Assuming ArtefactRegistry ABI is available or we use a minimal ABI inline
    const minimalAbi = [
      "function commitArtefact(bytes32 snapshotCommitment, uint256 eligibilityNonce, bytes32 policyReference, string calldata contentReference) external"
    ];
    const contract = new ethers.Contract("0x39a7ff6ba01dC15142d458130C277973E203e8CB", minimalAbi, signer);
    
    // We pass ethers.ZeroHash for policyReference mock just like backend did
    const tx = await contract.commitArtefact(snapshotCommitment, eligibilityNonce || 1, ethers.ZeroHash, contentReference || "");
    const receipt = await tx.wait();
    return { success: true, txHash: receipt?.hash };
  },
};
