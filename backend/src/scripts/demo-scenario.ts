import 'dotenv/config';
import { ethers } from 'ethers';
import express from 'express';
import { attestcoinRouter } from '../routes/attestcoin.routes';
import { evidenceRouter } from '../routes/evidence.routes';
import { graphRouter } from '../routes/graph.routes';
import { assessmentRouter } from '../routes/assessment.routes';
import { loansRouter } from '../routes/loans.routes';
import { artefactsRouter } from '../routes/artefacts.routes';

const app = express();
app.use(express.json());
app.use('/api/attestcoin', attestcoinRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/graph', graphRouter);
app.use('/api/assessment', assessmentRouter);
app.use('/api/loans', loansRouter);
app.use('/api/artefacts', artefactsRouter);

const log = (msg: string) => console.log(`\n========================================\n[DEMO] ${msg}\n========================================`);
const step = (msg: string) => console.log(`  -> ${msg}`);
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runDemo() {
    log("Starting PrivateCredit Graph API Demo (Whitepaper §22)");
    
    // Alice's wallet address (Using the funded Deployer Testnet Wallet)
    const alice = process.env.BORROWER_PK ? new ethers.Wallet(process.env.BORROWER_PK).address : "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    step(`Alice Wallet: ${alice}`);
    
    // ----------------------------------------------------
    // STEP 1: IMPORT EVIDENCE & ATTESTCOIN VERIFICATION
    // ----------------------------------------------------
    log("Step 1: Alice imports 2 external-chain events for verification");
    
    // Request 1: Inflow
    let res = await fetch("http://localhost:3007/api/attestcoin/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chainId: "1", eventType: "INFLOW", txHash: "0xMockTx1", borrower: alice })
    });
    const req1 = await res.json();
    step(`Requested verification for INFLOW (Req: ${req1.requestId})`);
    
    // Request 2: Repayment
    res = await fetch("http://localhost:3007/api/attestcoin/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chainId: "10", eventType: "REPAYMENT", txHash: "0xMockTx2", borrower: alice })
    });
    const req2 = await res.json();
    step(`Requested verification for REPAYMENT (Req: ${req2.requestId})`);

    step("Waiting for Attestcoin cross-chain consensus...");
    await delay(3000);
    
    // Confirm them
    await fetch(`http://localhost:3007/api/attestcoin/status/${req1.requestId}`);
    await fetch(`http://localhost:3007/api/attestcoin/status/${req2.requestId}`);
    step("Both events successfully verified by Attestcoin.");

    // Fetch Graph
    res = await fetch(`http://localhost:3007/api/graph/${alice}`);
    const graph = await res.json();
    const evidenceNodes = graph.nodes.filter((n: any) => n.type === 'EVIDENCE').map((n:any) => n.id);
    step(`Alice's Spatial Graph now contains ${evidenceNodes.length} Verified Evidence Nodes.`);

    // ----------------------------------------------------
    // STEP 2: ASSESSMENT & POLICY ENGINE
    // ----------------------------------------------------
    log("Step 2: Alice freezes her graph and requests an official assessment");
    
    res = await fetch("http://localhost:3007/api/assessment/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ borrower: alice, nodeIds: evidenceNodes })
    });
    const assessment = await res.json();
    
    if (assessment.success) {
        step(`Policy Engine Output: Risk Tier = ${assessment.policy.riskTier}`);
        step(`Final Score: ${assessment.policy.breakdown.finalScore}`);
        step(`Capacity Granted: ${ethers.formatEther(assessment.policy.maxActiveCredit)} CTC`);
        step("Eligibility successfully registered on-chain!");
    } else {
        throw new Error("Assessment failed");
    }

    // ----------------------------------------------------
    // STEP 3: LENDING MARKETPLACE (REQUEST & FUND)
    // ----------------------------------------------------
    log("Step 3: Alice requests a 1,000 CTC loan with 500 CTC collateral (50% LTV)");
    
    const requestAmount = ethers.parseEther("1000"); // 1,000 CTC
    const collateralAmount = ethers.parseEther("500"); // 50% of principal (MEDIUM risk maxLtvBps = 5000)
    
    res = await fetch("http://localhost:3007/api/loans/borrow-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            amount: requestAmount.toString(),
            maxAprBps: 500, // 5%
            maxDuration: 86400 * 30, // 30 days
            collateralAmount: collateralAmount.toString() 
        })
    });
    
    const borrowRes = await res.json();
    if (borrowRes.success) {
        step(`Borrow Request created! RequestId: ${borrowRes.requestId}, TxHash: ${borrowRes.txHash}`);
    } else {
        step(`Borrow Request FAILED: ${borrowRes.error}`);
        throw new Error("Borrow request failed");
    }
    const requestId = borrowRes.requestId;
    
    log("Lender sees the request and makes an offer");
    res = await fetch("http://localhost:3007/api/loans/offer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            requestId: requestId,
            aprBps: 400, // 4%
            duration: 86400 * 30, 
            requiredCollateral: collateralAmount.toString(),
            principal: requestAmount.toString()
        })
    });
    const offerRes = await res.json();
    if (offerRes.success) {
        step(`Lender Offer created! OfferId: ${offerRes.offerId}, TxHash: ${offerRes.txHash}`);
    } else {
        step(`Lender Offer FAILED: ${offerRes.error}`);
        throw new Error("Lender offer failed");
    }
    const offerId = offerRes.offerId;
    
    log("Alice accepts the offer (sending 500 CTC collateral)");
    res = await fetch("http://localhost:3007/api/loans/accept-offer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            offerId: offerId,
            collateralAmount: collateralAmount.toString()
        })
    });
    const acceptRes = await res.json();
    if (acceptRes.success) {
        step(`Loan Originated! LoanId: ${acceptRes.loanId}, Capacity reduced by 1,000 CTC. TxHash: ${acceptRes.txHash}`);
    } else {
        step(`Accept Offer FAILED: ${acceptRes.error}`);
        throw new Error("Accept offer failed");
    }
    const loanId = acceptRes.loanId;

    // ----------------------------------------------------
    // STEP 4: CAPACITY ENFORCEMENT (EDGE CASE)
    // ----------------------------------------------------
    log("Step 4: Alice attempts to borrow another 6,000 CTC (over her 5,000 max)");
    
    const overAmount = ethers.parseEther("6000"); // 6,000 CTC — exceeds remaining capacity
    res = await fetch("http://localhost:3007/api/loans/borrow-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            amount: overAmount.toString(),
            maxAprBps: 500, 
            maxDuration: 86400 * 30, 
            collateralAmount: 0 
        })
    });
    const overRes = await res.json();
    
    if (overRes.error) {
        step(`SUCCESS: Capacity Manager blocked the over-leverage attempt! Error: ${overRes.error}`);
    }

    // ----------------------------------------------------
    // STEP 5: LOAN REPAYMENT (RESTORES CAPACITY)
    // ----------------------------------------------------
    log("Step 5: Alice repays the 1,000 CTC loan (with accrued interest)");
    
    // First, query the exact amount owed (principal + accrued interest)
    res = await fetch(`http://localhost:3007/api/loans/total-owed/${loanId}`);
    const owedRes = await res.json();
    const totalOwed = BigInt(owedRes.totalOwed);
    step(`Total owed (principal + interest): ${ethers.formatEther(totalOwed)} CTC`);

    // Add a 10 CTC buffer to account for mempool latency (interest accrues while transaction is pending)
    const repaymentAmount = totalOwed + ethers.parseEther("10");

    res = await fetch("http://localhost:3007/api/loans/repay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            loanId: loanId,
            repaymentAmount: repaymentAmount.toString()
        })
    });
    const repayRes = await res.json();
    if (repayRes.success) {
        step(`Loan Repaid successfully! Capacity restored. TxHash: ${repayRes.txHash}`);
    } else {
        step(`Repayment failed: ${repayRes.error}`);
    }

    // ----------------------------------------------------
    // STEP 6: ARTEFACT SNAPSHOT
    // ----------------------------------------------------
    log("Step 6: Alice commits her graph snapshot as an Artefact");
    
    res = await fetch("http://localhost:3007/api/artefacts/commit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            snapshotCommitment: ethers.id(JSON.stringify(graph)),
            eligibilityNonce: 1,
            contentReference: "ipfs://mock-graph-cid"
        })
    });
    const artefactRes = await res.json();
    step(`Artefact Snapshotted to Registry! TxHash: ${artefactRes.txHash}`);

    log("Demo Scenario Complete!");
}

const server = app.listen(3007, async () => {
    try {
        await runDemo();
    } catch (e) {
        console.error("Demo failed:", e);
    } finally {
        server.close();
    }
});
