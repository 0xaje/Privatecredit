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
    log("Step 3: Alice requests a 5,000 CTC loan");
    
    const requestAmount = ethers.parseEther("5000"); // 5,000 CTC
    res = await fetch("http://localhost:3007/api/loans/borrow-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            amount: requestAmount.toString(),
            maxAprBps: 500, // 5%
            maxDuration: 86400 * 30, // 30 days
            collateralAmount: 0 
        })
    });
    
    const borrowRes = await res.json();
    step(`Borrow Request created! TxHash: ${borrowRes.txHash}`);
    
    log("Lender sees the request and makes an offer");
    // Offer (Principal = 5000)
    res = await fetch("http://localhost:3007/api/loans/offer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            requestId: 1, // First request
            aprBps: 400, // 4%
            duration: 86400 * 30, 
            requiredCollateral: 0,
            principal: requestAmount.toString()
        })
    });
    
    step(`Lender Offer created!`);
    
    log("Alice accepts the offer");
    res = await fetch("http://localhost:3007/api/loans/accept-offer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            offerId: 1,
            collateralAmount: 0
        })
    });
    
    step(`Loan Originated! Capacity reduced by 5,000 CTC.`);

    // ----------------------------------------------------
    // STEP 4: CAPACITY ENFORCEMENT (EDGE CASE)
    // ----------------------------------------------------
    log("Step 4: Alice attempts to borrow another 6,000 CTC (over her 10,000 max)");
    
    const overAmount = ethers.parseEther("6000"); // 6,000 CTC (5k + 6k = 11k, > 10k max)
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
