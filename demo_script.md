# PrivateCredit Graph - Hackathon Demo Script

## 1. Introduction (1 min)
"Hi, we are building **PrivateCredit Graph**, a graph-first intelligence workspace for the next generation of uncollateralized lending. We bring the visual exploration patterns of tools like GraphCon to on-chain lending protocols."

"We use **Creditcoin** as our ledger of record and **Attestcoin** via the **Universal Smart Contract (USC) SDK** to ingest cross-chain reputation data."

## 2. Wallet & Evidence (1.5 mins)
* **Action:** Click 'Connect Wallet' in the top right. Accept MetaMask prompt.
* **Speaking:** "When a borrower logs in, their credit identity is represented as a Wallet Node. To build reputation, they need to prove off-chain or cross-chain behavior."
* **Action:** Click 'Add Evidence'. Enter a real testnet transaction hash for Ethereum (Chain 11155111) -> INFLOW. Click 'Submit for Verification'.
* **Speaking:** "Here, we submit an Ethereum transaction. The backend calls the **Attestcoin Prover** (USC SDK). Once verified, an Evidence Node appears on the graph, anchored to the wallet."

## 3. Policy & Risk (1.5 mins)
* **Action:** Click 'Credit Reputation' in the left sidebar.
* **Speaking:** "Our off-chain Risk Engine continuously evaluates these evidence nodes. You can see the real-time Insight Score gauge."
* **Action:** Hover over the Breakdown. Click 'Register Eligibility On-Chain'.
* **Speaking:** "If the score meets our threshold, the borrower can mint an on-chain **Eligibility Badge** on Creditcoin. This commits a keccak256 hash of their entire verified evidence history to the chain."
* **Action:** Point out the new purple Eligibility Node in the graph.

## 4. Borrowing & Lending (1.5 mins)
* **Action:** Click 'Loans & Capacity' in the left sidebar.
* **Speaking:** "Now the borrower has active capacity. They submit a borrow request for 1 CTC."
* **Action:** Fill out the borrow request form and submit.
* **Speaking:** "This interacts with our `LoanMarketplace` contract on the CC3 testnet. Next, a lender evaluates the graph."
* **Action:** Switch the toggle from 'Borrower' to 'Lender'.
* **Speaking:** "A lender reviews the borrower's risk profile visually. Satisfied, they submit a competing offer via the Lender form."
* **Action:** Fill out the lender offer and submit.
* **Speaking:** "The borrower can then switch back to their view and accept the offer."
* **Action:** Switch back to 'Borrower'. Click 'Accept Offer'. Enter the Offer ID and Collateral. Submit.
* **Speaking:** "Once accepted, this creates a Loan Node, which tracks live repayment status from the `LoanVault`."

## 5. Judge & Audit Mode (1 min)
* **Action:** Toggle 'Judge' to ON in the top nav.
* **Speaking:** "Finally, because reputation is subjective, we built **Judge Mode**. Protocol auditors or lenders can view the complete, verifiable audit trail of every evidence node."
* **Action:** Click 'Commit Graph Artefact On-Chain'.
* **Speaking:** "They can snapshot the exact state of the graph and commit it to our `ArtefactRegistry` on Creditcoin, ensuring permanent traceability for any defaulted loan."

## 6. Conclusion
"PrivateCredit Graph: Verifiable, cross-chain reputation, made visual. Thank you."
