import React, { useState } from 'react';
import { authFetch } from '../api';
import { Mail, CheckCircle2, AlertCircle, Send, ShieldCheck, Lock } from 'lucide-react';

interface ForgotPasswordModalProps {
  onClose: () => void;
  onPasswordReset: (email: string) => void;
}

export default function ForgotPasswordModal({ onClose, onPasswordReset }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [pinCode, setPinCode] = useState(''); // Obligatoriamente vacío al iniciar
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSendRecoveryEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Por favor ingresa un correo corporativo válido.');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const res = await authFetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setMessage(data.message || 'Código enviado a tu correo electrónico.');
        setPinCode('');
        setStep('verify');
      } else if (res.status === 429) {
        setError(data.message || 'Demasiadas solicitudes de recuperación. Espera unos minutos.');
      } else {
        setError(data.message || data.error || 'No se pudo enviar el correo de recuperación. Intenta nuevamente.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error de conexión al solicitar recuperación.');
    } finally {
      setIsSending(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = pinCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Por favor ingresa el código de 6 dígitos enviado a tu correo.');
      return;
    }
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const res = await authFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          reset_code: cleanCode,
          new_password: newPassword
        })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        alert('Contraseña actualizada exitosamente. Ya puedes iniciar sesión con tu nueva clave.');
        onPasswordReset(email);
      } else {
        setError(data.message || data.error || 'Error al actualizar la contraseña.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error de conexión al actualizar contraseña.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10001, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)' }}>
      <div
        className="modal-panel glass-panel"
        style={{
          maxWidth: 450,
          padding: 24,
          borderRadius: 20,
          border: '1.5px solid #6366f1',
          boxShadow: '0 20px 40px rgba(99,102,241,0.25)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
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
            {step === 'request' ? <Mail size={30} /> : <Lock size={30} />}
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700, color: '#0f172a' }}>
            {step === 'request' ? 'Recuperación de Contraseña' : 'Establecer Nueva Contraseña'}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            {step === 'request'
              ? 'Paso 1: Ingresa tu correo corporativo para recibir el código de 6 dígitos vía n8n/SMTP.'
              : 'Paso 2: Ingresa el código recibido en tu correo y define tu nueva contraseña.'}
          </p>
        </div>

        {step === 'request' ? (
          <form onSubmit={handleSendRecoveryEmail} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="recover-email" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                Correo Electrónico Corporativo
              </label>
              <input
                id="recover-email"
                type="email"
                placeholder="usuario@empresa.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 13,
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  outline: 'none'
                }}
                required
                autoFocus
              />
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 11.5 }}>
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost"
                style={{ flex: 1, padding: 10, fontSize: 12.5, borderRadius: 10 }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSending}
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
                {isSending ? (
                  <span>Enviando...</span>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Continuar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {message && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 11.5 }}>
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <div>
              <label htmlFor="recover-code" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                Código de 6 dígitos
              </label>
              <input
                id="recover-code"
                type="text"
                maxLength={6}
                placeholder="Código de 6 dígitos"
                value={pinCode}
                onChange={(e) => { setPinCode(e.target.value.replace(/\D/g, '')); setError(null); }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: '0.25em',
                  textAlign: 'center',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  outline: 'none'
                }}
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="recover-new-pass" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                Nueva Contraseña
              </label>
              <input
                id="recover-new-pass"
                type="password"
                placeholder="Mínimo 8 caracteres"
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
              <label htmlFor="recover-confirm-pass" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                Confirmar Contraseña
              </label>
              <input
                id="recover-confirm-pass"
                type="password"
                placeholder="Repite contraseña"
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
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost"
                style={{ flex: 1, padding: 10, fontSize: 12.5, borderRadius: 10 }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="btn btn-primary"
                style={{
                  flex: 1.5,
                  padding: 10,
                  fontSize: 12.5,
                  borderRadius: 10,
                  backgroundColor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                {isSending ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Guardar Nueva Contraseña</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

