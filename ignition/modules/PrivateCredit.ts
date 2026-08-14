import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PrivateCreditModule", (m) => {
  const eligibilityRegistry = m.contract("EligibilityRegistry");
  const repaymentRegistry = m.contract("RepaymentRegistry");
  const artefactRegistry = m.contract("ArtefactRegistry", [eligibilityRegistry]);

  const capacityManager = m.contract("CapacityManager", [eligibilityRegistry]);
  const loanVault = m.contract("LoanVault", [capacityManager]);
  const loanMarketplace = m.contract("LoanMarketplace", [
    eligibilityRegistry,
    capacityManager,
    loanVault,
  ]);
  const evmV1Decoder = m.library("EvmV1Decoder");
  const uscVerifier = m.contract("USCVerifier", [eligibilityRegistry], {
    libraries: { EvmV1Decoder: evmV1Decoder },
  });

  m.call(capacityManager, "setAuthorizedCaller", [loanVault, true]);
  m.call(loanVault, "setMarketplace", [loanMarketplace]);
  m.call(loanVault, "setRepaymentRegistry", [repaymentRegistry]);
  m.call(repaymentRegistry, "setAuthorizedRecorder", [loanVault]);
  m.call(capacityManager, "setAuthorizedCaller", [loanMarketplace, true]);
  m.call(eligibilityRegistry, "setRegistrar", [uscVerifier]);

  return {
    eligibilityRegistry,
    capacityManager,
    loanVault,
    loanMarketplace,
    repaymentRegistry,
    artefactRegistry,
    uscVerifier,
  };
});
