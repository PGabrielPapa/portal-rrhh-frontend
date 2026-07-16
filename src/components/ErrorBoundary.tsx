import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

// Límite de errores: si una pantalla falla en tiempo de ejecución, muestra un aviso
// claro y mantiene el resto del portal usable (el menú sigue), en vez de dejar todo en blanco.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { console.error('[ErrorBoundary]', error); }
  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ maxWidth: 560, margin: '24px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <h3 style={{ marginTop: 8 }}>Esta pantalla tuvo un problema</h3>
          <p className="muted" style={{ fontSize: 13 }}>
            Ocurrió un error al mostrar esta sección. Podés volver a intentarlo o ir al inicio; el resto del portal sigue funcionando.
          </p>
          <div className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 10 }}>
            <button className="btn" onClick={this.reset}>Reintentar</button>
            <a className="btn ghost" href="/">Ir al inicio</a>
          </div>
          <details style={{ marginTop: 12, textAlign: 'left' }}>
            <summary className="muted" style={{ fontSize: 12, cursor: 'pointer' }}>Detalle técnico</summary>
            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: 'var(--red)' }}>{String(this.state.error?.message || this.state.error)}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
