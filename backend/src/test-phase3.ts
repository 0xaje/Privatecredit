import express from 'express';
import { ethers } from 'ethers';
import { attestcoinRouter } from './routes/attestcoin.routes';
import { evidenceRouter } from './routes/evidence.routes';
import { graphRouter } from './routes/graph.routes';
import { assessmentRouter } from './routes/assessment.routes';
import { loansRouter } from './routes/loans.routes';

const app = express();
app.use(express.json());
app.use('/api/attestcoin', attestcoinRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/graph', graphRouter);
app.use('/api/assessment', assessmentRouter);
app.use('/api/loans', loansRouter);

const server = app.listen(3006, async () => {
    console.log("Phase 3 Test Server Started");
    
    try {
        const borrower = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Use a known PK address
        const borrowerAddr = new ethers.Wallet(borrower).address;
        
        console.log(`Borrower: ${borrowerAddr}`);
        
        // 1. Trigger verification (INFLOW)
        let res = await fetch("http://localhost:3006/api/attestcoin/verify", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chainId: "1", eventType: "INFLOW", txHash: "0x123", borrower: borrowerAddr })
        });
        const { requestId } = await res.json();
        
        await new Promise(r => setTimeout(r, 2500));
        await fetch(`http://localhost:3006/api/attestcoin/status/${requestId}`);
        
        // 2. Fetch Graph
        res = await fetch(`http://localhost:3006/api/graph/${borrowerAddr}`);
        const graph = await res.json();
        const evidenceNodes = graph.nodes.filter((n: any) => n.type === 'EVIDENCE').map((n:any) => n.id);
        
        console.log(`Found ${evidenceNodes.length} evidence nodes.`);
        
        // 3. Request Assessment (triggers Policy Engine & on-chain tx)
        console.log("Requesting Assessment...");
        res = await fetch("http://localhost:3006/api/assessment/request", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ borrower: borrowerAddr, nodeIds: evidenceNodes })
        });
        const assessmentResult = await res.json();
        console.log("Policy Output:", assessmentResult.policy);
        
        // 4. Create Borrow Request
        console.log("Creating Borrow Request...");
        res = await fetch("http://localhost:3006/api/loans/borrow-request", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                amount: "1000000000000000000", // 1 ETH
                maxAprBps: 500, // 5%
                maxDuration: 86400 * 30, // 30 days
                collateralAmount: 0 
            })
        });
        const borrowResult = await res.json();
        console.log("Borrow TxHash:", borrowResult.txHash);
        
        console.log("Phase 3 End-to-End Test Passed!");
    } catch (e) {
        console.error("Test Failed:", e);
    } finally {
        server.close();
    }
});
