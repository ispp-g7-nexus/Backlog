import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: 'var(--tx2)', background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: 8 }}>
          <div style={{ color: '#f87171', fontWeight: 700, marginBottom: 8 }}>Error en este panel</div>
          <div style={{ fontSize: 12, color: 'var(--tx4)', fontFamily: 'monospace' }}>{this.state.error.message}</div>
          <button onClick={() => this.setState({ error: null })}
            style={{ marginTop: 12, padding: '4px 12px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
              background: 'var(--bg3)', border: '1px solid var(--bdr)', color: 'var(--tx2)' }}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
