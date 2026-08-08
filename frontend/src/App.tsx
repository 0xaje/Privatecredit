import { useState, useEffect, useCallback } from 'react';
import { Activity, LayoutDashboard, Shield, User, Plus, Zap, X } from 'lucide-react';
import type { Node } from 'reactflow';
import GraphCanvas from './components/GraphCanvas';
import Inspector from './components/Inspector';
import ReputationView from './views/ReputationView';
import LoansView from './views/LoansView';
import JudgeView from './views/JudgeView';
import { api } from './api/client';
import './App.css';

// Hardhat Account #1 (borrower) for demo
const DEMO_BORROWER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function App() {
  const [activeView, setActiveView] = useState('overview');
  const [wallet, setWallet] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [judgeMode, setJudgeMode] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidenceNodeIds, setEvidenceNodeIds] = useState<string[]>([]);

  // Bottom bar live data
  const [insightScore, setInsightScore] = useState<number | null>(null);
  const [capacity, setCapacity] = useState<{ available: string; used: string } | null>(null);

  const refreshGraph = useCallback(() => {
    setRefreshTrigger(t => t + 1);
  }, []);

  const handleConnect = () => {
    setWallet(DEMO_BORROWER);
  };

  // Fetch live stats for bottom bar
  useEffect(() => {
    if (!wallet) return;
    
    api.getCapacity(wallet)
      .then(res => setCapacity({ available: res.availableCapacity, used: res.usedCapacity }))
      .catch(() => {});

    // Fetch graph to get evidence node IDs for score preview
    api.getGraph(wallet)
      .then(data => {
        const evIds = (data.nodes || [])
          .filter((n: any) => n.type === 'EVIDENCE')
          .map((n: any) => n.id.replace('evidence_feat_', 'feat_'));
        setEvidenceNodeIds(evIds);

        if (evIds.length > 0) {
          // Use the full evidence node IDs for the preview
          const nodeIds = (data.nodes || [])
            .filter((n: any) => n.type === 'EVIDENCE')
            .map((n: any) => n.id);
          api.previewScore(wallet, nodeIds)
            .then(res => setInsightScore(res.policy?.breakdown?.finalScore ?? null))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [wallet, refreshTrigger]);

  const handleInspectorAction = (action: string, data?: any) => {
    if (action === 'repay' && data?.loanId) {
      api.getTotalOwed(data.loanId)
        .then(res => api.repayLoan(data.loanId, res.totalOwed))
        .then(() => refreshGraph())
        .catch(err => console.error('Repay failed:', err));
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
          <span className="nav-item">
            <Zap size={14} /> Creditcoin Testnet
          </span>
          <span className="nav-item" style={{ color: judgeMode ? '#f59e0b' : undefined }}>
            ⚖ Judge: {judgeMode ? 'ON' : 'OFF'}
          </span>
          {wallet ? (
            <button className="wallet-btn connected" onClick={() => setWallet(null)}>
              <span className="wallet-dot" /> {wallet.slice(0, 6)}...{wallet.slice(-4)}
            </button>
          ) : (
            <button className="wallet-btn" onClick={handleConnect}>Connect Wallet</button>
          )}
        </div>
      </header>

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
      {showAddEvidence && <AddEvidenceModal borrower={wallet!} onClose={() => setShowAddEvidence(false)} onSuccess={refreshGraph} />}
    </div>
  );
}

// ─── Add Evidence Modal ──────────────────────────────────────
function AddEvidenceModal({ borrower, onClose, onSuccess }: { borrower: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ chainId: '1', eventType: 'INFLOW', txHash: '0x' + Math.random().toString(16).slice(2) });
  const [status, setStatus] = useState<'idle' | 'verifying' | 'polling' | 'done' | 'error'>('idle');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    setStatus('verifying');
    try {
      const res = await api.verify(form.chainId, form.eventType, form.txHash, borrower);
      setRequestId(res.requestId);
      setStatus('polling');

      // Poll for confirmation
      const poll = setInterval(async () => {
        try {
          const statusRes = await api.checkVerification(res.requestId);
          if (statusRes.status === 'CONFIRMED') {
            clearInterval(poll);
            setStatus('done');
            setResult('Evidence verified and added to graph!');
            onSuccess();
          } else if (statusRes.status === 'REJECTED') {
            clearInterval(poll);
            setStatus('error');
            setResult('Verification was rejected.');
          }
        } catch { /* keep polling */ }
      }, 1000);

      // Timeout after 15s
      setTimeout(() => clearInterval(poll), 15000);
    } catch (err: any) {
      setStatus('error');
      setResult(err.message);
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
          <p className="modal-desc">Submit a cross-chain transaction for Attestcoin verification. Once confirmed, it will appear as an evidence node in your credit graph.</p>
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
          
          {status === 'polling' && (
            <div className="verification-progress">
              <div className="loading-spinner" />
              <span>Verifying via Attestcoin... (Request: {requestId?.slice(0, 12)}...)</span>
            </div>
          )}
          {status === 'done' && <div className="result-msg success">{result}</div>}
          {status === 'error' && <div className="result-msg error">{result}</div>}

          <button
            className="primary-action-btn"
            onClick={handleSubmit}
            disabled={status === 'verifying' || status === 'polling'}
          >
            {status === 'idle' ? 'Submit for Verification' : status === 'done' ? '✓ Done' : 'Verifying...'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
