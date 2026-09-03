# PrivateCredit Graph — Demo Video Shooting Script

**Target runtime: 4:00.** The hackathon rules require a demo video URL but do not specify a
length; four minutes is long enough to show the full loop and short enough to hold attention
across a field of 44 submissions.

**Time allocation is deliberate.** The Attestcoin Protocol segment (0:42–2:20) takes ~40% of the
runtime, because depth of Attestcoin utilization is the one published scoring criterion. The
loan lifecycle — the part most entries over-spend on — is compressed to 40 seconds.

---

## Pre-production checklist

Do all of this before recording. Most of it cannot be fixed in the edit.

| # | Item | Why |
| :-- | :--- | :--- |
| 1 | Hit `https://privatecredit.onrender.com/health` ~10 min before recording, and keep it warm | Render cold start measured at ~60s. A cold backend makes the graph fall back to its empty placeholder on camera. |
| 2 | Prepare **two** Sepolia transaction hashes: one unused, one already submitted | The unused one is the live verification. The already-used one drives the rejection beat at 1:35. |
| 3 | **Rehearse the rejection and read the error box** | The UI surfaces backend errors verbatim. If a replay renders as an opaque custom-error selector rather than readable text, narrate over it or decode it before shooting — see note at 1:35. |
| 4 | Fund borrower and lender wallets on CC3 via the in-app faucet | Running dry mid-take costs a full re-shoot. |
| 5 | Use two separate wallets / browser profiles for borrower and lender | The marketplace has a self-funding safeguard that blocks lending to your own request. |
| 6 | Pre-populate a graph with 3–4 evidence nodes, and record the cold open **last** | Slide 0:00 needs a graph that already looks alive. |
| 7 | Record at 1920×1080, browser zoom 110–125% | Contract addresses and node labels must stay legible after compression. |
| 8 | No background music under the voiceover | It competes with dense technical narration and adds nothing. |

---

## 0:00 – 0:18 · Cold open

**Screen:** Open on the already-populated graph, gently in motion. Push in on one evidence node
until its source transaction hash is readable.

**Voiceover:**
> This is a credit graph on Creditcoin. Every node in it was proved by the Attestcoin
> precompile — not reported by an oracle operator. Let me show you what that buys you.

**Note:** No team introduction, no agenda slide. A judge watching 44 videos decides in the first
fifteen seconds whether this is a real build. Show the working thing immediately.

---

## 0:18 – 0:42 · The problem

**Screen:** Simple graphic — one wallet address, three disconnected chain histories.

**Voiceover:**
> Uncollateralized lending needs credit history. But a borrower with two years of clean
> repayments on Arbitrum arrives on Creditcoin as a complete stranger. Moving that history
> between chains has meant trusting an oracle operator to tell the truth about it.

**Note:** One problem, stated concretely. Do not list adjacent problems.

---

## 0:42 – 1:35 · Proving evidence *(core segment)*

**Screen:** Click **Add Evidence**. Paste the unused Sepolia hash, chain 11155111, type INFLOW.
Submit. Hold on the pending state, then cut to the new node appearing on the graph.

**Voiceover:**
> So instead of trusting anyone, we prove it. I'm submitting an Ethereum Sepolia transaction as
> evidence of an inflow. The backend builds an SPV header-continuity proof and a Merkle receipt
> proof using the Attestcoin SDK. Then `USCVerifier` calls the BlockProver precompile at
> `0x0FD2` — on-chain, natively, no operator in the path.

*(node appears)*

> Verified. And the amount on that node is not a number I typed in. The contract decoded it out
> of the transaction receipt itself.

**Note:** Cut the block-confirmation wait. Never leave dead air on camera.

---

## 1:35 – 2:20 · Why a passing proof is not enough *(the differentiator)*

**Screen:** Submit the **already-used** transaction hash. Let the red error box render. Hold on
it long enough to read.

**Voiceover:**
> Now watch what happens when I submit that same transaction a second time.

*(rejection appears)*

> Rejected. And this is the part that matters. A passing proof tells you a transaction is real.
> It does not tell you the caller is being honest about what it means. So after the precompile
> passes, the contract re-validates the receipt itself — that it actually succeeded, that the
> transfer came from a configured source token, that it moved in the direction claimed. Then it
> holds three independent replay guards: one on the proof, one on the underlying transaction, and
> one preventing a single inflow being spent for two eligibility badges.
>
> That is the difference between reading a proof and underwriting on one.

**Note:** This is the single most persuasive twenty seconds available to you, and the previous
script had no equivalent. Most entries will treat a passing proof as the end of the story. If the
error box renders unreadable hex, either decode the custom error before shooting or cover it in
the voiceover — but do not cut the beat.

---

## 2:20 – 2:50 · Score and badge

**Screen:** **Credit Reputation** view. Show the insight score and its breakdown. Click
**Register Eligibility On-Chain**. Cut to the new eligibility node.

**Voiceover:**
> The risk engine turns that verified evidence into a tier, an LTV ceiling, and a hard credit
> capacity. It's a deterministic scorecard — fixed weights, fixed thresholds — which means every
> decision is reproducible and auditable after the fact. Committing it writes a badge on
> Creditcoin containing a hash of the exact evidence set behind it.

**Note:** Say "deterministic scorecard." Never "AI" or "model" — the code is one search away and
the claim would not survive it.

---

## 2:50 – 3:30 · The lending loop

**Screen:** Move fast. Borrow request → switch to lender wallet → offer → switch back → accept
→ loan node appears. Hard cuts between each; no narration of the form-filling.

**Voiceover:**
> With capacity established, the borrower requests a loan. A lender reviews the risk graph
> visually and competes on rate. On acceptance, the vault escrows collateral and originates the
> loan — with the capacity manager preventing over-borrowing across concurrent positions.
>
> And when a loan defaults, collateral is liquidated through an on-chain Dutch auction. Handling
> the bad outcome is what makes this a credit product rather than a scoring demo.

**Note:** Compressed from 90 seconds to 40. This part is competent but not distinctive — every
lending entry has it. Spend the saved time on the segment above.

---

## 3:30 – 3:48 · Judge mode

**Screen:** Toggle **Judge**. Show the audit trail. Click **Commit Graph Artefact On-Chain**.

**Voiceover:**
> Judge mode exposes the complete audit trail behind every node, and lets an auditor snapshot the
> exact graph state to the `ArtefactRegistry` — so a disputed loan can be reconstructed later
> exactly as it was underwritten.

---

## 3:48 – 4:05 · Close on verifiability

**Screen:** The contract registry table from the README, then a Blockscout page for `USCVerifier`.

**Voiceover:**
> Ten contracts, live on Creditcoin CC3 testnet — every address is in the README and on
> Blockscout. Twenty passing tests, including mutation-tested replay guards. Nothing you just
> saw was mocked.
>
> PrivateCredit Graph. Cross-chain credit history, proved rather than trusted.

**Note:** Close on checkable facts, not thanks. Verifiability is the product thesis, so ending on
it is on-message.

---

## Post-production

- Cut every confirmation wait and every page load over ~1s.
- Burn in captions for `0x0FD2`, `USCVerifier`, and `registerEligibilityFromEvidence` when spoken.
- Keep the rejection beat (1:35) on screen a beat longer than feels comfortable — viewers need
  time to read an error message they were not expecting to see in a demo.
