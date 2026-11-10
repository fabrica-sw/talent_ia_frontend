import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Search,
  RefreshCw,
  Power,
  KeyRound,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { api } from '../api';
import { recordAuditLog } from '../utils/auditLogger';
import { copyToClipboard } from '../utils/clipboardUtils';

export interface AppUser {
  id: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'leader' | 'user' | 'director';
  activo: boolean;
  primer_login: boolean;
  created_at: string;
}

export const UserManagementPanel: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State: Create User
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createNombre, setCreateNombre] = useState('');
  const [createRol, setCreateRol] = useState<'admin' | 'leader' | 'user' | 'director'>('user');
  const [actionLoading, setActionLoading] = useState(false);

  // Modal State: Reset Password
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');

  // Modal State: Edit User
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editRol, setEditRol] = useState<'admin' | 'leader' | 'user' | 'director'>('user');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.adminUsers('list');
      if (res.success && res.users) {
        setUsers(res.users);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar la lista de usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // State: Ficha Out-of-Band para entrega segura
  const [outOfBandCard, setOutOfBandCard] = useState<{ email: string; nombre: string; tempPass: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Helper para generar contraseñas efímeras de alta entropía (14 caracteres)
  const generateSecureTempPassword = (): string => {
    const charsUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const charsLower = 'abcdefghijkmnopqrstuvwxyz';
    const charsNum = '23456789';
    const charsSym = '!@#$%&*?';
    
    let pass = '';
    pass += charsUpper.charAt(Math.floor(Math.random() * charsUpper.length));
    pass += charsLower.charAt(Math.floor(Math.random() * charsLower.length));
    pass += charsNum.charAt(Math.floor(Math.random() * charsNum.length));
    pass += charsSym.charAt(Math.floor(Math.random() * charsSym.length));

    const all = charsUpper + charsLower + charsNum + charsSym;
    for (let i = 4; i < 14; i++) {
      pass += all.charAt(Math.floor(Math.random() * all.length));
    }
    // Shuffle
    return pass.split('').sort(() => 0.5 - Math.random()).join('');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await api.adminUsers('create', {
        email: createEmail,
        password: createPassword,
        nombre: createNombre,
        rol: createRol
      });
      if (res.success) {
        recordAuditLog('ALTA_USUARIO', 'Usuarios', 'SUCCESS', `Creación de nuevo usuario corporativo ${createEmail} (Rol: ${createRol}).`);
        setShowCreateModal(false);
        setOutOfBandCard({
          email: createEmail,
          nombre: createNombre,
          tempPass: createPassword
        });
        setCreateEmail('');
        setCreatePassword('');
        setCreateNombre('');
        setCreateRol('user');
        await fetchUsers();
      }
    } catch (err: any) {
      alert(`Error al crear usuario: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (user: AppUser) => {
    const confirmText = user.activo
      ? `¿Está seguro de desactivar la cuenta de ${user.nombre} (${user.email})?`
      : `¿Está seguro de activar la cuenta de ${user.nombre} (${user.email})?`;
    if (!window.confirm(confirmText)) return;

    try {
      const res = await api.adminUsers('toggle_active', { id: user.id, activo: !user.activo });
      if (res.success) {
        recordAuditLog('CAMBIO_ESTADO_USUARIO', 'Usuarios', 'WARNING', `Cambio de estado activo (${!user.activo}) para usuario ${user.email}.`);
        await fetchUsers();
      }
    } catch (err: any) {
      alert(`Error al cambiar estado del usuario: ${err.message}`);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId || !resetNewPassword) return;

    const targetUser = users.find(u => u.id === resetUserId);

    try {
      setActionLoading(true);
      const res = await api.adminUsers('reset_password', { id: resetUserId, new_password: resetNewPassword });
      if (res.success) {
        recordAuditLog('REINICIO_PASSWORD_USUARIO', 'Usuarios', 'WARNING', `Reseteo de contraseña forzado para usuario ID ${resetUserId}.`);
        setOutOfBandCard({
          email: targetUser ? targetUser.email : 'usuario@easconsulting.com.mx',
          nombre: targetUser ? targetUser.nombre : 'Usuario EAS',
          tempPass: resetNewPassword
        });
        setResetUserId(null);
        setResetNewPassword('');
        await fetchUsers();
      }
    } catch (err: any) {
      alert(`Error al reiniciar contraseña: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    try {
      setActionLoading(true);
      const res = await api.adminUsers('update', { id: editUser.id, nombre: editNombre, rol: editRol });
      if (res.success) {
        recordAuditLog('CAMBIO_USUARIO', 'Usuarios', 'SUCCESS', `Actualización de perfil/rol para usuario ${editUser.email} (Nombre: ${editNombre}, Rol: ${editRol}).`);
        setEditUser(null);
        await fetchUsers();
      }
    } catch (err: any) {
      alert(`Error al actualizar usuario: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = (users || []).filter(
    (u) =>
      (u?.nombre || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (u?.email || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (u?.rol || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const getRoleBadge = (rol: string) => {
    switch (rol) {
      case 'admin':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">ADMINISTRADOR</span>;
      case 'director':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">DIRECTOR</span>;
      case 'leader':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">LÍDER TÉCNICO</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600">USUARIO ESTÁNDAR</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span>Control de Usuarios y Accesos RBAC</span>
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Gestión centralizada de perfiles, roles de seguridad y sincronización automática vía Trigger PostgreSQL.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchUsers}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            title="Recargar usuarios"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/20 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nombre, email o rol..."
          className="w-full pl-11 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <span className="text-sm">Cargando usuarios desde PostgreSQL...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-300 flex flex-col items-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-rose-400" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No se encontraron usuarios registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Primer Login</th>
                  <th className="px-6 py-4">Fecha Creación</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{u.nombre}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>

                    <td className="px-6 py-4">{getRoleBadge(u.rol)}</td>

                    <td className="px-6 py-4">
                      {u.activo ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          <XCircle className="w-3.5 h-3.5 text-rose-400" /> Inactivo
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {u.primer_login ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5" /> Pendiente
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Completado</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(u.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                      {/* Editar usuario */}
                      <button
                        onClick={() => {
                          setEditUser(u);
                          setEditNombre(u.nombre);
                          setEditRol(u.rol);
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                        title="Editar Perfil"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Resetear Contraseña */}
                      <button
                        onClick={() => setResetUserId(u.id)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                        title="Resetear Contraseña"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>

                      {/* Activar / Desactivar */}
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          u.activo
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                        title={u.activo ? 'Desactivar Cuenta' : 'Activar Cuenta'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              <span>Crear Nuevo Usuario (Trigger Auth)</span>
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={createNombre}
                  onChange={(e) => setCreateNombre(e.target.value)}
                  placeholder="Ej. María González"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="usuario@eas.com"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña Inicial</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Mínimo 10 caracteres"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Rol RBAC</label>
                <select
                  value={createRol}
                  onChange={(e) => setCreateRol(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="user">usuario (User)</option>
                  <option value="leader">leader (Líder Técnico)</option>
                  <option value="director">director (Director)</option>
                  <option value="admin">admin (Administrador)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Crear Usuario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Resetear Contraseña */}
      {resetUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <span>Resetear Contraseña de Usuario</span>
            </h3>

            <p className="text-xs text-slate-400">
              Establezca una nueva contraseña o genere una clave efímera segura. El usuario deberá cambiarla obligatoriamente en su próximo inicio de sesión.
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">Nueva Contraseña Efímera</label>
                  <button
                    type="button"
                    onClick={() => setResetNewPassword(generateSecureTempPassword())}
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline cursor-pointer flex items-center gap-1"
                  >
                    <span>🎲 Generar Efímera</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Ingrese o genere contraseña efímera"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-amber-300 font-mono text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetUserId(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 text-sm font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Guardar y Forzar Primer Login</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ficha Out-of-Band (Entrega Segura de Credenciales) */}
      {outOfBandCard && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Ficha de Acceso Out-of-Band Generada</h3>
                <p className="text-xs text-emerald-300/80">
                  Transmita estas credenciales temporales únicamente por un canal interno seguro.
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-sm font-mono text-slate-300">
              <div>
                <span className="text-slate-500 text-xs block">USUARIO:</span>
                <span className="text-white font-semibold">{outOfBandCard.nombre}</span> ({outOfBandCard.email})
              </div>
              <div>
                <span className="text-slate-500 text-xs block">CONTRASEÑA EFÍMERA:</span>
                <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-base">{outOfBandCard.tempPass}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">POLÍTICA DE SEGURIDAD:</span>
                <span className="text-slate-400 text-xs italic block">El sistema forzará el cambio obligatorio de esta clave en el primer inicio de sesión.</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={async () => {
                  const payload = `📌 ACCESO TEMPORAL EAS RECRUITING\nUsuario: ${outOfBandCard.email}\nContraseña Efímera: ${outOfBandCard.tempPass}\n\n*Por políticas de seguridad en producción, el sistema te solicitará cambiar tu contraseña inmediatamente al iniciar sesión.*`;
                  const success = await copyToClipboard(payload);
                  if (success) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center space-x-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-white" /> : <KeyRound className="w-4 h-4 text-white" />}
                <span>{copied ? '¡Copiado al Portapapeles!' : 'Copiar Ficha Out-of-Band'}</span>
              </button>

              <button
                type="button"
                onClick={() => setOutOfBandCard(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Usuario */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-indigo-400" />
              <span>Editar Usuario ({editUser.email})</span>
            </h3>

            <form onSubmit={handleUpdateUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Rol RBAC</label>
                <select
                  value={editRol}
                  onChange={(e) => setEditRol(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="user">usuario (User)</option>
                  <option value="leader">leader (Líder Técnico)</option>
                  <option value="director">director (Director)</option>
                  <option value="admin">admin (Administrador)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
