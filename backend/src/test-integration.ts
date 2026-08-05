import express from 'express';
import { attestcoinRouter } from './routes/attestcoin.routes';
import { evidenceRouter } from './routes/evidence.routes';
import { graphRouter } from './routes/graph.routes';

const app = express();
app.use(express.json());
app.use('/api/attestcoin', attestcoinRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/graph', graphRouter);

const server = app.listen(3005, async () => {
    console.log("Test server started on port 3005");
    
    try {
        // 1. Trigger verification
        const borrower = "0xTestBorrower123";
        console.log("Triggering verification for", borrower);
        const resVerify = await fetch("http://localhost:3005/api/attestcoin/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chainId: "1",
                eventType: "INFLOW",
                txHash: "0xabc",
                borrower
            })
        });
        const verifyData = await resVerify.json();
        console.log("Verification Response:", verifyData);
        
        const requestId = verifyData.requestId;

        // 2. Poll until confirmed (AttestcoinService mocks 2s delay)
        console.log("Polling for status...");
        await new Promise(r => setTimeout(r, 2500)); // Wait 2.5s for mock to finish
        
        const resStatus = await fetch(`http://localhost:3005/api/attestcoin/status/${requestId}`);
        const statusData = await resStatus.json();
        console.log("Status Response:", statusData);
        
        // 3. Get Graph
        console.log("Fetching graph...");
        const resGraph = await fetch(`http://localhost:3005/api/graph/${borrower}`);
        const graphData = await resGraph.json();
        console.log(`Graph Data: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);
        
        // 4. Freeze Evidence
        const evidenceNode = graphData.nodes.find((n: any) => n.type === 'EVIDENCE');
        if (evidenceNode) {
            console.log("Freezing evidence node", evidenceNode.id);
            const resFreeze = await fetch("http://localhost:3005/api/evidence/freeze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    borrower,
                    nodeIds: [evidenceNode.id]
                })
            });
            const freezeData = await resFreeze.json();
            console.log("Freeze Response (Commitment):", freezeData.commitment);
        } else {
            console.error("No evidence node found in graph");
        }
        
    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        server.close();
        console.log("Test server stopped");
    }
});
