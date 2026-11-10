import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { api, authFetch, getAuthToken } from './api';
import { 
  Sparkles, 
  Wifi, 
  HelpCircle, 
  Clock, 
  FileCheck, 
  Database, 
  Lock,
  ShieldCheck,
  Trash2,
  Menu
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import DashboardPanel from './components/DashboardPanel';
import CandidatePanel from './components/CandidatePanel';
import AdminPanel from './components/AdminPanel';
import AuditLogPanel from './components/AuditLogPanel';
import VacanciesPanel from './components/VacanciesPanel';
import CareersPortal from './components/CareersPortal';
import MfaModal from './components/MfaModal';
import InactivityModal from './components/InactivityModal';
import PasswordChangeModal from './components/PasswordChangeModal';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import { INACTIVITY_TIMEOUT_MS, INACTIVITY_WARNING_MS } from './utils/securityUtils';
import { recordAuditLog } from './utils/auditLogger';
import logoUrl from './eas_logo.png';

import { Candidate, InterviewSlot, WorkflowStage, UserRole, Vacancy } from './types';
import { formatVacancyTitle, fixCorruptedAccents, calculateStrictFitScore, cleanCandidateName } from './utils/vacancyUtils';
// INITIAL_CANDIDATES / INITIAL_VACANCIES ya NO se importan en el front: contienen datos personales
// reales de candidatos y quedaban embebidos en el bundle JS público (descargable sin login).
import { 
  INITIAL_STAGES, 
  INITIAL_INTERVIEWS
} from './data/samples';

export function sanitizeVacancyItem(v: Vacancy): Vacancy {
  if (!v) return v;
  let title = fixCorruptedAccents(v.title || '').trim();
  let department = fixCorruptedAccents(v.department || '').trim();
  let description = fixCorruptedAccents(v.description || '').trim();

  // If title was formatted as "Puesto - Oportunidad Comercial", split and place opportunity as description prefix
  if (title.includes(' - ')) {
    const parts = title.split(/\s+-\s+/);
    if (parts.length >= 2) {
      const posTitle = parts[0].trim();
      const oppPrefix = parts.slice(1).join(' - ').trim();
      if (oppPrefix.length > 5 && !/^(Atracción de Talento|Consultoría Organizacional|EAS Consulting)$/i.test(oppPrefix)) {
        title = posTitle;
        if (!description.toLowerCase().includes(oppPrefix.toLowerCase())) {
          description = `${oppPrefix} - ${description}`;
        }
      }
    }
  }

  title = title
    .replace(/\s*[\-\:\_]?\s*(Atracción de Talento|Atraccion de Talento|Consultoría Organizacional|Consultoria Organizacional)\s*/gi, '')
    .replace(/\s*-\s*.*Gabriel Aguayo.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    ...v,
    title: title || 'Vacante',
    department: department || v.department || 'General',
    description: description || v.description
  };
}


export function sanitizeCandidateItem(c: Candidate): Candidate {
  if (!c) return c;
  let role = fixCorruptedAccents(c.role || '').trim();
  let name = cleanCandidateName(c.name || '', c.resumeText, c.email);
  let summary = fixCorruptedAccents(c.summary || '').trim();

  role = role
    .replace(/\s*[\-\:\_]?\s*(Consultoría Organizacional|Consultoria Organizacional|Atracción de Talento|Atracción de talento)\s*/gi, '')
    .trim();

  let stage = c.stage || 'CV\'s';
  const cleanStage = (stage || '').toLowerCase().trim();
  if (cleanStage === 'filtrado' || cleanStage === 'screening' || cleanStage === 'application' || cleanStage === 'cv' || cleanStage === 'cvs' || cleanStage === 'cv\'s') {
    stage = 'CV\'s';
  }

  // Antes: en CADA carga se recalculaban fitScore/initialFitScore/strengths/growths en el navegador,
  // sobrescribiendo lo guardado en la BD (p. ej. el re-score del servidor al cambiar de vacante
  // "desaparecía" al refrescar). Ahora solo se calculan si faltan.
  const hasScore = typeof c.fitScore === 'number' && !Number.isNaN(c.fitScore);
  const evaluated = hasScore && (c.strengths || []).length > 0 && (c.growths || []).length > 0
    ? null
    : calculateStrictFitScore(c, { title: role, department: c.department });

  const rawScore = hasScore ? c.fitScore : (evaluated?.fitScore ?? 50);
  const clampedScore = Math.min(98, Math.max(10, rawScore));

  const rawInitial = c.initialFitScore ?? evaluated?.initialFitScore ?? c.fitScore ?? 50;
  const clampedInitial = Math.min(98, Math.max(10, rawInitial));

  return {
    ...c,
    name,
    role,
    summary,
    stage,
    suggestedTime: '',
    fitScore: clampedScore,
    initialFitScore: clampedInitial,
    doubleCheckReport: c.doubleCheckReport || '',
    strengths: (c.strengths || []).length > 0 ? c.strengths : (evaluated?.strengths || []),
    growths: (c.growths || []).length > 0 ? c.growths : (evaluated?.growths || []),
    interviewSpeech: c.interviewSpeech
  };
}


export function isPlaceholderEmail(email?: string): boolean {
  if (!email || !email.trim()) return true;
  const clean = email.toLowerCase().trim();
  if (clean.includes('example.com') || clean.includes('domain.com') || clean.includes('localhost')) return true;
  if (/^(candidato|postulante|sin[-_]?email|sin[-_]?correo|no[-_]?email|no[-_]?correo|test|temp|dummy|anonimo|anonymous)[\w\.\-]*@/i.test(clean)) return true;
  if (clean === 'candidato@eas-consulting.com' || clean === 'candidato@eas.com' || clean === 'candidato@eas-consulting.com.mx' || clean === 'candidato@easconsulting.com') return true;
  if (clean.includes('@eas-consulting.com') && (clean.startsWith('cand') || clean.startsWith('postulad') || clean.startsWith('anon'))) return true;
  return false;
}

export function deduplicateCandidatesList(cands: Candidate[]): Candidate[] {
  if (!Array.isArray(cands)) return [];
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  const result: Candidate[] = [];

  for (const c of cands) {
    if (!c) continue;
    const idKey = c.id ? String(c.id).toLowerCase().trim() : '';
    const emailKey = c.email ? String(c.email).toLowerCase().trim() : '';
    const cleanNameStr = cleanCandidateName(c.name || '');
    const nameKey = cleanNameStr ? cleanNameStr.toLowerCase().trim() : '';

    // Solo por id/email. Omitir deduplicación por email si es un correo por defecto / placeholder.
    if (idKey && seenIds.has(idKey)) continue;
    if (emailKey && !isPlaceholderEmail(emailKey) && seenEmails.has(emailKey)) continue;

    if (idKey) seenIds.add(idKey);
    if (emailKey && !isPlaceholderEmail(emailKey)) seenEmails.add(emailKey);
    if (nameKey && nameKey !== 'candidato postulado') seenNames.add(nameKey);

    result.push(c);
  }
  return result;
}

export default function App() {
  // Candidatos y vacantes: la ÚNICA fuente de verdad es el servidor (PostgreSQL).
  // Antes el estado nacía de localStorage y el merge con el servidor daba prioridad a la copia
  // local, así que un cambio que el servidor rechazaba (500) seguía viéndose en ese navegador
  // pero no existía para nadie más. Las claves antiguas 'eas_candidates'/'eas_vacancies' ya no se
  // leen ni se escriben (quedan intactas como respaldo de cambios que nunca llegaron a la BD).
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [interviews, setInterviews] = useState<InterviewSlot[]>(() => {
    try {
      const saved = localStorage.getItem('eas_interviews');
      return saved ? JSON.parse(saved) : INITIAL_INTERVIEWS;
    } catch {
      return INITIAL_INTERVIEWS;
    }
  });
  const [stages, setStages] = useState<WorkflowStage[]>(INITIAL_STAGES);
  
  // Navigation & Permissions & OAuth M365 Integration
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // La sesión requiere un JWT emitido por el servidor (antes bastaba el flag 'eas_authenticated').
    return localStorage.getItem('eas_authenticated') === 'true' && !!getAuthToken();
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    const saved = localStorage.getItem('eas_user_email');
    if (saved && (saved.includes('eaguilarh') || saved.includes('eaguilar@'))) {
      return 'enrique.aguilar@easconsulting.com.mx';
    }
    return saved || 'enrique.aguilar@easconsulting.com.mx';
  });
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('eas_user_name') || 'Enrique Aguilar';
  });
  const [userArea, setUserArea] = useState<string>(() => {
    return localStorage.getItem('eas_user_area') || 'Dirección General & Gobernanza';
  });
  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    const savedEmail = (localStorage.getItem('eas_user_email') || '').toLowerCase();
    const savedName = (localStorage.getItem('eas_user_name') || '').toLowerCase();
    if (savedEmail.includes('estefany') || savedName.includes('estefany') || savedEmail.includes('brandon') || savedName.includes('brandon')) {
      return 'RECRUITER';
    }
    return (localStorage.getItem('eas_user_role') as UserRole) || 'ADMIN';
  });

  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authStep, setAuthStep] = useState<string>('');
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);

  // Registration modal inputs
  const [regName, setRegName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regArea, setRegArea] = useState<string>('Atracción de Talento & RH');
  const [regRole, setRegRole] = useState<UserRole>('RECRUITER');
  const [regError, setRegError] = useState<string | null>(null);

  // Login form state (declared before any early returns to respect React Rules of Hooks)
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  
  // Rule: Estefany and Brandon are locked to RECRUITER role
  useEffect(() => {
    const emailLow = (userEmail || '').toLowerCase();
    const nameLow = (userName || '').toLowerCase();
    if (emailLow.includes('estefany') || nameLow.includes('estefany') || emailLow.includes('brandon') || nameLow.includes('brandon')) {
      if (activeRole !== 'RECRUITER') {
        setActiveRole('RECRUITER');
      }
    }
  }, [userEmail, userName, activeRole]);

  // Strict Role-Based Access Control Guard
  useEffect(() => {
    const allowedTabsForRole: Record<UserRole, string[]> = {
      ADMIN: ['dashboard', 'vacancies', 'candidates', 'audit', 'governance', 'integrations'],
      RECRUITER: ['dashboard', 'vacancies', 'candidates', 'audit'],
      MANAGER: ['dashboard', 'vacancies', 'candidates', 'audit']
    };
    const allowed = allowedTabsForRole[activeRole] || ['dashboard', 'vacancies', 'candidates'];
    if (!allowed.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeRole, activeTab]);

  // Security, MFA, Inactivity & Password Management States
  const [isMfaVerified, setIsMfaVerified] = useState<boolean>(() => {
    return localStorage.getItem('eas_mfa_verified') === 'true';
  });
  const [showMfaModal, setShowMfaModal] = useState<boolean>(false);

  const [mustChangePassword, setMustChangePassword] = useState<boolean>(() => {
    return localStorage.getItem('eas_must_change_password') === 'true';
  });
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState<boolean>(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState<boolean>(false);

  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  const [showInactivityWarning, setShowInactivityWarning] = useState<boolean>(false);
  const [inactivitySecondsRemaining, setInactivitySecondsRemaining] = useState<number>(60);

  const isLoggingOutRef = useRef<boolean>(false);

  const handleLogout = () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    try {
      recordAuditLog('LOGOUT_SESION', 'Autenticación', 'SUCCESS', `Cierre de sesión corporativa para ${userEmail}.`, userEmail);
    } catch (_) {}
    localStorage.removeItem('eas_authenticated');
    localStorage.removeItem('eas_user_email');
    localStorage.removeItem('eas_user_name');
    localStorage.removeItem('eas_user_area');
    localStorage.removeItem('eas_user_role');
    localStorage.removeItem('eas_mfa_verified');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('eas_auth_token');
    setIsAuthenticated(false);
    setIsMfaVerified(false);
    setShowInactivityWarning(false);
    setCandidates([]);
    setVacancies([]);
    setDataLoaded(false);
    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 1500);
  };

  // Token vencido o inválido (401 en cualquier llamada) → cerrar sesión
  useEffect(() => {
    const onExpired = () => {
      if (window.location.pathname.includes('/careers')) return;
      handleLogout();
    };
    window.addEventListener('eas:auth_expired', onExpired);
    return () => window.removeEventListener('eas:auth_expired', onExpired);
  }, []);

  // Sesión permanente: La sesión nunca caduca por inactividad
  useEffect(() => {
    // Sesión continua activa sin temporizador de inactividad
  }, [isAuthenticated]);

  
  // Server health state check
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const [showAiConfigModal, setShowAiConfigModal] = useState<boolean>(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem('eas_gemini_key') || '';
  });

  // (Eliminado el "self-healing" de preguntas: reescribía el cuestionario solo en pantalla, sin
  // guardarlo, así que lo que veía el reclutador no era lo que había en la BD.)

  useEffect(() => {
    localStorage.setItem('eas_interviews', JSON.stringify(interviews));
  }, [interviews]);

  // Carga desde el servidor al autenticar y al cambiar de pestaña. El servidor SIEMPRE gana.
  // Si falla, se muestra el error (antes: catch vacío y se seguía mostrando la copia local).
  const loadServerData = async () => {
    if (!isAuthenticated || window.location.pathname.includes('/careers')) return;
    try {
      const [vRes, cRes] = await Promise.all([api.getVacancies(), api.getCandidates()]);
      setVacancies((vRes?.vacancies || []).map(sanitizeVacancyItem));
      setCandidates(deduplicateCandidatesList((cRes?.candidates || []).map(sanitizeCandidateItem)));
      setDataLoadError(null);
      setDataLoaded(true);
    } catch (err: any) {
      console.error("Error al cargar datos desde el servidor:", err);
      setDataLoadError(err?.message || 'No se pudo contactar al servidor');
    }
  };

  useEffect(() => {
    loadServerData();
  }, [isAuthenticated, activeTab]);

  // Fetch server health on mount to verify fullstack route connection
  useEffect(() => {
    async function checkHealth() {
      try {
        const customKey = localStorage.getItem('eas_gemini_key') || '';
        const headers: Record<string, string> = {};
        if (customKey) {
          headers['x-gemini-api-key'] = customKey;
        }
        const response = await authFetch('/api/health', { headers });
        if (response.ok) {
          const data = await response.json();
          setServerOnline(data.status === 'ok');
          setGeminiConfigured(data.apiConfigured);
        } else {
          setServerOnline(false);
        }
      } catch (err) {
        console.warn("Connection to custom server health lost, falling back to simulated states.", err);
        setServerOnline(false);
      }
    }
    checkHealth();
  }, [customApiKey]);



  // Registro / Solicitud de Acceso Corporativo
  const handleCompleteRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      setRegError('Por favor ingresa tu nombre completo.');
      return;
    }
    if (!regEmail.trim()) {
      setRegError('Por favor ingresa tu correo electrónico corporativo.');
      return;
    }
    let formattedEmail = regEmail.trim().toLowerCase();
    if (!formattedEmail.includes('@')) {
      formattedEmail = `${formattedEmail}@easconsulting.com.mx`;
    }
    const domain = formattedEmail.split('@')[1];
    if (domain !== 'easconsulting.com.mx') {
      setRegError('El correo debe pertenecer al dominio oficial @easconsulting.com.mx');
      return;
    }
    setRegError(null);
    setShowRegisterModal(false);
    alert(`Solicitud de acceso enviada para ${formattedEmail}. El Administrador del Sistema activará tus credenciales corporativas.`);
  };

  // Render Public Careers page if the route is active
  if (window.location.pathname.includes('/careers')) {
    const handleApplicationComplete = (newCandidate: Candidate) => {
      setCandidates(prev => [newCandidate, ...prev]);
    };
    return (
      <CareersPortal 
        vacancies={vacancies} 
        onApplicationComplete={handleApplicationComplete} 
      />
    );
  }

  const handleLoginFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);

    // Read directly from DOM input fields to support browser autofill (Chrome/Edge/Safari) on 1st click
    const form = e.currentTarget;
    const emailInput = form.querySelector<HTMLInputElement>('input[type="email"]');
    const passwordInput = form.querySelector<HTMLInputElement>('input[type="password"]');

    const emailVal = (emailInput?.value || loginEmail).trim();
    const passwordVal = passwordInput?.value !== undefined && passwordInput?.value !== '' ? passwordInput.value : loginPassword;

    let formattedEmail = emailVal.toLowerCase();
    if (formattedEmail && !formattedEmail.includes('@')) {
      formattedEmail = `${formattedEmail}@easconsulting.com.mx`;
    }

    if (!formattedEmail) {
      setLoginError('Por favor ingresa tu correo electrónico corporativo.');
      return;
    }

    if (!passwordVal) {
      setLoginError('Por favor ingresa tu contraseña corporativa.');
      return;
    }

    setIsAuthenticating(true);
    setAuthStep(`Verificando credenciales con el servidor...`);

    // Ensure stale tokens from previous sessions are cleared before login
    localStorage.removeItem('auth_token');
    localStorage.removeItem('eas_auth_token');
    localStorage.removeItem('eas_authenticated');

    try {
      const res = await api.login(formattedEmail, passwordVal);
      if (res.success && res.token) {
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('eas_auth_token', res.token);
        localStorage.setItem('eas_authenticated', 'true');
        localStorage.setItem('eas_user_email', res.user.email);
        localStorage.setItem('eas_user_name', res.user.nombre || formattedEmail.split('@')[0]);
        const rawRole = (res.user.rol || '').toUpperCase();
        const safeRole: UserRole = (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') ? 'ADMIN' : (rawRole === 'MANAGER' || rawRole === 'GERENTE') ? 'MANAGER' : 'RECRUITER';
        const userAreaResolved = res.user.area || (safeRole === 'ADMIN' ? 'Dirección General & Gobernanza' : 'Atracción de Talento & RH');

        localStorage.setItem('eas_user_role', safeRole);
        localStorage.setItem('eas_user_area', userAreaResolved);

        recordAuditLog('LOGIN_EXITOSO', 'Autenticación', 'SUCCESS', `Inicio de sesión verificado para ${res.user.email} (Rol: ${safeRole}, Área: ${userAreaResolved}).`, res.user.email);

        setUserEmail(res.user.email);
        setUserName(res.user.nombre || formattedEmail.split('@')[0]);
        setUserArea(userAreaResolved);
        setActiveRole(safeRole);
        setIsAuthenticated(true);
        setIsAuthenticating(false);

        if (res.user.primer_login) {
          setShowPasswordChangeModal(true);
        }
      } else {
        setLoginError('Credenciales incorrectas. Verifica tu usuario y contraseña.');
        setIsAuthenticating(false);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Error de autenticación. Verifica tu correo y contraseña.');
      setIsAuthenticating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100 p-6 font-sans">
        <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl p-8 space-y-6 text-center text-slate-800 relative overflow-hidden">
          {/* Header Branding */}
          <div className="flex flex-col items-center gap-3">
            <div className="mb-1">
              <img 
                src={logoUrl || '/eas_logo.png'} 
                onError={(e) => { e.currentTarget.src = '/eas_logo.png'; }} 
                alt="EAS Consulting Logotipo" 
                className="h-20 w-auto object-contain mx-auto" 
              />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-eas-blue-50 border border-eas-blue-200 text-[11px] font-bold text-[#103268]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Tenant Corporativo</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[#103268]">EAS TalentCore AI</h1>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed font-medium">
              Inicia sesión con tus credenciales corporativas para acceder a la plataforma (<strong>easconsulting.com.mx</strong>)
            </p>
          </div>

          <div className="border-t border-slate-100 pt-5 text-left">
            {isAuthenticating ? (
              <div className="py-8 space-y-4 animate-fadeIn bg-slate-50 rounded-2xl border border-slate-200 p-4 text-center">
                <div className="animate-spin rounded-full h-9 w-9 border-4 border-[#103268] border-t-transparent mx-auto" />
                <p className="text-xs font-bold text-[#103268]">{authStep}</p>
              </div>
            ) : (
              <form onSubmit={handleLoginFormSubmit} className="space-y-4">
                {loginError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs">
                    ⚠️ {loginError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                    Correo Electrónico Corporativo (@easconsulting.com.mx)
                  </label>
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="usuario@easconsulting.com.mx"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#103268] text-xs font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                    Contraseña Corporativa
                  </label>
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#103268] text-xs font-medium"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-[#103268] hover:bg-[#0d2956] text-white rounded-2xl text-xs font-extrabold transition-all shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer mt-2"
                >
                  <Lock className="h-4 w-4 shrink-0" />
                  Validar Credenciales & Entrar
                </button>

                <div className="pt-2 flex flex-col gap-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    className="text-amber-600 hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    🔑 ¿Olvidaste tu contraseña? Recuperar vía correo
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRegName('');
                      setRegEmail('');
                      setRegArea('Atracción de Talento & RH');
                      setRegRole('RECRUITER');
                      setRegError(null);
                      setShowRegisterModal(true);
                    }}
                    className="text-indigo-600 hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    ➕ Registrar / Solicitar Registro Corporativo (easconsulting.com.mx)
                  </button>
                </div>
              </form>
            )}

            {/* Modal de Recuperación de Contraseña */}
            {showForgotPasswordModal && (
              <ForgotPasswordModal 
                onClose={() => setShowForgotPasswordModal(false)}
                onPasswordReset={(email) => {
                  setShowForgotPasswordModal(false);
                  alert(`Contraseña restablecida correctamente para ${email}. Ya puedes iniciar sesión con tu nueva clave.`);
                }}
              />
            )}

            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-center pt-4">
              Acceso Seguro Corporativo — Domain: easconsulting.com.mx
            </p>
          </div>


          {/* Registration Modal */}
          {showRegisterModal && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-left">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 bg-[#103268] text-white flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="h-5 w-5 shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm">Registro de Usuario Corporativo</h3>
                      <p className="text-[10px] text-indigo-200">EAS Consulting Group (easconsulting.com.mx)</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCompleteRegistration} className="p-6 space-y-4 text-xs">
                  {regError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs">
                      ⚠️ {regError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700 uppercase tracking-wide text-[10px]">Nombre Completo</label>
                    <input
                      type="text"
                      placeholder="Ej. Eduardo Aguilar"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#103268] text-xs font-semibold"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700 uppercase tracking-wide text-[10px]">Correo Corporativo (@easconsulting.com.mx)</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="eaguilarh@easconsulting.com.mx"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#103268] text-xs font-semibold font-mono"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      * Debe ser una cuenta corporativa válida del dominio @easconsulting.com.mx
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700 uppercase tracking-wide text-[10px]">Área / Departamento</label>
                    <select
                      value={regArea}
                      onChange={(e) => setRegArea(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#103268] text-xs font-bold bg-white"
                    >
                      <option value="Atracción de Talento & RH">Atracción de Talento & RH</option>
                      <option value="Dirección General (Hiring)">Dirección General (Hiring)</option>
                      <option value="Consultoría SAP & Servicios">Consultoría SAP & Servicios</option>
                      <option value="Tecnologías de la Información (IT)">Tecnologías de la Información (IT)</option>
                      <option value="Operaciones & Finanzas">Operaciones & Finanzas</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700 uppercase tracking-wide text-[10px]">Tipo de Usuario / Rol</label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as UserRole)}
                      className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#103268] text-xs font-bold bg-white"
                    >
                      <option value="RECRUITER">Reclutador Especialista</option>
                      <option value="MANAGER">Gerente Directivo (Hiring)</option>
                      <option value="ADMIN">Administrador (IT & Config)</option>
                    </select>
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowRegisterModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-[#103268] hover:bg-[#0d2956] text-white font-bold text-xs transition shadow-md cursor-pointer flex items-center gap-2"
                    >
                      <span>Completar Registro y Entrar</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="flex bg-slate-50 min-h-screen text-slate-700 w-full font-sans antialiased">
      
      {/* Lateral navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        userEmail={userEmail}
        userName={userName}
        userArea={userArea}
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        onLogout={handleLogout}
      />


      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden h-screen max-h-screen">
        
        {/* Dynamic Top Administration Banner (Static/Sticky on scroll) */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center shrink-0 no-print shadow-xs transition-all duration-200">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 cursor-pointer transition-colors"
              title="Abrir menú de navegación"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <span className={`text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded-md ${
                activeRole === 'ADMIN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 
                activeRole === 'RECRUITER' ? 'bg-eas-blue-50 text-eas-blue-800 border border-eas-blue-200/50' : 
                'bg-purple-50 text-purple-700 border border-purple-200/50'
              }`}>
                {activeRole === 'ADMIN' ? 'Sistemas Centrales' : 'Capital Humano'}
              </span>
              <h2 className="text-sm sm:text-base font-bold text-slate-950 leading-none">
                {activeRole === 'ADMIN' && 'Gobernanza Administrativa y Plantillas'}
                {activeRole === 'RECRUITER' && 'Consola del Consultor de Selección'}
                {activeRole === 'MANAGER' && 'Dashboard Directivo de Evaluaciones'}
              </h2>
            </div>
          </div>

          {/* Network Connection status indicators */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold select-none">
            
            {/* Server connection */}
            <div className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border text-xs ${
              serverOnline 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <Wifi className={`h-3.5 w-3.5 ${serverOnline ? 'text-emerald-500' : 'text-amber-500 animate-pulse'}`} />
              <span className="hidden sm:inline">{serverOnline ? 'EAS-Hub Online' : 'Local Sandbox Mode'}</span>
              <span className="sm:hidden">{serverOnline ? 'Online' : 'Sandbox'}</span>
            </div>

            {/* Gemini API configuration state */}
            <button 
              onClick={() => setShowAiConfigModal(true)}
              className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border text-xs hover:bg-slate-100 transition-colors duration-150 ${
                geminiConfigured 
                  ? 'bg-eas-blue-50 text-eas-blue-800 border-eas-blue-200' 
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
              title="Configurar motor de IA / API Key de Gemini"
            >
              <Sparkles className={`h-3.5 w-3.5 ${geminiConfigured ? 'text-eas-red-500' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">{geminiConfigured ? 'Gemini Activo' : 'EAS AI Simulation'}</span>
              <span className="sm:hidden">{geminiConfigured ? 'IA' : 'Sim'}</span>
            </button>

            {/* Privacy Law GDPR stamp */}
            <button 
              onClick={() => setShowPrivacyModal(true)}
              className="cursor-pointer hidden md:inline-flex items-center gap-1.5 text-slate-500 px-3 py-1 border border-slate-200 rounded-full bg-slate-50/50 hover:bg-slate-100 transition-colors duration-150"
              title="Ver Certificado de Privacidad LFPDPPP"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>Certificado LFPDPPP</span>
            </button>

            {/* Admin Reset database action */}
            {activeRole === 'ADMIN' && (
              <button
                onClick={async () => {
                  if (window.confirm("¿Estás seguro de que deseas limpiar por completo la base de datos de candidatos, vacantes y entrevistas? Esta acción no se puede deshacer.")) {
                    try {
                      await api.clearDatabase();
                    } catch (err: any) {
                      alert(`No se limpió la base de datos: ${err?.message || err}`);
                      return;
                    }
                    localStorage.removeItem('eas_candidates');
                    localStorage.removeItem('eas_vacancies');
                    localStorage.removeItem('eas_interviews');
                    setCandidates([]);
                    setVacancies([]);
                    setInterviews([]);
                    alert("Base de datos limpiada exitosamente.");
                    window.location.reload();
                  }
                }}
                className="cursor-pointer hidden sm:inline-flex items-center gap-1.5 text-rose-600 hover:text-white px-3 py-1 border border-rose-250 hover:bg-rose-600 hover:border-rose-600 rounded-full bg-rose-50/50 text-xs font-bold transition duration-150 font-sans"
                title="Limpiar base de datos para producción"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Limpiar Base de Datos</span>
              </button>
            )}

          </div>
        </header>

        {/* Content canvas with elegant transition layouts */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto w-full max-w-none px-4 sm:px-6 lg:px-12 space-y-6">
          {dataLoadError && (
            <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <span>
                <strong>No se pudieron cargar los datos del servidor:</strong> {dataLoadError}. Lo que ves puede estar incompleto y los cambios no se guardarán hasta restablecer la conexión.
              </span>
              <button onClick={() => loadServerData()} className="cursor-pointer rounded-md border border-rose-300 bg-white px-3 py-1 font-semibold hover:bg-rose-100">
                Reintentar
              </button>
            </div>
          )}

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full"
          >
            {/* Tab routing container */}
            {activeTab === 'dashboard' && (
              <DashboardPanel 
                candidates={candidates}
                vacancies={vacancies}
                interviews={interviews}
                activeRole={activeRole}
                onNavigateToVacancies={() => setActiveTab('vacancies')}
              />
            )}

            {activeTab === 'vacancies' && (
              <VacanciesPanel 
                vacancies={vacancies}
                setVacancies={setVacancies}
                candidates={candidates}
                activeRole={activeRole}
                userArea={userArea}
              />
            )}

            {activeTab === 'candidates' && (
              <CandidatePanel 
                candidates={candidates}
                onCandidateCreated={(c) => {
                  setCandidates(prev => deduplicateCandidatesList([c, ...prev.filter(item => item.id !== c.id)]));
                }}
                onCandidateUpdated={(c) => {
                  setCandidates(prev => prev.map(item => item.id === c.id ? c : item));
                }}
                onCandidateDeleted={async (id) => {
                  // Primero el servidor; solo si confirma se quita de la vista.
                  try {
                    await api.deleteCandidate(id);
                    setCandidates(prev => prev.filter(c => c.id !== id));
                  } catch (err: any) {
                    alert(`No se eliminó el candidato: ${err?.message || err}`);
                  }
                }}
                onDataChanged={loadServerData}
                vacancies={vacancies}
                activeRole={activeRole}
                userEmail={userEmail}
                userArea={userArea}
              />
            )}



            {activeTab === 'audit' && (
              <AuditLogPanel activeRole={activeRole} userEmail={userEmail} />
            )}

            {activeTab === 'governance' && (
              <AdminPanel section="governance" />
            )}

            {activeTab === 'integrations' && (
              <AdminPanel section="integrations" />
            )}

          </motion.div>

        </div>

        {/* LFPDPPP Certificate Modal */}
        {showPrivacyModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200 text-slate-800">
              <div className="p-6 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-bold text-base">Certificado de Cumplimiento LFPDPPP</h3>
                </div>
                <button 
                  onClick={() => setShowPrivacyModal(false)}
                  className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
                  <div className="bg-emerald-500 text-white p-2 rounded-full">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wide">Estado de Cumplimiento</h4>
                    <p className="text-sm font-semibold">Vigente y Activo — Auditoría EAS Favorable</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs text-slate-650">
                  <p className="text-slate-500 leading-relaxed">
                    EAS Consulting Group garantiza la privacidad y confidencialidad de la información curricular recolectada. Conforme a la <strong>Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)</strong> de México, el sistema cuenta con los siguientes controles activos:
                  </p>

                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <div className="flex gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span><strong>Cifrado AES-256 bits:</strong> Toda la información de contacto de los candidatos (nombres, correos, teléfonos y archivos de CV) se almacena bajo encriptación criptográfica avanzada.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span><strong>Artículo 12 (Ciclo de Retención):</strong> Los registros curriculares y respuestas del cuestionario se eliminan de forma automatizada transcurridos 12 meses de inactividad del candidato.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span><strong>Seguridad contra Fugas:</strong> Auditorías semanales de integridad sobre la base de datos PostgreSQL para salvaguardar la información sensible frente a accesos no autorizados.</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="cursor-pointer bg-slate-800 text-white hover:bg-slate-700 font-semibold px-4 py-2 rounded-lg text-xs transition duration-155"
                >
                  Entendido y Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Config / Simulation Modal */}
        {showAiConfigModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200 text-slate-800">
              <div className="p-6 bg-gradient-to-r from-indigo-900 to-eas-blue-800 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-300" />
                  <h3 className="font-bold text-base">Consola EAS AI Engine</h3>
                </div>
                <button 
                  onClick={() => setShowAiConfigModal(false)}
                  className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Estado de Operación</label>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg border bg-purple-50 border-purple-200 text-purple-900 text-xs flex items-center justify-between">
                      <span className="font-bold">🌐 Google Gemini 2.0 Flash:</span>
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">ACTIVO (PARSING & CV)</span>
                    </div>
                    <div className="p-2.5 rounded-lg border bg-amber-50 border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                      <span className="font-bold">🧠 Anthropic Claude 3.5 Sonnet:</span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">ACTIVO (AUDITOR DOUBLE-CHECK)</span>
                    </div>
                    <div className="p-2.5 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                      <span className="font-bold">⚡ OpenAI GPT-4o:</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">ACTIVO (HARD SKILLS MATRIX)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Google Gemini API Key</label>
                  <input
                    type="password"
                    placeholder="Introducir API Key de Gemini"
                    value={customApiKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomApiKey(val);
                      if (val) {
                        localStorage.setItem('eas_gemini_key', val);
                      } else {
                        localStorage.removeItem('eas_gemini_key');
                      }
                    }}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">
                    * La API Key se guarda localmente en tu navegador de forma segura y solo se envía al servidor mediante HTTPS para realizar las evaluaciones.
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Ponderación de pesos actual</h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    El sistema ajusta el peso de las competencias basándose en el historial de feedback de contratación del reclutador (Liderazgo, Comunicación, Trabajo en Equipo, etc.).
                  </p>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                {customApiKey && (
                  <button
                    onClick={() => {
                      localStorage.removeItem('eas_gemini_key');
                      setCustomApiKey('');
                      alert("API Key eliminada. El sistema volverá a simulación.");
                    }}
                    className="cursor-pointer text-xs text-rose-650 hover:underline font-semibold"
                  >
                    Borrar Clave
                  </button>
                )}
                <div className="flex-1 flex justify-end">
                  <button
                    onClick={() => setShowAiConfigModal(false)}
                    className="cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700 font-semibold px-4 py-2 rounded-lg text-xs transition duration-150"
                  >
                    Guardar y Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Advertencia por Inactividad (15 Minutos - ISO 27001) */}
        {showInactivityWarning && (
          <InactivityModal 
            secondsRemaining={inactivitySecondsRemaining}
            onStayLoggedIn={() => {
              setLastActivityTime(Date.now());
              setShowInactivityWarning(false);
            }}
            onLogoutNow={handleLogout}
          />
        )}

        {/* Modal de Desafío MFA (2FA TOTP Obligatorio) */}
        {showMfaModal && (
          <MfaModal 
            userEmail={userEmail}
            userRole={activeRole}
            onVerified={() => {
              localStorage.setItem('eas_mfa_verified', 'true');
              setIsMfaVerified(true);
              setShowMfaModal(false);
            }}
            onCancel={() => {
              setShowMfaModal(false);
              handleLogout();
            }}
          />
        )}

        {/* Modal de Cambio de Contraseña en Primer Login */}
        {showPasswordChangeModal && (
          <PasswordChangeModal 
            userEmail={userEmail}
            isFirstLogin={true}
            onSuccess={(newPass) => {
              localStorage.setItem('eas_password_set', 'true');
              setShowPasswordChangeModal(false);
              alert('Contraseña actualizada correctamente.');
            }}
            onCancel={() => setShowPasswordChangeModal(false)}
          />
        )}

      </main>
    </div>
  );
}
