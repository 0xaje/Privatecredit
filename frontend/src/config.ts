import deploymentManifest from '../../config/privatecredit-cc3-live-v3.json';

export const deployment = {
  ...deploymentManifest,
  contracts: {
    ...deploymentManifest.contracts,
    uscVerifier: (import.meta as any).env?.VITE_USC_VERIFIER_ADDRESS || deploymentManifest.contracts.uscVerifier,
  },
};
