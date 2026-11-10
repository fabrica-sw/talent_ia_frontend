import React, { useState } from 'react';
import { KeyRound, Lock, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

interface PasswordChangeModalProps {
  userEmail: string;
  isFirstLogin?: boolean;
  onSuccess: (newPassword: string) => void;
  onCancel?: () => void;
}

export default function PasswordChangeModal({ userEmail, isFirstLogin = true, onSuccess, onCancel }: PasswordChangeModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor verifica.');
      return;
    }

    onSuccess(newPassword);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10001, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)' }}>
      <div 
        className="modal-panel glass-panel" 
        style={{ 
          maxWidth: 440, 
          padding: 24, 
          borderRadius: 20, 
          border: '1.5px solid #6366f1',
          boxShadow: '0 20px 40px rgba(99,102,241,0.25)'
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
            <KeyRound size={30} />
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
            {isFirstLogin ? 'Cambio Obligatorio de Contraseña' : 'Actualizar Contraseña'}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            {isFirstLogin 
              ? 'Por seguridad en tu primer inicio de sesión, debes definir una nueva contraseña personalizada.' 
              : 'Actualiza tus credenciales de acceso resguardadas encriptadamente.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: 10, borderRadius: 10, fontSize: 11.5 }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Cuenta de Usuario: </span>
            <strong style={{ color: '#0f172a' }}>{userEmail}</strong>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Nueva Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13,
                borderRadius: 10,
                border: '1.5px solid #cbd5e1',
                outline: 'none'
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Confirmar Nueva Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13,
                borderRadius: 10,
                border: '1.5px solid #cbd5e1',
                outline: 'none'
              }}
              required
            />
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 11.5 }}>
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-ghost"
                style={{ flex: 1, padding: 10, fontSize: 12.5, borderRadius: 10 }}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ 
                flex: 1.5, 
                padding: 10, 
                fontSize: 12.5, 
                borderRadius: 10, 
                backgroundColor: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <ShieldCheck size={16} />
              <span>Guardar Contraseña</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
