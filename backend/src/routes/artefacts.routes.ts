import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { config } from '../config';

export const artefactsRouter = Router();

const ARTEFACT_ABI = [
  'function commitArtefact(bytes32 snapshotCommitment,uint256 eligibilityNonce,bytes32 policyReference,string calldata contentReference) external',
];
const artefactInterface = new ethers.Interface(ARTEFACT_ABI);

artefactsRouter.post('/prepare/commit', (req: Request, res: Response) => {
  try {
    if (!req.body.from || !ethers.isAddress(req.body.from)) throw new Error('from must be a valid wallet address');
    const snapshotCommitment = ethers.hexlify(req.body.snapshotCommitment);
    const policyReference = ethers.hexlify(req.body.policyReference);
    if (snapshotCommitment === ethers.ZeroHash || policyReference === ethers.ZeroHash) {
      throw new Error('snapshotCommitment and policyReference must be non-zero');
    }
    const eligibilityNonce = BigInt(req.body.eligibilityNonce ?? 1);
    const contentReference = String(req.body.contentReference || '');
    const data = artefactInterface.encodeFunctionData('commitArtefact', [
      snapshotCommitment,
      eligibilityNonce,
      policyReference,
      contentReference,
    ]);
    res.json({
      success: true,
      transaction: { chainId: config.chainId, to: config.addresses.artefactRegistry, data, value: '0' },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
