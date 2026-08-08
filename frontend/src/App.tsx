import { useState } from 'react'
import { Activity, LayoutDashboard, Settings, User } from 'lucide-react'
import type { Node } from 'reactflow'
import GraphCanvas from './components/GraphCanvas'
import './App.css'

function App() {
  const [activeView, setActiveView] = useState('overview')
  const [wallet, setWallet] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  const views = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'reputation', label: 'Credit Reputation', icon: User },
    { id: 'loans', label: 'Loans & Capacity', icon: Activity },
    { id: 'artefacts', label: 'Artefacts', icon: Settings },
  ]

  const handleConnect = () => {
    // Mock connection for now
    setWallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
  }

  return (
    <div className="app-container">
      <header className="top-nav">
        <div className="logo">PRIVATECREDIT GRAPH</div>
        <div className="nav-links">
          <span className="nav-item">Network: Creditcoin Testnet</span>
          <span className="nav-item">Attestcoin: Live</span>
          <span className="nav-item">Judge Mode: OFF</span>
          {wallet ? (
            <button className="wallet-btn" onClick={() => setWallet(null)}>
              {wallet.substring(0,6)}...{wallet.substring(wallet.length-4)}
            </button>
          ) : (
            <button className="wallet-btn" onClick={handleConnect}>Connect Wallet</button>
          )}
        </div>
      </header>

      <aside className="left-views">
        <div className="inspector-label" style={{marginBottom: '10px'}}>VIEWS</div>
        {views.map(view => {
          const Icon = view.icon
          return (
            <button 
              key={view.id}
              className={`view-btn ${activeView === view.id ? 'active' : ''}`}
              onClick={() => setActiveView(view.id)}
            >
              <Icon size={16} style={{display:'inline', marginRight:'8px', verticalAlign:'text-bottom'}}/>
              {view.label}
            </button>
          )
        })}
      </aside>

      <main className="center-canvas">
        <GraphCanvas onNodeSelect={setSelectedNode} />
      </main>

      <aside className="right-inspector">
        <h2 className="inspector-title">Inspector</h2>
        {selectedNode ? (
          <>
            <div className="inspector-section">
              <div className="inspector-label">Type</div>
              <div className="inspector-value">{selectedNode.type}</div>
            </div>
            <div className="inspector-section">
              <div className="inspector-label">ID</div>
              <div className="inspector-value" style={{fontSize: '0.8rem', wordBreak: 'break-all'}}>{selectedNode.id}</div>
            </div>
            <div className="inspector-section">
              <div className="inspector-label">Label</div>
              <div className="inspector-value">{selectedNode.data.label}</div>
            </div>
            {selectedNode.data.status && (
              <div className="inspector-section">
                <div className="inspector-label">Status</div>
                <div className="inspector-value" style={{color: selectedNode.data.status === 'VERIFIED' ? 'var(--node-verified)' : 'var(--node-pending)'}}>
                  {selectedNode.data.status}
                </div>
              </div>
            )}
            
            {selectedNode.data.amount && (
              <div className="inspector-section">
                <div className="inspector-label">Amount</div>
                <div className="inspector-value">{selectedNode.data.amount}</div>
              </div>
            )}
            
            <button className="primary-action-btn">
              Context Action
            </button>
          </>
        ) : (
          <div className="inspector-section">
            <p className="inspector-label">Select a node in the graph to view details.</p>
          </div>
        )}
      </aside>

      <footer className="bottom-action-bar">
        <div className="status-indicators">
          <span style={{marginRight: '20px'}}>Insight Score: <strong style={{color:'var(--node-pending)'}}>--</strong></span>
          <span style={{marginRight: '20px'}}>Capacity: <strong style={{color:'var(--node-eligibility)'}}>-- / --</strong></span>
        </div>
        <div className="context-actions">
          {/* Actions appear here contextually */}
        </div>
      </footer>
    </div>
  )
}

export default App
