import React from 'react';
import { 
  Users, 
  LayoutDashboard, 
  Calendar, 
  ShieldCheck, 
  Database, 
  Settings, 
  LogOut, 
  Sparkles,
  ChevronDown,
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Lock,
  Briefcase
} from 'lucide-react';
import { UserRole } from '../types';
import { EasLogo } from './EasLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  userEmail: string;
  userName?: string;
  userArea?: string;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  onLogout?: () => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  activeRole, 
  setActiveRole,
  userEmail,
  userName = 'Eduardo Aguilar',
  userArea = 'Atracción de Talento',
  isCollapsed,
  setIsCollapsed,
  isMobileOpen = false,
  setIsMobileOpen,
  onLogout
}: SidebarProps) {

  const menuItems = [
    { 
      id: 'dashboard', 
      label: 'Tablero de Control', 
      icon: LayoutDashboard,
      allowedRoles: ['ADMIN', 'RECRUITER', 'MANAGER']
    },
    { 
      id: 'vacancies', 
      label: 'Vacantes Activas', 
      icon: Briefcase,
      allowedRoles: ['ADMIN', 'RECRUITER', 'MANAGER']
    },
    { 
      id: 'candidates', 
      label: 'Pipeline de Talento', 
      icon: Users,
      allowedRoles: ['ADMIN', 'RECRUITER', 'MANAGER']
    },
    { 
      id: 'audit', 
      label: 'Log de Accesos y Auditoría', 
      icon: ShieldCheck,
      allowedRoles: ['ADMIN', 'MANAGER', 'RECRUITER']
    },
    { 
      id: 'governance', 
      label: 'Gobernanza y Privacidad', 
      icon: ShieldCheck,
      allowedRoles: ['ADMIN']
    },
    { 
      id: 'integrations', 
      label: 'Integración e Integridad', 
      icon: Database,
      allowedRoles: ['ADMIN']
    }
  ];
  // Map roles to gorgeous high-contrast badges for improved readability!
  const roleBadges: Record<UserRole, { label: string, color: string, ring: string }> = {
    ADMIN: { label: 'Administrador Global', color: 'bg-emerald-50 text-[#0f5132] border-[#a3cfbb]', ring: 'ring-emerald-500/10' },
    RECRUITER: { label: 'Consultor Reclutamiento', color: 'bg-eas-blue-50 text-[#103268] border-eas-blue-200', ring: 'ring-eas-blue-500/10' },
    MANAGER: { label: 'Hiring Manager (Área)', color: 'bg-purple-50 text-[#410c6a] border-purple-200', ring: 'ring-purple-500/10' }
  };

  const isAdmin = (userEmail || '').toLowerCase().trim() === 'enrique.aguilar@easconsulting.com.mx' || activeRole === 'ADMIN';
  const isEstefany = (userEmail || '').toLowerCase().includes('estefany') || (userName || '').toLowerCase().includes('estefany');

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (setIsMobileOpen) setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 lg:static flex flex-col h-screen bg-white border-r border-slate-200 shrink-0 select-none text-slate-700 shadow-xl lg:shadow-xs transition-all duration-300 ease-in-out ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } ${isCollapsed ? 'w-20' : 'w-72'}`}>
        {/* Brand Header */}
        <div className={`border-b border-slate-100 ${isCollapsed ? 'p-4 flex flex-col items-center justify-center' : 'p-6'}`}>
          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-4' : 'justify-between w-full'}`}>
            <button
              onClick={() => handleTabClick('dashboard')}
              className="focus:outline-none focus:ring-0 cursor-pointer"
              style={{ background: 'none', border: 'none', padding: 0 }}
              title="Ir al Tablero de Control"
            >
              <EasLogo 
                showText={!isCollapsed} 
                className="h-11" 
                iconClassName="h-11 w-11 shrink-0" 
                textClassName="text-[#103268]" 
              />
            </button>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`hidden lg:block p-1.5 text-slate-400 hover:text-eas-blue-500 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all duration-150 cursor-pointer ${isCollapsed ? 'mt-1' : ''}`}
                title={isCollapsed ? "Expandir menú de navegación" : "Contraer menú de navegación"}
              >
                {isCollapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
              </button>
              
              {/* Close Button on Mobile Drawer */}
              {setIsMobileOpen && (
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="lg:hidden p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                  title="Cerrar menú"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        
        {/* EAS AI Banner - Under elegant light palette, hidden when collapsed */}
        {!isCollapsed && (
          <div className="mt-4 p-2 rounded-xl bg-gradient-to-r from-eas-blue-50 to-eas-blue-100/30 border border-eas-blue-100/80 flex items-center gap-2 animate-fadeIn">
            <Sparkles className="h-4 w-4 text-[#76BC21] animate-pulse shrink-0" strokeWidth={2.5} />
            <span className="text-[11px] font-extrabold text-[#103268] font-sans">EAS TalentCore AI™</span>
          </div>
        )}
      </div>

      {/* Navigation section */}
      <nav className={`flex-1 space-y-1.5 overflow-y-auto ${isCollapsed ? 'p-2 flex flex-col items-center' : 'p-4'}`}>
        {!isCollapsed && (
          <div className="px-3 mb-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">
            Menú de Herramientas
          </div>
        )}
        
        {menuItems.map((item) => {
          const isAllowed = item.allowedRoles.includes(activeRole);
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          if (!isAllowed) return null;
          if (isEstefany && (item.id === 'governance' || item.id === 'integrations')) return null;

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`flex items-center rounded-xl text-sm font-bold transition-all duration-150 cursor-pointer ${
                isCollapsed 
                  ? 'justify-center p-3 w-12 h-12' 
                  : 'w-full gap-3 px-3.5 py-2.5'
              } ${
                isActive 
                  ? 'bg-[#103268] text-white shadow-md shadow-[#103268]/20 border border-[#103268]/20' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-[#103268]'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={`h-4.5 w-4.5 shrink-0 transition-colors duration-150 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
              {!isCollapsed && isActive && (
                <div className="ml-auto w-2 h-2 bg-[#76BC21] rounded-full shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User Profile Panel */}
      <div className={`border-t border-slate-100 bg-slate-50/50 ${isCollapsed ? 'p-2 flex flex-col items-center gap-4' : 'p-4 space-y-3'}`}>
        
        {/* Dynamic drop-down - ONLY VISIBLE FOR ADMIN USERS */}
        {isAdmin && !isCollapsed && (
          <div className="space-y-1 animate-fadeIn">
            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block px-1 leading-none">
              Perspectiva Multi-Rol
            </span>
            <div className="relative group">
              <select
                value={activeRole}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  setActiveRole(newRole);
                  const allowedTabs = menuItems
                    .filter(m => m.allowedRoles.includes(newRole))
                    .map(m => m.id);
                  if (!allowedTabs.includes(activeTab)) {
                    setActiveTab('dashboard');
                  }
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#103268]/15 focus:border-[#103268] cursor-pointer appearance-none pr-9 transition-all duration-150 font-sans"
              >
                <option value="ADMIN">Administrador (TI & Config)</option>
                <option value="RECRUITER">Reclutador Especialista</option>
                <option value="MANAGER">Gerente Directivo (Hiring)</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>
        )}

        {isAdmin && isCollapsed && (
          <div className="relative group" title={`Rol activo: ${(roleBadges[activeRole] || roleBadges.ADMIN).label}.`}>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center cursor-help">
              <Settings className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
            </div>
          </div>
        )}

        {/* User Identity Info */}
        <div className="flex flex-col gap-2 w-full">
          <div 
            className={`bg-white border rounded-xl flex items-center shadow-2xs w-full ${
              isCollapsed 
                ? 'p-2 justify-center h-12 border-slate-100' 
                : 'p-3 gap-3 border-slate-150'
            }`}
            title={isCollapsed ? `${userName} (${userEmail}) - ${userArea}` : undefined}
          >
            <div className="h-9 w-9 bg-eas-blue-50 border border-eas-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <UserCheck className="h-4.5 text-[#103268]" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 animate-fadeIn">
                <div className="flex items-center gap-1">
                  <span className="truncate text-xs font-black text-slate-900" title={userName}>
                    {userName}
                  </span>
                  <span title="Usuario Corporativo Verificado"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" /></span>
                </div>
                <div className="truncate text-[10px] font-semibold text-slate-500 font-mono" title={userEmail}>
                  {userEmail}
                </div>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    {userArea}
                  </span>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${roleBadges[activeRole].color}`}>
                    {roleBadges[activeRole].label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {onLogout && !isCollapsed && (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer font-sans"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar Sesión
            </button>
          )}
          {onLogout && isCollapsed && (
            <button
              onClick={onLogout}
              className="w-12 h-10 flex items-center justify-center bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 rounded-xl transition-all cursor-pointer mx-auto"
              title="Cerrar Sesión Corporativa"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Security / Compliance seal */}
        {!isCollapsed ? (
          <div className="text-[10px] text-slate-400 font-bold text-center space-y-0.5 pt-1 uppercase tracking-wider leading-none animate-fadeIn">
            <span className="block text-[8px]">Cumplimiento LFPDPPP Art 12</span>
            <span className="block text-[8px] text-[#76BC21]">Cifrado de PII Activo 🔐</span>
          </div>
        ) : (
          <div 
            className="text-center cursor-help py-1" 
            title="Cumplimiento reglamento LFPDPPP Artículo 12: Cifrado y resguardo de datos personales activo 🔐"
          >
            <Lock className="h-4 w-4 text-[#76BC21] mx-auto" />
          </div>
        )}
      </div>
    </aside>
  </>
  );
}
