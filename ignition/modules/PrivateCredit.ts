import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PrivateCreditModule", (m) => {
  const eligibilityRegistry = m.contract("EligibilityRegistry");
  const evmV1Decoder = m.library("EvmV1Decoder", {
    after: [eligibilityRegistry],
  });
  const repaymentRegistry = m.contract("RepaymentRegistry", [], {
    after: [evmV1Decoder],
  });
  const artefactRegistry = m.contract("ArtefactRegistry", [eligibilityRegistry], {
    after: [repaymentRegistry],
  });
  const capacityManager = m.contract("CapacityManager", [eligibilityRegistry], {
    after: [artefactRegistry],
  });
  const uscVerifier = m.contract("USCVerifier", [eligibilityRegistry], {
    libraries: { EvmV1Decoder: evmV1Decoder },
    after: [capacityManager],
  });

  const setRegistrar = m.call(
    eligibilityRegistry,
    "setRegistrar",
    [uscVerifier],
    { after: [uscVerifier] },
  );
  const loanVault = m.contract("LoanVault", [capacityManager], {
    after: [setRegistrar],
  });

  const authorizeLoanVault = m.call(
    capacityManager,
    "setAuthorizedCaller",
    [loanVault, true],
    {
      id: "CapacityManagerAuthorizeLoanVault",
      after: [loanVault],
    },
  );
  const setLoanVaultRepaymentRegistry = m.call(
    loanVault,
    "setRepaymentRegistry",
    [repaymentRegistry],
    { after: [authorizeLoanVault] },
  );
  const setAuthorizedRecorder = m.call(
    repaymentRegistry,
    "setAuthorizedRecorder",
    [loanVault],
    { after: [setLoanVaultRepaymentRegistry] },
  );

  const loanMarketplace = m.contract(
    "LoanMarketplace",
    [eligibilityRegistry, capacityManager, loanVault],
    { after: [setAuthorizedRecorder] },
  );
  const authorizeLoanMarketplace = m.call(
    capacityManager,
    "setAuthorizedCaller",
    [loanMarketplace, true],
    {
      id: "CapacityManagerAuthorizeLoanMarketplace",
      after: [loanMarketplace],
    },
  );
  const setLoanVaultMarketplace = m.call(
    loanVault,
    "setMarketplace",
    [loanMarketplace],
    { after: [authorizeLoanMarketplace] },
  );

  return {
    eligibilityRegistry,
    evmV1Decoder,
    repaymentRegistry,
    artefactRegistry,
    capacityManager,
    uscVerifier,
    loanVault,
    loanMarketplace,
    setRegistrar,
    authorizeLoanVault,
    setLoanVaultRepaymentRegistry,
    setAuthorizedRecorder,
    authorizeLoanMarketplace,
    setLoanVaultMarketplace,
  };
});
