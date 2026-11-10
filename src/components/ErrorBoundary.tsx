import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[EAS ErrorBoundary Captured Exception]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 16,
            padding: 32,
            maxWidth: 550,
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              width: 54,
              height: 54,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 'bold', margin: '0 0 8px', color: '#ffffff' }}>
              Se produjo una interrupción en el renderizado
            </h2>
            
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              EAS AI Recruiting detectó un fallo inesperado. Los datos no se han perdido y puedes reintentar la acción.
            </p>

            {this.state.error && (
              <div style={{
                backgroundColor: '#020617',
                border: '1px solid #1e293b',
                borderRadius: 8,
                padding: 12,
                fontSize: 11,
                color: '#f1f5f9',
                textAlign: 'left',
                fontFamily: 'monospace',
                maxHeight: 140,
                overflowY: 'auto',
                marginBottom: 20,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}>
                <div><strong>Detalle:</strong> {this.state.error.toString()}</div>
                {this.state.errorInfo?.componentStack && (
                  <div style={{ marginTop: 8, color: '#64748b', fontSize: 10 }}>
                    <strong>Pila de Componentes:</strong>
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Reintentar Vista
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                  } catch (e) {}
                  window.location.reload();
                }}
                style={{
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Limpiar Caché y Recargar
              </button>
              
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <RefreshCw size={14} /> Recargar Aplicación
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
