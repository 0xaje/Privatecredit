import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  Zap,
  Scale,
  Plus,
  RefreshCw,
  TrendingUp,
  Cpu,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { Node } from 'reactflow';
import GraphCanvas from './components/GraphCanvas';
import ReputationView from './views/ReputationView';
import LoansView from './views/LoansView';
import JudgeView from './views/JudgeView';
import { api } from './api/client';
import './App.css';
import { useCreditcoinWallet } from './wallet';
import { CustomConnectButton } from './components/CustomConnectButton';

export default function App() {
  const [activeView, setActiveView] = useState<'overview' | 'reputation' | 'loans' | 'judge'>('overview');
  const { address } = useCreditcoinWallet();
  const [presetAddress, setPresetAddress] = useState<string>('0x71c7656ec7ab88b098defb751b7401b5f6d8976f');
  const activeWallet = address || presetAddress;
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [evidenceNodeIds, setEvidenceNodeIds] = useState<string[]>([]);
  const [graphStats, setGraphStats] = useState<{ nodeCount: number; edgeCount: number; verifiedCount: number }>({
    nodeCount: 0,
    edgeCount: 0,
    verifiedCount: 0,
  });

  const refreshGraph = useCallback(() => {
    setRefreshTrigger(t => t + 1);
  }, []);

  useEffect(() => {
    if (!activeWallet) return;

    api.getGraph(activeWallet)
      .then(data => {
        const nodes = data.nodes || [];
        const edges = data.edges || [];
        const evIds = nodes.filter((n: any) => n.type === 'EVIDENCE').map((n: any) => n.id);
        setEvidenceNodeIds(evIds);
        setGraphStats({
          nodeCount: nodes.length,
          edgeCount: edges.length,
          verifiedCount: nodes.filter((n: any) => n.verified).length,
        });
      })
      .catch(() => {
        setEvidenceNodeIds([]);
      });
  }, [activeWallet, refreshTrigger]);

  return (
    <div className="app-container">
      {/* ═══════════════ TOP NAVIGATION ═══════════════ */}
      <header className="top-nav">
        <div className="logo-container">
          <div className="logo-badge">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="logo-text">PRIVATECREDIT GRAPH</div>
            <div className="logo-sub">Autonomous Underwriting Terminal</div>
          </div>
        </div>

        <div className="top-center-telemetry">
          <div className="telemetry-item">
            <span className="telemetry-label">Network</span>
            <span className="telemetry-val" style={{ color: '#38bdf8' }}>Creditcoin CC3</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-label">USC Prover</span>
            <span className="telemetry-val" style={{ color: '#34d399' }}>0x0FD2 Active</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-label">Verified Nodes</span>
            <span className="telemetry-val">{graphStats.verifiedCount} / {graphStats.nodeCount}</span>
          </div>
        </div>

        <CustomConnectButton />
      </header>

      {/* ═══════════════ LEFT SIDEBAR ═══════════════ */}
      <aside className="left-sidebar">
        <div className="sidebar-nav-group">
          <div className="sidebar-section-title">Navigation Desks</div>

          <button
            className={`nav-tab-btn ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveView('overview')}
          >
            <div className="nav-tab-left">
              <LayoutDashboard className="w-4 h-4" />
              <span>Full Graph View</span>
            </div>
            <span className="nav-tab-badge">HUD</span>
          </button>

          <button
            className={`nav-tab-btn ${activeView === 'reputation' ? 'active' : ''}`}
            onClick={() => setActiveView('reputation')}
          >
            <div className="nav-tab-left">
              <ShieldCheck className="w-4 h-4" />
              <span>Credit Reputation</span>
            </div>
            <span className="nav-tab-badge">{evidenceNodeIds.length} Ev</span>
          </button>

          <button
            className={`nav-tab-btn ${activeView === 'loans' ? 'active' : ''}`}
            onClick={() => setActiveView('loans')}
          >
            <div className="nav-tab-left">
              <Zap className="w-4 h-4" />
              <span>Lending & Loans</span>
            </div>
            <span className="nav-tab-badge">Market</span>
          </button>

          <button
            className={`nav-tab-btn ${activeView === 'judge' ? 'active' : ''}`}
            onClick={() => setActiveView('judge')}
          >
            <div className="nav-tab-left">
              <Scale className="w-4 h-4" />
              <span>Auditor Workspace</span>
            </div>
            <span className="nav-tab-badge">Zero-Trust</span>
          </button>

          {/* Account Profile Presets */}
          <div className="account-selector-box">
            <div className="sidebar-section-title" style={{ padding: '0 0 4px 0' }}>Demo Profiles</div>
            <button
              className={`account-btn ${presetAddress === '0x71c7656ec7ab88b098defb751b7401b5f6d8976f' ? 'active' : ''}`}
              onClick={() => setPresetAddress('0x71c7656ec7ab88b098defb751b7401b5f6d8976f')}
            >
              <span>Veteran Account</span>
              <span style={{ fontSize: '0.65rem', color: '#10b981' }}>Tier 1 (AAA)</span>
            </button>
            <button
              className={`account-btn ${presetAddress === '0x1111111111111111111111111111111111111111' ? 'active' : ''}`}
              onClick={() => setPresetAddress('0x1111111111111111111111111111111111111111')}
            >
              <span>Standard Account</span>
              <span style={{ fontSize: '0.65rem', color: '#38bdf8' }}>Tier 2 (AA)</span>
            </button>
            <button
              className={`account-btn ${presetAddress === '0x9999999999999999999999999999999999999999' ? 'active' : ''}`}
              onClick={() => setPresetAddress('0x9999999999999999999999999999999999999999')}
            >
              <span>High-Risk Account</span>
              <span style={{ fontSize: '0.65rem', color: '#f43f5e' }}>Tier 3 (B)</span>
            </button>
          </div>
        </div>

        <div className="sidebar-footer-stats">
          <div className="live-beacon">
            <div className="beacon-dot" />
            <span>SSE Real-Time Feed Active</span>
          </div>
        </div>
      </aside>

      {/* ═══════════════ CENTER INTERACTIVE STAGE ═══════════════ */}
      <main className="center-stage">
        {/* Floating Top Canvas HUD */}
        <div className="canvas-floating-hud">
          <div className="hud-glass-card">
            <div className="hud-pill">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Lineage: Wallet &rarr; Evidence &rarr; Eligibility &rarr; Loan</span>
            </div>
          </div>
          <div className="hud-glass-card">
            <div className="hud-pill">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>LTV Bounds: 80% Max</span>
            </div>
          </div>
        </div>

        <GraphCanvas
          borrowerAddress={activeWallet}
          onNodeSelect={setSelectedNode}
          refreshTrigger={refreshTrigger}
        />

        {/* Floating Bottom Quick Actions */}
        <div className="floating-action-bar">
          <button className="quick-action-btn" onClick={() => setActiveView('reputation')}>
            <Plus className="w-3.5 h-3.5" /> Add Evidence
          </button>
          <button className="quick-action-btn" onClick={() => setActiveView('loans')}>
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Borrow / Lend
          </button>
          <button className="quick-action-btn" onClick={refreshGraph}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Graph
          </button>
        </div>
      </main>

      {/* ═══════════════ RIGHT WORKSPACE CONSOLE ═══════════════ */}
      <aside className="right-workspace">
        {activeView === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="workspace-header">
              <div className="workspace-title">
                <LayoutDashboard className="w-5 h-5 text-sky-400" />
                <span>Protocol Terminal Overview</span>
              </div>
            </div>

            <div className="glass-stat-card">
              <div className="glass-stat-label">Active Wallet Subject</div>
              <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#38bdf8', marginTop: '4px' }}>
                {activeWallet}
              </div>
            </div>

            <div className="stats-grid-2">
              <div className="glass-stat-card">
                <div className="glass-stat-label">Verified Nodes</div>
                <div className="glass-stat-val" style={{ color: '#34d399' }}>{graphStats.verifiedCount}</div>
              </div>
              <div className="glass-stat-card">
                <div className="glass-stat-label">Graph Edges</div>
                <div className="glass-stat-val" style={{ color: '#818cf8' }}>{graphStats.edgeCount}</div>
              </div>
            </div>

            <div className="glass-stat-card">
              <div className="glass-stat-label">Selected Graph Node</div>
              {selectedNode ? (
                <div style={{ marginTop: '8px', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 700, color: '#fff' }}>ID: {selectedNode.id}</div>
                  <div style={{ color: '#94a3b8' }}>Type: {selectedNode.type}</div>
                </div>
              ) : (
                <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#94a3b8' }}>
                  Click any node on the graph canvas to inspect its cryptographic proof parameters.
                </div>
              )}
            </div>

            <button
              className="execute-btn"
              onClick={() => setActiveView('loans')}
            >
              <span>Open Lending Desk</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeView === 'reputation' && (
          <ReputationView
            borrowerAddress={activeWallet}
            evidenceNodeIds={evidenceNodeIds}
            onEligibilityRegistered={refreshGraph}
          />
        )}

        {activeView === 'loans' && (
          <LoansView
            borrowerAddress={activeWallet}
            onLoanAction={refreshGraph}
          />
        )}

        {activeView === 'judge' && (
          <JudgeView
            borrowerAddress={activeWallet}
          />
        )}
      </aside>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="bottom-footer">
        <div className="footer-left">
          <span>PrivateCredit Graph Protocol &bull; CC3 Testnet (102031)</span>
          <span>USC Proof Engine Verified</span>
        </div>
        <div className="footer-right">
          <span>Block Prover: 0x0FD2</span>
          <span>Zero-Knowledge ASC</span>
        </div>
      </footer>
    </div>
  );
}
