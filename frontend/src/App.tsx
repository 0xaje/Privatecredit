import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, LayoutDashboard, Shield, User, Plus, Zap, X } from 'lucide-react';
import type { Node } from 'reactflow';
import { createAppKit, useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { creditCoin3Testnet, mainnet } from '@reown/appkit/networks';
import GraphCanvas from './components/GraphCanvas';
import Inspector from './components/Inspector';
import ReputationView from './views/ReputationView';
import LoansView from './views/LoansView';
import JudgeView from './views/JudgeView';
import { api } from './api/client';
import './App.css';

// Reown AppKit setup
const projectId = 'b56e18d47c72ab683b108171285093e2'; // Replace with your Reown Project ID

const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [creditCoin3Testnet, mainnet],
  metadata: {
    name: 'PrivateCredit Graph',
    description: 'PrivateCredit Integration with Creditcoin',
    url: 'https://privatecredit.app',
    icons: ['https://avatars.githubusercontent.com/u/37784886']
  },
  projectId,
  features: { analytics: false }
});

function App() {
  const [activeView, setActiveView] = useState('overview');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [judgeMode, setJudgeMode] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidenceNodeIds, setEvidenceNodeIds] = useState<string[]>([]);
  const [insightScore, setInsightScore] = useState<number | null>(null);
  const [capacity, setCapacity] = useState<{ available: string; used: string } | null>(null);

  const refreshGraph = useCallback(() => {
    setRefreshTrigger(t => t + 1);
  }, []);

  const { address: wallet, isConnected } = useAppKitAccount();
  const { open: openAppKit } = useAppKit();

  const handleConnect = () => {
    openAppKit();
  };

  const handleDisconnect = () => {
    appKit.disconnect();
    setSelectedNode(null);
    setEvidenceNodeIds([]);
    setInsightScore(null);
    setCapacity(null);
    setJudgeMode(false);
    setActiveView('overview');
  };

  // When wallet disconnects via AppKit, clear states
  useEffect(() => {
    if (!isConnected) {
      setSelectedNode(null);
      setEvidenceNodeIds([]);
      setInsightScore(null);
      setCapacity(null);
      setJudgeMode(false);
      setActiveView('overview');
    }
  }, [isConnected]);

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
          .map((n: any) => n.id.replace('evidence_feat_', 'feat_'));
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
          {isConnected && wallet ? (
            <button className="wallet-btn connected" onClick={handleDisconnect}>
              <span className="wallet-dot" /> {wallet.slice(0, 6)}...{wallet.slice(-4)}
            </button>
          ) : (
            <button className="wallet-btn" onClick={handleConnect}>
              Connect Wallet
            </button>
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
          borrowerAddress={wallet ?? null}
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
  const [form, setForm] = useState({ chainId: '1', eventType: 'INFLOW', txHash: '0x' + Math.random().toString(16).slice(2) });
  const [status, setStatus] = useState<'idle' | 'verifying' | 'polling' | 'done' | 'error'>('idle');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSubmit = async () => {
    setStatus('verifying');
    try {
      const res = await api.verify(form.chainId, form.eventType, form.txHash, borrower);
      setRequestId(res.requestId);
      setStatus('polling');

      // Poll for confirmation
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await api.checkVerification(res.requestId);
          if (statusRes.status === 'CONFIRMED') {
            if (pollRef.current) clearInterval(pollRef.current);
            setStatus('done');
            setResult('Evidence verified and added to graph!');
            onSuccess();
          } else if (statusRes.status === 'REJECTED') {
            if (pollRef.current) clearInterval(pollRef.current);
            setStatus('error');
            setResult('Verification was rejected.');
          }
        } catch { /* keep polling */ }
      }, 1000);

      // Timeout after 60s
      setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setStatus('error');
          setResult('Verification timed out. The transaction might not be attested yet or the prover is taking too long.');
        }
      }, 60000);
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
