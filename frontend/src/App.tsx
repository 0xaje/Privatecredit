import { useState, useEffect, useCallback, useRef } from 'react';
import { Interface } from 'ethers';
import { Activity, LayoutDashboard, Shield, User, Plus, Zap, X, AlertTriangle } from 'lucide-react';
import type { Node } from 'reactflow';
import GraphCanvas from './components/GraphCanvas';
import Inspector from './components/Inspector';
import ReputationView from './views/ReputationView';
import LoansView from './views/LoansView';
import JudgeView from './views/JudgeView';
import { api } from './api/client';
import './App.css';
import { useCreditcoinWallet } from './wallet';

function App() {
  const [activeView, setActiveView] = useState('overview');
  const { address, isConnected, connect, disconnect } = useCreditcoinWallet();
  const [presetAddress, setPresetAddress] = useState<string>('0x71c7656ec7ab88b098defb751b7401b5f6d8976f');
  const wallet = address || presetAddress;
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [judgeMode, setJudgeMode] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidenceNodeIds, setEvidenceNodeIds] = useState<string[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Bottom bar live data
  const [insightScore, setInsightScore] = useState<number | null>(null);
  const [capacity, setCapacity] = useState<{ available: string; used: string } | null>(null);

  const refreshGraph = useCallback(() => {
    setRefreshTrigger(t => t + 1);
  }, []);

  const handleConnect = async () => {
    setWalletError(null);
    try {
      await connect();
    } catch (error: any) {
      setWalletError(error.message || 'Wallet connection failed.');
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setSelectedNode(null);
    setEvidenceNodeIds([]);
    setInsightScore(null);
    setCapacity(null);
    setJudgeMode(false);
    setActiveView('overview');
  };

  // ─── Fetch live stats ───
  useEffect(() => {
    if (!wallet) return;

    api.getCapacity(wallet)
      .then(res => setCapacity({ available: res.availableCapacity, used: res.usedCapacity }))
      .catch(() => setCapacity(null));

    api.getGraph(wallet)
      .then(data => {
        const evIds = (data.nodes || [])
          .filter((n: any) => n.type === 'EVIDENCE')
          .map((n: any) => n.id);
        setEvidenceNodeIds(evIds);

        if (evIds.length > 0) {
          const nodeIds = (data.nodes || [])
            .filter((n: any) => n.type === 'EVIDENCE')
            .map((n: any) => n.id);
          api.previewScore(wallet, nodeIds)
            .then(res => setInsightScore(res.policy?.breakdown?.finalScore ?? null))
            .catch(() => setInsightScore(null));
        } else {
          setInsightScore(null);
        }
      })
      .catch(() => {
        setEvidenceNodeIds([]);
        setInsightScore(null);
      });
  }, [wallet, refreshTrigger]);

  const handleInspectorAction = (action: string, data?: any) => {
    if (action === 'repay' && data?.loanId) {
      setActiveView('loans');
      setWalletError('Use the Loans view to review and sign the repayment from your connected wallet.');
    }
  };

  const views = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'reputation', label: 'Credit Reputation', icon: User },
    { id: 'loans', label: 'Loans & Capacity', icon: Activity },
    { id: 'judge', label: 'Judge Mode', icon: Shield },
  ];

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <header className="top-nav">
        <div className="logo">
          <span className="logo-icon">◈</span> PRIVATECREDIT GRAPH
        </div>
        <div className="nav-links">
          {/* Preset Profile Quick Switcher */}
          <div className="preset-selector">
            <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, paddingLeft: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Presets:
            </span>
            <button
              className={`preset-btn ${wallet === '0x71c7656ec7ab88b098defb751b7401b5f6d8976f' ? 'active' : ''}`}
              onClick={() => setPresetAddress('0x71c7656ec7ab88b098defb751b7401b5f6d8976f')}
            >
              👑 Whale (85)
            </button>
            <button
              className={`preset-btn ${wallet === '0x1111111111111111111111111111111111111111' ? 'active' : ''}`}
              onClick={() => setPresetAddress('0x1111111111111111111111111111111111111111')}
            >
              🔰 New (55)
            </button>
            <button
              className={`preset-btn ${wallet === '0x9999999999999999999999999999999999999999' ? 'active' : ''}`}
              onClick={() => setPresetAddress('0x9999999999999999999999999999999999999999')}
            >
              🚨 High Risk (35)
            </button>
          </div>

          <span className="nav-item">
            <Zap size={14} /> Creditcoin CC3
          </span>
          <span
            className={`nav-item ${judgeMode ? 'judge-active' : ''}`}
            onClick={() => {
              setJudgeMode(!judgeMode);
              if (!judgeMode) setActiveView('judge');
              else setActiveView('overview');
            }}
            style={{ cursor: 'pointer', color: judgeMode ? '#f59e0b' : undefined }}
          >
            ⚖ Judge: {judgeMode ? 'ON' : 'OFF'}
          </span>
          {isConnected && address ? (
            <button className="wallet-btn connected" onClick={() => void handleDisconnect()}>
              <span className="wallet-dot" /> {address.slice(0, 6)}...{address.slice(-4)}
            </button>
          ) : (
            <button className="wallet-btn" onClick={() => void handleConnect()}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Wallet Error Toast */}
      {walletError && (
        <div className="wallet-error-toast">
          <AlertTriangle size={16} />
          <span>{walletError}</span>
          <button onClick={() => setWalletError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Left Side Panel */}
      <aside className="left-views">
        <div className="inspector-label" style={{ marginBottom: '8px' }}>VIEWS</div>
        {views.map(view => {
          const Icon = view.icon;
          return (
            <button
              key={view.id}
              className={`view-btn ${activeView === view.id ? 'active' : ''}`}
              onClick={() => {
                setActiveView(view.id);
                if (view.id === 'judge') setJudgeMode(true);
                else if (activeView === 'judge') setJudgeMode(false);
              }}
            >
              <Icon size={16} style={{ marginRight: '10px', flexShrink: 0 }} />
              {view.label}
            </button>
          );
        })}

        <div className="sidebar-divider" />

        {/* Quick Actions */}
        <div className="inspector-label">ACTIONS</div>
        <button className="action-pill" onClick={() => setShowAddEvidence(true)} disabled={!wallet}>
          <Plus size={14} /> Add Evidence
        </button>

        {/* Active View Panel */}
        {wallet && activeView === 'reputation' && (
          <ReputationView
            borrowerAddress={wallet}
            evidenceNodeIds={evidenceNodeIds}
            onEligibilityRegistered={refreshGraph}
          />
        )}
        {wallet && activeView === 'loans' && (
          <LoansView
            borrowerAddress={wallet}
            onLoanAction={refreshGraph}
          />
        )}
        {wallet && activeView === 'judge' && (
          <JudgeView borrowerAddress={wallet} />
        )}
      </aside>

      {/* Center Canvas */}
      <main className="center-canvas">
        <GraphCanvas
          borrowerAddress={wallet}
          onNodeSelect={setSelectedNode}
          refreshTrigger={refreshTrigger}
        />
      </main>

      {/* Right Inspector */}
      <aside className="right-inspector">
        <Inspector node={selectedNode} onAction={handleInspectorAction} />
      </aside>

      {/* Bottom Action Bar */}
      <footer className="bottom-action-bar">
        <div className="status-indicators">
          <span className="status-item">
            Insight Score:&nbsp;
            <strong style={{ color: insightScore !== null ? (insightScore >= 80 ? '#10b981' : insightScore >= 50 ? '#f59e0b' : '#ef4444') : '#6b7280' }}>
              {insightScore ?? '--'}
            </strong>
          </span>
          <span className="status-item">
            Capacity:&nbsp;
            <strong style={{ color: '#a5b4fc' }}>
              {capacity ? `${(Number(capacity.used) / 1e18).toFixed(0)} / ${((Number(capacity.used) + Number(capacity.available)) / 1e18).toFixed(0)} CTC` : '-- / --'}
            </strong>
          </span>
        </div>
        <div className="context-actions">
          <span className="status-item" style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            PrivateCredit × Creditcoin × Attestcoin
          </span>
        </div>
      </footer>

      {/* Add Evidence Modal */}
      {showAddEvidence && wallet && (
        <AddEvidenceModal
          borrower={wallet}
          onClose={() => setShowAddEvidence(false)}
          onSuccess={refreshGraph}
        />
      )}
    </div>
  );
}

// ─── Add Evidence Modal ──────────────────────────────────────
function AddEvidenceModal({ borrower, onClose, onSuccess }: { borrower: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ chainId: '11155111', eventType: 'INFLOW', txHash: '' });
  const [existingRequestId, setExistingRequestId] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'waiting' | 'proof-ready' | 'signing' | 'done' | 'error'>('idle');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { getSigner } = useCreditcoinWallet();
  const verifierInterface = new Interface([
    'event EvidenceVerified(bytes32 indexed queryId,bytes32 indexed evidenceId,address indexed borrower,uint64 chainKey,uint64 blockHeight,address token,address sender,uint256 amount,uint8 evidenceType,bytes32 transactionHash)',
  ]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const signProof = async () => {
    setStatus('signing');
    setResult(null);
    try {
      if (!requestId) throw new Error('Verification request ID is missing');
      const prepared = await api.prepareVerification(requestId);
      if (prepared.borrower.toLowerCase() !== borrower.toLowerCase()) {
        throw new Error('Prepared proof borrower does not match the connected wallet');
      }
      const signer = await getSigner();
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== prepared.borrower.toLowerCase()) {
        throw new Error('Connected wallet does not match the proof borrower');
      }
      const tx = await signer.sendTransaction({
        to: prepared.to,
        data: prepared.data,
        value: prepared.value,
      });
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error('USCVerifier transaction was not confirmed successfully');
      }

      let evidenceId: string | undefined;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== prepared.to.toLowerCase()) continue;
        try {
          const parsed = verifierInterface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === 'EvidenceVerified') {
            const eventBorrower = String(parsed.args.borrower);
            if (eventBorrower.toLowerCase() !== prepared.borrower.toLowerCase()) {
              throw new Error('EvidenceVerified borrower does not match the connected wallet');
            }
            evidenceId = String(parsed.args.evidenceId);
          }
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('EvidenceVerified borrower')) throw error;
        }
      }
      if (!evidenceId) throw new Error('USCVerifier receipt did not contain EvidenceVerified');

      await api.completeVerification(requestId, receipt.hash, evidenceId);
      const completed = await api.checkVerification(requestId);
      if (completed.status !== 'VERIFIED') {
        throw new Error(`Backend did not confirm VERIFIED status: ${completed.status}`);
      }
      setStatus('done');
      setResult(`Verified evidence added. Creditcoin transaction: ${receipt.hash}`);
      onSuccess();
    } catch (error: any) {
      setStatus('error');
      setResult(error.message || 'Live USC verification failed.');
    }
  };

  const handleSubmit = async () => {
    setStatus('verifying');
    setResult(null);
    try {
      const suppliedRequestId = existingRequestId.trim();
      if (suppliedRequestId) {
        const existing = await api.checkVerification(suppliedRequestId);
        setRequestId(suppliedRequestId);
        if (existing.status !== 'PROOF_READY') {
          throw new Error(`Existing request is not PROOF_READY: ${existing.status}`);
        }
        setStatus('proof-ready');
        return;
      }
      if (!form.txHash) throw new Error('Enter a mined source-chain transaction hash');
      const response = await api.verify(form.chainId, form.eventType, form.txHash, borrower);
      setRequestId(response.requestId);
      setStatus('waiting');
      pollRef.current = setInterval(async () => {
        try {
          const statusResponse = await api.checkVerification(response.requestId);
          if (statusResponse.status === 'PROOF_READY') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setStatus('proof-ready');
          } else if (statusResponse.status === 'FAILED' || statusResponse.status === 'UNSUPPORTED') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setStatus('error');
            setResult(statusResponse.error || 'Attestcoin proof generation failed.');
          }
        } catch { /* keep polling */ }
      }, 2000);
      window.setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setStatus('error');
          setResult('Proof generation timed out; no success was fabricated.');
        }
      }, 900000);
    } catch (error: any) {
      setStatus('error');
      setResult(error.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Cross-Chain Evidence</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">Submit a supported source-chain transaction, or load an existing PROOF_READY request. Attestcoin proof data stays on the backend until the final verification calldata is prepared; the Creditcoin transaction must be signed by your connected wallet.</p>
          <div className="form-field">
            <label>Existing PROOF_READY request ID (optional)</label>
            <input value={existingRequestId} onChange={e => setExistingRequestId(e.target.value)} placeholder="req_..." />
          </div>
          <div className="form-field">
            <label>Source Chain ID</label>
            <input value={form.chainId} onChange={e => setForm({...form, chainId: e.target.value})} />
          </div>
          <div className="form-field">
            <label>Event Type</label>
            <select value={form.eventType} onChange={e => setForm({...form, eventType: e.target.value})}>
              <option value="INFLOW">INFLOW</option>
              <option value="REPAYMENT">REPAYMENT</option>
            </select>
          </div>
          <div className="form-field">
            <label>Transaction Hash</label>
            <input value={form.txHash} onChange={e => setForm({...form, txHash: e.target.value})} />
          </div>

          {(status === 'waiting' || status === 'verifying') && (
            <div className="verification-progress"><div className="loading-spinner" /><span>Waiting for attestation/proof generation... (Request: {requestId?.slice(0, 12)}...)</span></div>
          )}
          {status === 'proof-ready' && <div className="verification-progress"><span>Proof ready. Review the wallet prompt to verify it on Creditcoin.</span></div>}
          {status === 'signing' && <div className="verification-progress"><div className="loading-spinner" /><span>Awaiting Creditcoin wallet confirmation...</span></div>}
          {status === 'done' && <div className="result-msg success">{result}</div>}
          {status === 'error' && <div className="result-msg error">{result}</div>}

          <button className="primary-action-btn" onClick={() => void (status === 'proof-ready' ? signProof() : handleSubmit())} disabled={['verifying', 'waiting', 'signing', 'done'].includes(status)}>
            {status === 'idle' ? (existingRequestId.trim() ? 'Load Existing Proof' : 'Request Attestcoin Proof') : status === 'proof-ready' ? 'Verify on Creditcoin' : status === 'done' ? '✓ Done' : status === 'signing' ? 'Awaiting Signature...' : 'Generating Proof...'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
