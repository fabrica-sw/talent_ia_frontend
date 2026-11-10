import React, { useState } from 'react';
import { Lock, KeyRound, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../api';

interface ForcePasswordChangeModalProps {
  isOpen: boolean;
  onPasswordChanged: () => void;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({
  isOpen,
  onPasswordChanged
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Por favor ingrese su contraseña actual');
      return;
    }
    if (newPassword.length < 10) {
      setError('La nueva contraseña debe tener al menos 10 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La nueva contraseña y la confirmación no coinciden');
      return;
    }

    try {
      setLoading(true);
      const res = await api.changePassword(currentPassword, newPassword);
      if (res.success) {
        setSuccess(true);
        // Actualizar datos del usuario almacenados en localStorage
        const storedUser = localStorage.getItem('auth_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            parsed.primer_login = false;
            localStorage.setItem('auth_user', JSON.stringify(parsed));
          } catch (e) {}
        }
        setTimeout(() => {
          onPasswordChanged();
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent p-6 border-b border-amber-500/20">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-500/20 rounded-xl border border-amber-500/30 text-amber-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-wide">
                Cambio Obligatorio de Contraseña
              </h3>
              <p className="text-xs text-amber-300/80 mt-1">
                Primer inicio de sesión detectado por políticas de seguridad EAS.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {success ? (
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-semibold text-emerald-300">¡Contraseña Actualizada!</h4>
              <p className="text-xs text-slate-300">
                Se ha verificado la actualización. Redirigiendo a su panel de trabajo...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contraseña Temporal / Actual <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nueva Contraseña Segura <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 10 caracteres"
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirmar Nueva Contraseña <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita la nueva contraseña"
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Actualizando credenciales...</span>
                    </>
                  ) : (
                    <span>Establecer Nueva Contraseña y Continuar</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
