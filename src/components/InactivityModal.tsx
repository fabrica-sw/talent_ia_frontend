import React from 'react';
import { ShieldAlert, Clock, Lock, RefreshCw } from 'lucide-react';

interface InactivityModalProps {
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
}

export default function InactivityModal({ secondsRemaining, onStayLoggedIn, onLogoutNow }: InactivityModalProps) {
  return (
    <div className="modal-overlay" style={{ zIndex: 10000, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div 
        className="modal-panel glass-panel" 
        style={{ 
          maxWidth: 420, 
          padding: 24, 
          borderRadius: 20, 
          border: '1.5px solid #f59e0b',
          boxShadow: '0 25px 50px rgba(245,158,11,0.25)',
          textAlign: 'center'
        }}
      >
        <div style={{ 
          width: 60, 
          height: 60, 
          borderRadius: 18, 
          backgroundColor: '#fef3c7', 
          color: '#d97706', 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: 14
        }}>
          <ShieldAlert size={34} />
        </div>

        <h2 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800, color: '#0f172a' }}>
          Advertencia de Inactividad (15 min)
        </h2>

        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>
          Por protocolo de protección de datos personales y la norma ISO 27001, tu sesión se cerrará automáticamente en:
        </p>

        <div style={{ 
          backgroundColor: '#fffbeb', 
          border: '1px solid #fde68a', 
          padding: '12px 16px', 
          borderRadius: 14, 
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10
        }}>
          <Clock size={22} className="text-amber-600 animate-pulse" />
          <span style={{ fontSize: 28, fontWeight: 900, color: '#b45309', fontFamily: 'monospace' }}>
            00:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onLogoutNow}
            className="btn btn-ghost"
            style={{ 
              flex: 1, 
              padding: 10, 
              fontSize: 12, 
              borderRadius: 10,
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Lock size={14} />
            <span>Bloquear Ahora</span>
          </button>

          <button
            type="button"
            onClick={onStayLoggedIn}
            className="btn btn-primary"
            style={{ 
              flex: 1.4, 
              padding: 10, 
              fontSize: 12, 
              borderRadius: 10, 
              backgroundColor: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <RefreshCw size={14} />
            <span>Mantener Sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}
