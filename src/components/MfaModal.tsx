import React, { useState } from 'react';
import { ShieldCheck, Lock, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { verifyTotpCode } from '../utils/securityUtils';

interface MfaModalProps {
  userEmail: string;
  userRole: string;
  onVerified: () => void;
  onCancel: () => void;
}

export default function MfaModal({ userEmail, userRole, onVerified, onCancel }: MfaModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.trim().length !== 6) {
      setError('Por favor ingresa un código TOTP válido de 6 dígitos.');
      return;
    }

    setIsVerifying(true);
    setError(null);

    setTimeout(() => {
      if (verifyTotpCode(code)) {
        setIsVerifying(false);
        onVerified();
      } else {
        setIsVerifying(false);
        setError('Código MFA inválido o expirado. Verifica tu app 2FA o Google Authenticator.');
      }
    }, 600);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div 
        className="modal-panel glass-panel" 
        style={{ 
          maxWidth: 440, 
          padding: 24, 
          borderRadius: 20, 
          border: '1px solid #6366f1',
          boxShadow: '0 20px 40px rgba(99,102,241,0.2)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ 
            width: 56, 
            height: 56, 
            borderRadius: 16, 
            backgroundColor: '#e0e7ff', 
            color: '#4338ca', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: 12
          }}>
            <ShieldCheck size={32} />
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
            Desafío de Autenticación MFA (2FA)
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Requerido para el rol de <strong style={{ color: '#4f46e5' }}>{userRole}</strong> bajo norma ISO 27001 (Anexo A.5 y A.8).
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: 12, borderRadius: 12, fontSize: 12 }}>
            <span style={{ display: 'block', color: '#475569', fontWeight: 600 }}>Usuario en verificación:</span>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>{userEmail || 'usuario@easconsulting.com'}</span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Código de Verificación TOTP (6 dígitos)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''));
                  setError(null);
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: '0.3em',
                  textAlign: 'center',
                  borderRadius: 12,
                  border: error ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
                autoFocus
              />
            </div>
            <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#64748b' }}>
              Abre tu aplicación Authenticator para consultar tu token.
            </span>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12 }}>
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-ghost"
              style={{ flex: 1, padding: 10, fontSize: 13, borderRadius: 10 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isVerifying}
              className="btn btn-primary"
              style={{ 
                flex: 1.5, 
                padding: 10, 
                fontSize: 13, 
                borderRadius: 10, 
                backgroundColor: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              {isVerifying ? (
                <span>Validando...</span>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Verificar Token</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
