import { network } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    const { ethers } = await network.create();
    console.log("Starting deployment...");
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // 1. EligibilityRegistry
    const EligibilityRegistry = await ethers.getContractFactory("EligibilityRegistry");
    const eligibility = await EligibilityRegistry.deploy();
    await eligibility.waitForDeployment();
    const eligibilityAddress = await eligibility.getAddress();
    console.log("EligibilityRegistry deployed to:", eligibilityAddress);

    // 2. RepaymentRegistry
    const RepaymentRegistry = await ethers.getContractFactory("RepaymentRegistry");
    const repayment = await RepaymentRegistry.deploy();
    await repayment.waitForDeployment();
    const repaymentAddress = await repayment.getAddress();
    console.log("RepaymentRegistry deployed to:", repaymentAddress);

    // 3. ArtefactRegistry
    const ArtefactRegistry = await ethers.getContractFactory("ArtefactRegistry");
    const artefact = await ArtefactRegistry.deploy();
    await artefact.waitForDeployment();
    const artefactAddress = await artefact.getAddress();
    console.log("ArtefactRegistry deployed to:", artefactAddress);

    // 4. CapacityManager
    const CapacityManager = await ethers.getContractFactory("CapacityManager");
    const capacity = await CapacityManager.deploy(eligibilityAddress);
    await capacity.waitForDeployment();
    const capacityAddress = await capacity.getAddress();
    console.log("CapacityManager deployed to:", capacityAddress);

    // 5. LoanVault
    const LoanVault = await ethers.getContractFactory("LoanVault");
    const vault = await LoanVault.deploy(capacityAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("LoanVault deployed to:", vaultAddress);

    // 6. LoanMarketplace
    const LoanMarketplace = await ethers.getContractFactory("LoanMarketplace");
    const marketplace = await LoanMarketplace.deploy(eligibilityAddress, capacityAddress, vaultAddress);
    await marketplace.waitForDeployment();
    const marketplaceAddress = await marketplace.getAddress();
    console.log("LoanMarketplace deployed to:", marketplaceAddress);

    console.log("\nConfiguring permissions...");

    let tx;
    tx = await capacity.setAuthorizedCaller(vaultAddress, true);
    await tx.wait();
    console.log("Authorized LoanVault in CapacityManager");

    tx = await vault.setMarketplace(marketplaceAddress);
    await tx.wait();
    console.log("Set Marketplace in LoanVault");

    tx = await vault.setRepaymentRegistry(repaymentAddress);
    await tx.wait();
    console.log("Set RepaymentRegistry in LoanVault");

    tx = await repayment.setAuthorizedRecorder(vaultAddress);
    await tx.wait();
    console.log("Authorized LoanVault in RepaymentRegistry");

    // We'll use the deployer account as the registrar for local dev
    // but the backend uses LENDER_PK as the registrar. Actually, let's just use deployer.
    tx = await eligibility.setRegistrar(deployer.address);
    await tx.wait();
    console.log("Set deployer as Registrar in EligibilityRegistry");

    const addresses = {
        EligibilityRegistry: eligibilityAddress,
        RepaymentRegistry: repaymentAddress,
        ArtefactRegistry: artefactAddress,
        CapacityManager: capacityAddress,
        LoanVault: vaultAddress,
        LoanMarketplace: marketplaceAddress,
    };

    fs.writeFileSync(
        path.join(__dirname, "../deployed-addresses.json"),
        JSON.stringify(addresses, null, 2)
    );
    console.log("Deployment complete! Addresses saved to deployed-addresses.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
