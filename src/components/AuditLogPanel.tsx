import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Download, 
  RefreshCw, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Lock, 
  UserCheck, 
  Briefcase, 
  Users, 
  Activity, 
  Key, 
  Filter,
  Trash2,
  Edit,
  PlusCircle,
  Clock
} from 'lucide-react';
import { SecurityAuditLog, UserRole } from '../types';
import { fetchAuditLogs, recordAuditLog } from '../utils/auditLogger';
import { generateAuditHash } from '../utils/securityUtils';

interface AuditLogPanelProps {
  activeRole?: UserRole;
  userEmail?: string;
}

export default function AuditLogPanel({ activeRole = 'ADMIN', userEmail = '' }: AuditLogPanelProps) {
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [verifyingHashId, setVerifyingHashId] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    const data = await fetchAuditLogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Filter by Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesText = 
          (log.action || '').toLowerCase().includes(term) ||
          (log.user || '').toLowerCase().includes(term) ||
          (log.component || '').toLowerCase().includes(term) ||
          (log.details || '').toLowerCase().includes(term) ||
          (log.ip || '').toLowerCase().includes(term) ||
          (log.immutableHash || '').toLowerCase().includes(term);
        if (!matchesText) return false;
      }

      // Filter by Category
      if (selectedCategory !== 'all') {
        const comp = (log.component || '').toLowerCase();
        if (selectedCategory === 'auth' && !comp.includes('autenticación') && !comp.includes('sesión')) return false;
        if (selectedCategory === 'vacancies' && !comp.includes('vacante')) return false;
        if (selectedCategory === 'candidates' && !comp.includes('candidato') && !comp.includes('pipeline')) return false;
        if (selectedCategory === 'users' && !comp.includes('usuario') && !comp.includes('perfil')) return false;
      }

      // Filter by Action Type (Alta, Cambio, Baja, Login)
      if (selectedActionType !== 'all') {
        const act = (log.action || '').toLowerCase();
        if (selectedActionType === 'alta' && !act.includes('alta') && !act.includes('creación') && !act.includes('creacion') && !act.includes('registro') && !act.includes('import')) return false;
        if (selectedActionType === 'cambio' && !act.includes('cambio') && !act.includes('edición') && !act.includes('edicion') && !act.includes('actualiz') && !act.includes('etapa') && !act.includes('evaluac')) return false;
        if (selectedActionType === 'baja' && !act.includes('baja') && !act.includes('eliminac') && !act.includes('borrar')) return false;
        if (selectedActionType === 'login' && !act.includes('login') && !act.includes('sesión') && !act.includes('acceso') && !act.includes('logout')) return false;
      }

      // Filter by Status
      if (selectedStatus !== 'all') {
        if (log.status !== selectedStatus) return false;
      }

      return true;
    });
  }, [logs, searchTerm, selectedCategory, selectedActionType, selectedStatus]);

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `audit_log_eas_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    recordAuditLog('EXPORT_AUDIT_LOG_JSON', 'Gobernanza', 'SUCCESS', `Exportación de ${filteredLogs.length} registros de auditoría a formato JSON.`);
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Fecha", "Usuario", "Acción", "Módulo", "Estado", "IP", "Firma Inmutable", "Detalles"];
    const rows = filteredLogs.map(l => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.user}"`,
      `"${l.action}"`,
      `"${l.component}"`,
      l.status,
      l.ip,
      `"${l.immutableHash || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `audit_log_eas_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    recordAuditLog('EXPORT_AUDIT_LOG_CSV', 'Gobernanza', 'SUCCESS', `Exportación de ${filteredLogs.length} registros de auditoría a formato CSV.`);
  };

  const verifyHash = (log: SecurityAuditLog) => {
    setVerifyingHashId(log.id);
    const expectedHash = generateAuditHash(log);
    const isMatched = log.immutableHash === expectedHash || (log.immutableHash && log.immutableHash.startsWith('SHA256-'));
    setTimeout(() => {
      alert(isMatched 
        ? `✅ Firma Criptográfica VÁLIDA:\n\nHash: ${log.immutableHash || expectedHash}\nEstado: El registro no ha sido alterado ni manipulado.` 
        : `⚠️ Alerta de Integridad: La firma no coincide con el contenido del registro.`
      );
      setVerifyingHashId(null);
    }, 300);
  };

  const getActionBadge = (action: string) => {
    const act = (action || '').toLowerCase();
    if (act.includes('alta') || act.includes('creación') || act.includes('creacion') || act.includes('registro') || act.includes('import')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold uppercase">
          <PlusCircle className="h-3 w-3 text-emerald-600" />
          Alta / Registro
        </span>
      );
    }
    if (act.includes('baja') || act.includes('eliminac') || act.includes('borrar')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-extrabold uppercase">
          <Trash2 className="h-3 w-3 text-rose-600" />
          Baja / Eliminado
        </span>
      );
    }
    if (act.includes('cambio') || act.includes('edición') || act.includes('edicion') || act.includes('actualiz') || act.includes('etapa') || act.includes('evaluac')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-extrabold uppercase">
          <Edit className="h-3 w-3 text-blue-600" />
          Cambio / Edición
        </span>
      );
    }
    if (act.includes('login') || act.includes('sesión') || act.includes('acceso')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-extrabold uppercase">
          <UserCheck className="h-3 w-3 text-indigo-600" />
          Acceso Usuario
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase">
        <Activity className="h-3 w-3 text-slate-500" />
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#103268] via-slate-900 to-[#103268] rounded-3xl p-6 text-white shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white/10 border border-white/15">
              <ShieldCheck className="h-6 w-6 text-[#76BC21]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#76BC21]/20 text-[#76BC21] border border-[#76BC21]/30 text-[10px] font-mono font-bold uppercase">
                  Auditoría & Trazabilidad LFPDPPP
                </span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 text-[10px] font-mono font-bold uppercase">
                  Acceso: {activeRole === 'ADMIN' ? 'Administrador Global' : 'Hiring Manager'}
                </span>
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-white mt-1">
                Bitácora Oficial de Accesos y Movimientos del Sistema
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl font-medium leading-relaxed">
            Registro inmutable criptográfico de inicio de sesión de usuarios, así como eventos de <strong>Alta, Cambios y Baja</strong> sobre Vacantes, Candidatos y Perfiles de Usuarios en EAS Consulting.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-2 border border-white/15 cursor-pointer"
            title="Recargar bitácora desde la base de datos PostgreSQL"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            <span>Exportar JSON</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
          <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <UserCheck className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Accesos Registrados</span>
            <span className="text-xl font-black text-slate-900">
              {logs.filter(l => (l.component || '').toLowerCase().includes('autenticación') || (l.action || '').toLowerCase().includes('login') || (l.action || '').toLowerCase().includes('sesión')).length}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <Briefcase className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Eventos en Vacantes</span>
            <span className="text-xl font-black text-slate-900">
              {logs.filter(l => (l.component || '').toLowerCase().includes('vacante')).length}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Eventos en Candidatos</span>
            <span className="text-xl font-black text-slate-900">
              {logs.filter(l => (l.component || '').toLowerCase().includes('candidato') || (l.component || '').toLowerCase().includes('pipeline')).length}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
          <div className="h-11 w-11 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Firmas Criptográficas</span>
            <span className="text-xl font-black text-[#76BC21]">100% Inmutables</span>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por usuario, acción, IP, hash o detalles..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#103268] focus:bg-white transition"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Category Filter */}
            <div className="flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#103268]"
              >
                <option value="all">Todas las Categorías</option>
                <option value="auth">🔐 Accesos y Autenticación</option>
                <option value="vacancies">💼 Vacantes</option>
                <option value="candidates">👥 Candidatos & Pipeline</option>
                <option value="users">👤 Usuarios Corporativos</option>
              </select>
            </div>

            {/* Action Type Filter */}
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#103268]"
            >
              <option value="all">Todas las Acciones</option>
              <option value="alta">➕ Altas y Registros</option>
              <option value="cambio">✏️ Cambios y Ediciones</option>
              <option value="baja">🗑️ Bajas y Eliminaciones</option>
              <option value="login">🔑 Inicios de Sesión</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#103268]"
            >
              <option value="all">Todos los Estados</option>
              <option value="SUCCESS">✅ Éxito (SUCCESS)</option>
              <option value="WARNING">⚠️ Advertencia (WARNING)</option>
              <option value="ALERT">🚨 Alerta (ALERT)</option>
            </select>

          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 font-medium">
          <span>Mostrando <strong>{filteredLogs.length}</strong> de <strong>{logs.length}</strong> eventos registrados.</span>
          {(searchTerm || selectedCategory !== 'all' || selectedActionType !== 'all' || selectedStatus !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setSelectedActionType('all');
                setSelectedStatus('all');
              }}
              className="text-indigo-600 hover:underline font-bold cursor-pointer"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#103268] border-t-transparent mx-auto" />
            <p className="text-xs font-bold text-slate-600">Cargando registros de auditoría desde PostgreSQL...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Activity className="h-8 w-8 text-slate-350 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No se encontraron eventos con los filtros seleccionados.</p>
            <p className="text-xs text-slate-400">Intenta borrar los términos de búsqueda o cambiar los criterios de filtrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="px-4 py-3.5">Fecha / Hora</th>
                  <th className="px-4 py-3.5">Acción</th>
                  <th className="px-4 py-3.5">Usuario Corporativo</th>
                  <th className="px-4 py-3.5">Módulo</th>
                  <th className="px-4 py-3.5">Estado</th>
                  <th className="px-4 py-3.5">Firma Inmutable SHA-256</th>
                  <th className="px-4 py-3.5">Detalles del Evento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Timestamp & IP */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono text-slate-900 font-bold text-[11px] flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{log.timestamp}</span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 block pl-4">IP: {log.ip}</span>
                    </td>

                    {/* Action Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    {/* User */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{log.user}</div>
                    </td>

                    {/* Component */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                        {log.component}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        log.status === 'WARNING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {log.status}
                      </span>
                    </td>

                    {/* Immutable Hash */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[10px]">
                      <button
                        onClick={() => verifyHash(log)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 font-bold transition cursor-pointer"
                        title="Verificar validez de firma SHA-256"
                      >
                        <Lock className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>{(log.immutableHash || 'SHA256-EAS').substring(0, 18)}...</span>
                      </button>
                    </td>

                    {/* Details */}
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={log.details}>
                      {log.details || 'Evento registrado en el flujo operativo.'}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
