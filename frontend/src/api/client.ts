const API_BASE = '/api';

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
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

  requestEligibility: (borrower: string, nodeIds: string[]) =>
    fetchJSON('/assessment/request', { method: 'POST', body: JSON.stringify({ borrower, nodeIds }) }),

  getEligibility: (address: string) =>
    fetchJSON(`/assessment/eligibility/${address}`),

  // Loans
  createBorrowRequest: (amount: string, maxAprBps: number, maxDuration: number, collateralAmount: string) =>
    fetchJSON('/loans/borrow-request', { method: 'POST', body: JSON.stringify({ amount, maxAprBps, maxDuration, collateralAmount }) }),

  createOffer: (requestId: number, aprBps: number, duration: number, requiredCollateral: string, principal: string) =>
    fetchJSON('/loans/offer', { method: 'POST', body: JSON.stringify({ requestId, aprBps, duration, requiredCollateral, principal }) }),

  acceptOffer: (offerId: number, collateralAmount: string) =>
    fetchJSON('/loans/accept-offer', { method: 'POST', body: JSON.stringify({ offerId, collateralAmount }) }),

  repayLoan: (loanId: number, repaymentAmount: string) =>
    fetchJSON('/loans/repay', { method: 'POST', body: JSON.stringify({ loanId, repaymentAmount }) }),

  getCapacity: (address: string) =>
    fetchJSON(`/loans/capacity/${address}`),

  getLoan: (loanId: number) =>
    fetchJSON(`/loans/${loanId}`),

  getTotalOwed: (loanId: number) =>
    fetchJSON(`/loans/total-owed/${loanId}`),

  // Judge
  getJudgeView: (borrower: string) =>
    fetchJSON(`/judge/${borrower}`),

  // Artefacts
  commitArtefact: (snapshotCommitment: string, eligibilityNonce: number, contentReference: string) =>
    fetchJSON('/artefacts/commit', { method: 'POST', body: JSON.stringify({ snapshotCommitment, eligibilityNonce, contentReference }) }),
};
