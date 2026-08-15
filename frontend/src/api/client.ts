const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export const api = {
  verify: (chainId: string, eventType: string, txHash: string, borrower: string) =>
    fetchJSON('/attestcoin/verify', { method: 'POST', body: JSON.stringify({ chainId, eventType, txHash, borrower }) }),
  checkVerification: (requestId: string) => fetchJSON(`/attestcoin/status/${requestId}`),
  prepareVerification: (requestId: string) =>
    fetchJSON('/attestcoin/prepare', { method: 'POST', body: JSON.stringify({ requestId }) }),
  completeVerification: (requestId: string, creditcoinTxHash: string, evidenceId: string) =>
    fetchJSON('/attestcoin/complete', { method: 'POST', body: JSON.stringify({ requestId, creditcoinTxHash, evidenceId }) }),
  getGraph: (borrower: string) => fetchJSON(`/graph/${borrower}`),
  getNode: (nodeId: string) => fetchJSON(`/graph/node/${nodeId}`),
  previewScore: (borrower: string, nodeIds: string[]) =>
    fetchJSON('/assessment/preview', { method: 'POST', body: JSON.stringify({ borrower, nodeIds }) }),
  prepareEligibility: (borrower: string, nodeIds: string[]) =>
    fetchJSON('/assessment/prepare', { method: 'POST', body: JSON.stringify({ borrower, nodeIds }) }),
  getEligibility: (address: string) => fetchJSON(`/assessment/eligibility/${address}`),
  prepareBorrowRequest: (from: string, amount: string, maxAprBps: number, maxDuration: number, collateralAmount: string) =>
    fetchJSON('/loans/prepare/borrow-request', { method: 'POST', body: JSON.stringify({ from, amount, maxAprBps, maxDuration, collateralAmount }) }),
  prepareOffer: (from: string, requestId: number, aprBps: number, duration: number, requiredCollateral: string, principal: string) =>
    fetchJSON('/loans/prepare/offer', { method: 'POST', body: JSON.stringify({ from, requestId, aprBps, duration, requiredCollateral, principal }) }),
  prepareAcceptOffer: (from: string, offerId: number, collateralAmount: string) =>
    fetchJSON('/loans/prepare/accept-offer', { method: 'POST', body: JSON.stringify({ from, offerId, collateralAmount }) }),
  prepareRepay: (from: string, loanId: number, repaymentAmount: string) =>
    fetchJSON('/loans/prepare/repay', { method: 'POST', body: JSON.stringify({ from, loanId, repaymentAmount }) }),
  getOpenRequests: () => fetchJSON('/loans/requests/open'),
  getCapacity: (address: string) => fetchJSON(`/loans/capacity/${address}`),
  getLoan: (loanId: number) => fetchJSON(`/loans/${loanId}`),
  getTotalOwed: (loanId: number) => fetchJSON(`/loans/total-owed/${loanId}`),
  getJudgeView: (borrower: string) => fetchJSON(`/judge/${borrower}`),
  prepareArtefactCommit: (from: string, snapshotCommitment: string, eligibilityNonce: number, policyReference: string, contentReference: string) =>
    fetchJSON('/artefacts/prepare/commit', { method: 'POST', body: JSON.stringify({ from, snapshotCommitment, eligibilityNonce, policyReference, contentReference }) }),
};
