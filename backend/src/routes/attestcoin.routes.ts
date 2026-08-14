import { Router, Request, Response } from 'express';
import { AttestcoinService, attestcoinService } from '../services/AttestcoinService';

export const attestcoinRouter = Router();

attestcoinRouter.post('/verify', async (req: Request, res: Response) => {
  try {
    const { chainId, eventType, txHash, borrower } = req.body;
    const requestId = await attestcoinService.createVerificationRequest(chainId, eventType, txHash, borrower);
    res.json({ requestId, status: 'PENDING_ATTESTATION' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

attestcoinRouter.get('/status/:requestId', (req: Request, res: Response) => {
  try {
    const request = attestcoinService.checkVerificationStatus(req.params.requestId as string);
    res.json({
      status: request.status,
      requestId: request.requestId,
      chainId: request.chainId,
      chainKey: request.chainKey,
      eventType: request.eventType,
      txHash: request.txHash,
      borrower: request.borrower,
      sourceBlock: request.sourceBlock,
      proof: request.proof,
      creditcoinTxHash: request.creditcoinTxHash,
      evidenceId: request.evidenceId,
      feature: request.feature,
      error: request.error,
    });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

attestcoinRouter.post('/complete', async (req: Request, res: Response) => {
  try {
    const { requestId, creditcoinTxHash, evidenceId } = req.body;
    const feature = await attestcoinService.completeVerification(requestId, creditcoinTxHash, evidenceId);
    res.json({ status: 'VERIFIED', feature });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

attestcoinRouter.get('/precompile', (_req: Request, res: Response) => {
  res.json({ address: AttestcoinService.getVerifierPrecompile(), chainId: 102031 });
});
