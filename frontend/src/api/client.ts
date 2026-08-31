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
  requestFaucet: (address: string) => fetchJSON(`/loans/faucet/${address}`, { method: 'POST' }),
  getJudgeView: (borrower: string) => fetchJSON(`/judge/${borrower}`),
  prepareArtefactCommit: (from: string, snapshotCommitment: string, eligibilityNonce: number, policyReference: string, contentReference: string) =>
    fetchJSON('/artefacts/prepare/commit', { method: 'POST', body: JSON.stringify({ from, snapshotCommitment, eligibilityNonce, policyReference, contentReference }) }),
  
  // Debt Auctions & Liquidation
  getAuctions: () => fetchJSON('/auctions'),
  createAuction: (loanId: string, borrower: string, principal: string, collateralAmount: string, reservePrice?: string, discountBps?: number) =>
    fetchJSON('/auctions', { method: 'POST', body: JSON.stringify({ loanId, borrower, principal, collateralAmount, reservePrice, discountBps }) }),
  bidAuction: (auctionId: string, bidder: string, amount: string) =>
    fetchJSON(`/auctions/${auctionId}/bid`, { method: 'POST', body: JSON.stringify({ bidder, amount }) }),

  // Real-time Event Stream
  subscribeToEvents: (onMessage: (event: any) => void) => {
    try {
      const eventSource = new EventSource(`${API_BASE}/events`);
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          onMessage(data);
        } catch {
          // ignore malformed JSON
        }
      };
      return () => eventSource.close();
    } catch {
      return () => {};
    }
  },
};
