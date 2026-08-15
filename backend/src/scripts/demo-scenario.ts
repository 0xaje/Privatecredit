async function runDemo() {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3001/api';
  const borrower = process.env.DEMO_BORROWER_ADDRESS;
  const sourceTxHash = process.env.DEMO_SOURCE_TX_HASH;
  const sourceChainId = process.env.DEMO_SOURCE_CHAIN_ID || '11155111';
  const eventType = process.env.DEMO_EVENT_TYPE || 'INFLOW';

  if (!borrower || !sourceTxHash) {
    throw new Error('Set DEMO_BORROWER_ADDRESS and DEMO_SOURCE_TX_HASH before running the live demo.');
  }

  const verifyResponse = await fetch(`${API_BASE_URL}/attestcoin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chainId: sourceChainId, eventType, txHash: sourceTxHash, borrower }),
  });
  if (!verifyResponse.ok) throw new Error(await verifyResponse.text());
  const { requestId } = await verifyResponse.json() as { requestId: string };

  for (;;) {
    const statusResponse = await fetch(`${API_BASE_URL}/attestcoin/status/${requestId}`);
    const status = await statusResponse.json() as any;
    console.log(status.status, status.error || '');
    if (status.status === 'PROOF_READY') {
      console.log('Proof is ready. A connected wallet must now submit verifyEvidence on Creditcoin.');
      break;
    }
    if (status.status === 'FAILED' || status.status === 'UNSUPPORTED') throw new Error(status.error || 'Proof generation failed');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

void runDemo().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
