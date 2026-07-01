import { StrictMode, Component, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#fff', minHeight: '100vh' }}>
          <h2 style={{ color: '#c00', marginBottom: 16 }}>Erro na aplicação</h2>
          <p style={{ marginBottom: 8 }}><strong>{err.message}</strong></p>
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 400 }}>
            {err.stack}
          </pre>
          <button
            style={{ marginTop: 24, padding: '10px 20px', background: '#1f6feb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
            onClick={() => { localStorage.clear(); window.location.reload(); }}
          >
            Limpar cache e recarregar
          </button>
          <button
            style={{ marginTop: 24, marginLeft: 12, padding: '10px 20px', background: '#666', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
