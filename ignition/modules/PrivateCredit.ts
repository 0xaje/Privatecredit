import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PrivateCreditModule", (m) => {
  // 1. Deploy Registries
  const eligibilityRegistry = m.contract("EligibilityRegistry");
  const repaymentRegistry = m.contract("RepaymentRegistry");
  const artefactRegistry = m.contract("ArtefactRegistry");

  // 2. Deploy CapacityManager
  const capacityManager = m.contract("CapacityManager", [eligibilityRegistry]);

  // 3. Deploy LoanVault
  const loanVault = m.contract("LoanVault", [capacityManager]);

  // 4. Deploy LoanMarketplace
  const loanMarketplace = m.contract("LoanMarketplace", [
    eligibilityRegistry,
    capacityManager,
    loanVault
  ]);

  // 5. Setup authorization
  m.call(capacityManager, "setAuthorizedCaller", [loanVault, true]);
  m.call(loanVault, "setMarketplace", [loanMarketplace]);
  m.call(loanVault, "setRepaymentRegistry", [repaymentRegistry]);
  
  // Also we need to set the backend registrar for the EligibilityRegistry. 
  // We'll use the deployer account as the registrar for local dev.
  const deployer = m.getAccount(0);
  m.call(eligibilityRegistry, "setRegistrar", [deployer]);

  return { 
    eligibilityRegistry, 
    capacityManager, 
    loanVault, 
    loanMarketplace, 
    repaymentRegistry, 
    artefactRegistry 
  };
});
