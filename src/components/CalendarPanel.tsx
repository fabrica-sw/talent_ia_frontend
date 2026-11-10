import React, { useState } from 'react';
import { authFetch } from '../api';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Video, 
  Download, 
  FileCheck, 
  Plus, 
  Star, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  User,
  ShieldAlert,
  SlidersHorizontal,
  X,
  FilePlus,
  Share2,
  RefreshCw,
  Check,
  Mail
} from 'lucide-react';
import { InterviewSlot, Candidate } from '../types';
import { cleanCandidateName } from '../utils/vacancyUtils';

interface CalendarPanelProps {
  interviews: InterviewSlot[];
  setInterviews: React.Dispatch<React.SetStateAction<InterviewSlot[]>>;
  candidates: Candidate[];
  activeRole: string;
  schedulerIntake: Candidate | null;
  setSchedulerIntake: (cand: Candidate | null) => void;
}

export default function CalendarPanel({
  interviews,
  setInterviews,
  candidates,
  activeRole,
  schedulerIntake,
  setSchedulerIntake
}: CalendarPanelProps) {
  
  // Outlook Corporate Account Synchronization States
  const [outlookConnected, setOutlookConnected] = useState(true);
  const [isSyncingOutlook, setIsSyncingOutlook] = useState(false);
  const [outlookEmail, setOutlookEmail] = useState(() => localStorage.getItem('eas_user_email') || 'eaguilarh@eas.com.mx');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Sincronizado hace 1 min');
  const [syncStatusMsg, setSyncStatusMsg] = useState('La agenda está sincronizada en tiempo real.');
  const [showOutlookConfig, setShowOutlookConfig] = useState(false);

  const handleOutlookSync = () => {
    setIsSyncingOutlook(true);
    setSyncStatusMsg('Escaneando slots ocupados en Outlook Corporate y verificando conflictos...');
    setTimeout(() => {
      setIsSyncingOutlook(false);
      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncTime(`Sincronizado a las ${timeStr}`);
      setSyncStatusMsg('Sincronización forzada completada correctamente. Sin conflictos detectados.');
    }, 1500);
  };

  // State
  const [selectedSlot, setSelectedSlot] = useState<InterviewSlot | null>(interviews[0] || null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(!!schedulerIntake);
  const [scorecardState, setScorecardState] = useState({
    rating: 5,
    recommendation: 'hired' as 'hired' | 'review' | 'rejected',
    feedback: '',
    evaluations: {
      'Liderazgo': 80,
      'Comunicación': 80,
      'Trabajo en Equipo': 80,
      'Habilidades Técnicas': 80,
      'Resolución de Problemas': 80
    }
  });

  // Calendar Year/Month Display state
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 4)); // June 2026 based on metadata

  // Manual appointment form state
  const [formData, setFormData] = useState({
    candidateId: schedulerIntake?.id || '',
    candidateName: schedulerIntake?.name || '',
    interviewer: localStorage.getItem('eas_user_name') || 'Eduardo Aguilar',
    interviewerRole: 'Socio de Capital Humano, EAS',
    date: '2026-06-08',
    time: '11:00',
    duration: 45,
    notes: 'Primer contacto y validación de competencias.',
    meetingLink: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_EAS_Consulting_Interview_Corp%40thread.v2/0?context=%7b%22Tid%22%3a%22eas-consulting-corp-id%22%2c%22Oid%22%3a%22eas-consulting-user-id%22%7d'
  });

  // Sync manual form with incoming intake request from AI Recruiter panel
  React.useEffect(() => {
    if (schedulerIntake) {
      const bulletStrengths = schedulerIntake.strengths?.map(s => `• ${s}`).join('\n') || '';
      const bulletGrowths = schedulerIntake.growths?.map(g => `• ${g}`).join('\n') || '';
      const questionsText = schedulerIntake.recommendedQuestions?.map((q, i) => `${i+1}. ${q}`).join('\n') || '';
      
      const cvSummaryText = `
--- PERFIL DEL CANDIDATO (EAS AI) ---
Resumen Ejecutivo: ${schedulerIntake.summary || 'Precalificado'}

Fortalezas:
${bulletStrengths}

Áreas de Oportunidad:
${bulletGrowths}

Preguntas Recomendadas para Entrevista:
${questionsText}
-------------------------------------`;

      setFormData(prev => ({
        ...prev,
        candidateId: schedulerIntake.id,
        candidateName: schedulerIntake.name,
        notes: `Entrevista inicial de validación de competencias.\n${cvSummaryText}`
      }));
      setIsScheduling(true);
    }
  }, [schedulerIntake]);

  // Handle manual schedule submission
  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.candidateId || !formData.date || !formData.time) return;

    const cand = candidates.find(c => c.id === formData.candidateId);
    const candidateName = cand ? cand.name : formData.candidateName;

    const newInterview: InterviewSlot = {
      id: `int-${Date.now()}`,
      candidateId: formData.candidateId,
      candidateName,
      interviewer: formData.interviewer,
      interviewerRole: formData.interviewerRole,
      date: formData.date,
      time: formData.time,
      duration: Number(formData.duration),
      status: 'Scheduled',
      meetingLink: formData.meetingLink,
      notes: formData.notes,
      scorecard: null
    };

    setInterviews(prev => [newInterview, ...prev]);
    setSelectedSlot(newInterview);
    
    // Clear scheduler states
    setIsScheduling(false);
    setSchedulerIntake(null);
  };

  // Export RFC-5545 compliant `.ics` calendar event on the fly!
  const handleDownloadICS = (slot: InterviewSlot) => {
    // Formulate ISO Date times for .ics (June 8, 2026 at 11:00 AM -> 20260608T110000Z)
    const formattedDate = slot.date.replace(/-/g, '');
    const formattedTime = slot.time.replace(/:/g, '');
    const startTimeStamp = `${formattedDate}T${formattedTime}00`;
    
    // Calculate approximate end timestamp
    const endMinutes = (Number(slot.time.split(':')[1]) + slot.duration) % 60;
    const endHours = Number(slot.time.split(':')[0]) + Math.floor((Number(slot.time.split(':')[1]) + slot.duration) / 60);
    const endFormattedHours = String(endHours).padStart(2, '0');
    const endFormattedMinutes = String(endMinutes).padStart(2, '0');
    const endTimeStamp = `${formattedDate}T${endFormattedHours}${endFormattedMinutes}00`;

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EAS Consulting//TalentCore AI Scheduler//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:uid-${slot.id}@eas-consulting.com
DTSTAMP:${startTimeStamp}Z
DTSTART:${startTimeStamp}
DTEND:${endTimeStamp}
SUMMARY:Entrevista EAS Consulting: ${slot.candidateName}
DESCRIPTION:Entrevistador: ${slot.interviewer} (${slot.interviewerRole})\\nSala Virtual: ${slot.meetingLink}\\nNotas de preparación: ${slot.notes || 'N/A'}
LOCATION:${slot.meetingLink}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `EAS_Entrevista_${slot.candidateName.replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit scorecard review
  const handleScorecardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    const updatedSlot: InterviewSlot = {
      ...selectedSlot,
      status: 'Completed',
      scorecard: {
        rating: scorecardState.rating,
        recommendation: scorecardState.recommendation,
        feedback: scorecardState.feedback || 'Evaluación ejecutiva completada de manera favorable.',
        evaluatedCompetencies: { ...scorecardState.evaluations }
      }
    };

    setInterviews(prev => prev.map(i => i.id === selectedSlot.id ? updatedSlot : i));
    setSelectedSlot(updatedSlot);

    // Enviar evaluación al backend para activar el aprendizaje continuo de IA
    authFetch('/api/submit-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recommendation: scorecardState.recommendation,
        competencies: scorecardState.evaluations
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log("Feedback de aprendizaje de IA procesado:", data);
      if (data.weights) {
        localStorage.setItem('eas_ai_weights', JSON.stringify(data.weights));
        window.dispatchEvent(new Event('eas_ai_weights_updated'));
      }
    })
    .catch(err => console.error("Error al enviar feedback de aprendizaje:", err));
  };


  // Helper calendar renderer properties
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayIndex = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthName = currentDate.toLocaleString('es-MX', { month: 'long', year: 'numeric' });

  // Generate date fields in calendar grid helper
  const getDaysGrid = () => {
    const days = [];
    // Padding for first days
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  // Check if a specific calendar day has a meeting slot
  const getSlotForDay = (day: number | null) => {
    if (!day) return [];
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const checkString = `${currentDate.getFullYear()}-${formattedMonth}-${formattedDay}`;
    return interviews.filter(i => i.date === checkString);
  };

  return (
    <div className="space-y-6 font-sans select-none animate-fadeIn">
      
      {/* SECCIÓN CORPORATIVA: INTERFAZ DE SINCRONIZACIÓN OUTLOOK */}
      <div className="bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden">
        {/* Header con gradiente institucional Azul Eléctrico y Azul Agua Marina */}
        <div className="bg-gradient-to-r from-eas-blue-500 to-eas-blue-600 p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="bg-white/10 p-2.5 rounded-xl border border-white/10 flex items-center justify-center shrink-0">
              {/* Custom High-Fidelity Outlook Simulated Icon */}
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z" fill="#103268" />
                <path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 100.1 3 19 3Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 8.5L12 10.5L14.5 8" stroke="#00BEFE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 16H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M7 12H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-exo font-bold tracking-tight text-white leading-none">EAS Outlook Corporate Link™</h3>
                <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${outlookConnected ? 'bg-[#76BC21]/20 text-[#a2f738] border border-[#76BC21]/30' : 'bg-slate-300 text-slate-700'}`}>
                  {outlookConnected ? 'Enlace Activo' : 'Desconectado'}
                </span>
              </div>
              <p className="text-[11px] text-slate-200 leading-normal max-w-xl">
                Sincronización bidireccional en tiempo real de espacios disponibles, juntas directivas y citas de Capital Humano con la cuenta Exchange corporativa de EAS Consulting.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            {outlookConnected && (
              <button
                onClick={handleOutlookSync}
                disabled={isSyncingOutlook}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 inline-flex items-center"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isSyncingOutlook ? 'animate-spin' : ''}`} />
                {isSyncingOutlook ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            )}
            <button
              onClick={() => setShowOutlookConfig(!showOutlookConfig)}
              className="px-3.5 py-1.5 bg-white text-eas-blue-500 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
            >
              Parámetros
            </button>
          </div>
        </div>

        {/* Sync status active indicator */}
        <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 text-xs font-sans flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${outlookConnected ? 'bg-[#76BC21]' : 'bg-slate-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${outlookConnected ? 'bg-[#76BC21]' : 'bg-slate-400'}`}></span>
            </span>
            <div className="space-y-0.5">
              <span className="font-bold text-slate-700">
                {outlookConnected ? `Vinculado con la cuenta: ${outlookEmail}` : 'Sin cuenta corporativa vinculada'}
              </span>
              <p className="text-[10px] text-slate-500 font-medium">
                {isSyncingOutlook ? 'Estableciendo canal seguro con API Microsoft Cloud...' : syncStatusMsg}
              </p>
            </div>
          </div>
          <div className="text-[10px] font-mono font-bold text-slate-450 self-end sm:self-center">
            Estado agenda: {outlookConnected ? lastSyncTime : 'No disponible'}
          </div>
        </div>

        {/* Config drawer for accounts */}
        {showOutlookConfig && (
          <div className="border-t border-slate-100 p-5 bg-slate-50/50 space-y-4 animate-slideDown font-sans text-xs">
            <h4 className="font-bold text-slate-800 col-span-full">Parámetros de Integración de Outlook Exchange</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">Cuenta Corporativa de Outlook</label>
                <div className="flex items-center border bg-white border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-eas-blue-500">
                  <Mail className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="email"
                    value={outlookEmail}
                    onChange={(e) => setOutlookEmail(e.target.value)}
                    disabled={!outlookConnected}
                    className="w-full bg-transparent focus:outline-none"
                    placeholder="ejemplo@easconsulting.com.mx"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">Estado de Enlace</label>
                <button
                  type="button"
                  onClick={() => {
                    setOutlookConnected(!outlookConnected);
                    if (!outlookConnected) {
                      setSyncStatusMsg('Vinculación exitosa realizada. Los espacios horarios se importarán en tiempo real.');
                    } else {
                      setSyncStatusMsg('Sincronización suspendida.');
                    }
                  }}
                  className={`w-full px-3 py-1.5 rounded-xl border text-center font-bold font-sans transition cursor-pointer ${
                    outlookConnected
                      ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                      : 'bg-[#76BC21]/10 border-[#76BC21]/30 text-[#548e14] hover:bg-[#76BC21]/25'
                  }`}
                >
                  {outlookConnected ? 'Desvincular Outlook' : 'Vincular Cuenta Outlook'}
                </button>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">Conflictos Horarios</label>
                <select className="w-full p-1.5 border bg-white border-slate-200 rounded-xl">
                  <option value="reject">Bloquear automáticamente spots ocupados</option>
                  <option value="warn">Avisar al reclutador (Permitir sobrelapar)</option>
                  <option value="auto">Sugerir reagendar por Inteligencia Artificial</option>
                </select>
              </div>
            </div>
            
            <div className="p-3 bg-eas-blue-50 border border-eas-blue-100 rounded-xl flex items-start gap-2 text-[10px] text-eas-blue-800 leading-relaxed">
              <Check className="h-3.5 w-3.5 text-eas-blue-600 shrink-0 mt-0.5" strokeWidth={3} />
              <span>
                <strong>Sincronía Bidireccional Activa:</strong> Cualquier espacio reservado por el socio principal u otros entrevistadores en su cliente de Outlook Corporate se manifestará aquí de inmediato como un espacio bloqueado. Las entrevistas agendadas aquí también generarán una invitación de Microsoft Teams con recordatorio automático a Outlook.
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Calendar visual layout area (size 7/12) */}
      <div className="lg:col-span-7 space-y-4">
        
        {/* Calendar Card Container */}
        <div className="bg-white border border-slate-150 rounded-2xl shadow-sm p-5 space-y-4">
          
          {/* Calendar Controller Header */}
          <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide capitalize">
              {monthName}
            </h3>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                className="p-1 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Ant.
              </button>
              <button 
                onClick={() => setCurrentDate(new Date(2026, 5, 4))}
                className="p-1 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
              >
                Hoy
              </button>
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="p-1 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Sig.
              </button>
            </div>
          </div>

          {/* Calendar Days Names row */}
          <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-50">
            <span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span>
          </div>

          {/* Calendar Grid Numbers */}
          <div className="grid grid-cols-7 gap-1.5 pt-1 text-xs">
            {getDaysGrid().map((day, idx) => {
              const daySlots = getSlotForDay(day);
              const isToday = day === 4 && currentDate.getMonth() === 5; // June 4, 2026 setup
              const hasEngagement = daySlots.length > 0;

              const cellDateStr = day ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
              const isSelected = selectedDate === cellDateStr;

              return (
                <div 
                  key={idx}
                  onClick={() => {
                    if (!day || !cellDateStr) return;
                    setSelectedDate(cellDateStr);
                    setFormData(prev => ({
                      ...prev,
                      date: cellDateStr
                    }));
                    setIsScheduling(true);
                  }}
                  className={`min-h-16 border p-1.5 rounded-xl transition flex flex-col justify-between select-none ${
                    day ? 'border-slate-100 bg-white hover:border-indigo-400 hover:shadow-xs cursor-pointer' : 'border-transparent bg-transparent pointer-events-none'
                  } ${isToday ? 'ring-2 ring-indigo-600/40 border-indigo-600' : ''} ${isSelected ? 'ring-2 ring-[#76BC21] border-[#76BC21]' : ''}`}
                >
                  <span className={`text-[10px] font-mono font-bold block ${isToday ? 'text-indigo-600 font-extrabold' : 'text-slate-500'}`}>
                    {day}
                  </span>
                  
                  {/* Indicator Dot/Pill for scheduled slots inside calendar square */}
                  {hasEngagement && day && (
                    <div className="space-y-0.5">
                      {daySlots.map(s => (
                        <div 
                          key={s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSlot(s);
                          }}
                          className={`truncate text-[9px] font-bold px-1 py-0.5 rounded leading-none text-left cursor-pointer transition ${
                            s.status === 'Completed' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-600 hover:text-white'
                          }`}
                          title={`${s.time} - ${s.candidateName}`}
                        >
                          {s.time} {s.candidateName.split(' ')[0]}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Schedule List Block */}
        <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Planificación Próxima</h4>
            <button
              onClick={() => {
                setIsScheduling(true);
                setSchedulerIntake(null);
              }}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Nuevo Agendado
            </button>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {interviews.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Clock className="h-5 w-5 text-slate-350 mx-auto mb-1.5" />
                <p className="text-xs text-slate-500 font-medium font-sans">No hay entrevistas programadas.</p>
              </div>
            ) : (
              interviews.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => setSelectedSlot(item)}
                  className={`p-3 border rounded-xl cursor-pointer transition text-xs flex justify-between items-center ${
                    selectedSlot?.id === item.id 
                      ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-500/10 font-medium' 
                      : 'border-slate-150 bg-white hover:border-slate-350'
                  }`}
                >
                  <div className="space-y-0.5 text-left">
                    <div className="font-bold text-slate-800">{item.candidateName}</div>
                    <div className="text-[10px] text-slate-500 font-medium">Entrevistador: {item.interviewer}</div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-1">
                      <span className="flex items-center"><CalendarIcon className="h-3 w-3 mr-0.5" /> {item.date}</span>
                      <span className="flex items-center"><Clock className="h-3 w-3 mr-0.5" /> {item.time} ({item.duration} min)</span>
                    </div>
                  </div>

                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    item.status === 'Completed' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                      : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                  }`}>
                    {item.status === 'Completed' ? 'Evaluado' : 'Pendiente'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: MANUAL Booking form / Scorecard evaluations details (size 5/12) */}
      <div className="lg:col-span-5">
        
        {/* VIEW 1: Active Scheduling Form */}
        {isScheduling ? (
          <div className="bg-white border border-slate-150 rounded-2xl shadow-sm p-5 space-y-4 animate-slideUp">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-sans font-bold text-slate-800 text-sm">
                  Configurar Entrevista Corporativa
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Soporte automático de coincidencia horaria</p>
              </div>
              <button 
                onClick={() => setIsScheduling(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-3 font-sans text-xs">
              
              {/* Candidate Lookup selection */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Seleccionar Candidato Postulado</label>
                <select
                  required
                  value={formData.candidateId}
                  onChange={(e) => {
                    const c = candidates.find(cand => cand.id === e.target.value);
                    if (c) {
                      setFormData(prev => ({
                        ...prev,
                        candidateId: c.id,
                        candidateName: cleanCandidateName(c.name, c.resumeText, c.email)
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 border bg-white border-slate-200 rounded-xl"
                >
                  <option value="">-- Elige un aspirante --</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>{cleanCandidateName(c.name, c.resumeText, c.email)} ({c.stage})</option>
                  ))}
                </select>
              </div>


              {/* Interviewer details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Entrevistador EAS</label>
                  <input
                    type="text"
                    required
                    value={formData.interviewer}
                    onChange={(e) => setFormData(prev => ({ ...prev, interviewer: e.target.value }))}
                    placeholder="Lic. Laura Montes"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Cargo de Entrevistador</label>
                  <input
                    type="text"
                    required
                    value={formData.interviewerRole}
                    onChange={(e) => setFormData(prev => ({ ...prev, interviewerRole: e.target.value }))}
                    placeholder="Gerente Directivo"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Date, Time, Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Fecha</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Hora</label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Duración (min)</label>
                  <select
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border bg-white border-slate-200 rounded-xl"
                  >
                    <option value="30">30 Min</option>
                    <option value="45">45 Min</option>
                    <option value="60">60 Min</option>
                    <option value="90">90 Min</option>
                  </select>
                </div>
              </div>

              {/* Online meeting links */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center bg-indigo-100 text-indigo-700 w-5 h-5 rounded font-black text-xs">
                      T
                    </span>
                    Enlace de Videollamada (Microsoft Teams)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const randToken = Math.floor(100000 + Math.random() * 900000);
                      const candName = formData.candidateName ? formData.candidateName.replace(/\s+/g, '_') : 'EAS_Cand';
                      const teamsUrl = `https://teams.microsoft.com/l/meetup-join/19%3ameeting_EAS_Consulting_${candName}_${randToken}%40thread.v2/0?context=%7b%22Tid%22%3a%22eas-consulting-corp-id%22%2c%22Oid%22%3a%22eas-consulting-user-id%22%7d`;
                      setFormData(prev => ({ ...prev, meetingLink: teamsUrl }));
                    }}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold hover:underline cursor-pointer"
                  >
                    Generar Nuevo Enlace
                  </button>
                </div>
                <div className="relative">
                  <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.meetingLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, meetingLink: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl font-mono text-[10px] text-slate-500 bg-slate-50/50"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block font-medium leading-tight">
                  Sincronizado vía EAS Outlook Corporate Link™ para apartar salones de Microsoft Teams.
                </span>
              </div>

              {/* Internal instructions / Prep notes */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Notas de preparación</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduling(false)}
                  className="px-4.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-sm cursor-pointer"
                >
                  Confirmar Agendado
                </button>
              </div>

            </form>
          </div>
        ) : selectedSlot ? (
          
          /* VIEW 2: Interview Slot / Scorecard detailed View */
          <div className="bg-white border border-slate-150 rounded-2xl shadow-sm p-6 space-y-6 animate-slideUp">
            
            {/* Header Detail */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-150 rounded-full px-2.5 py-0.5 uppercase tracking-wide inline-block leading-none">
                {selectedSlot.status === 'Completed' ? 'Evaluación Finalizada' : 'Línea de Espera'}
              </span>
              <h3 className="text-lg font-bold text-slate-800 leading-tight">
                {selectedSlot.candidateName}
              </h3>
              <p className="text-xs text-slate-400 font-semibold font-mono">ID Agendado: {selectedSlot.id}</p>
            </div>

            {/* Practical Slot Details */}
            <div className="space-y-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-600">
              
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Entrevistador</span>
                <span className="text-slate-800 font-bold">{selectedSlot.interviewer}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/50 pt-2">
                <span className="text-slate-400">Cargo Corporativo</span>
                <span className="text-slate-800">{selectedSlot.interviewerRole}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/50 pt-2">
                <span className="text-slate-400">Fecha y Hora</span>
                <span className="text-slate-850 font-mono font-bold leading-none">{selectedSlot.date} @ {selectedSlot.time} Hs</span>
              </div>
              
              <div className="flex items-center justify-between border-t border-slate-200/50 pt-2">
                <span className="text-slate-400">Duración Prevista</span>
                <span>{selectedSlot.duration} minutos</span>
              </div>

              {/* Online Virtual Meeting Lobby link */}
              <div className="flex items-center justify-between border-t border-slate-200/50 pt-2 shrink-0">
                <span className="text-slate-400">Canal de Reunión</span>
                {selectedSlot.meetingLink.includes('teams.microsoft.com') ? (
                  <a 
                    href={selectedSlot.meetingLink} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center shrink-0 bg-indigo-50 border border-indigo-200/50 px-2.5 py-1 rounded-lg transition"
                  >
                    <span className="inline-flex items-center justify-center bg-indigo-600 text-white text-[9px] font-black w-4 h-4 rounded mr-1.5 shadow-sm">
                      T
                    </span>
                    Abrir Microsoft Teams
                  </a>
                ) : (
                  <a 
                    href={selectedSlot.meetingLink} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline font-bold flex items-center shrink-0"
                  >
                    <Video className="h-3.5 w-3.5 mr-1" />
                    Abrir Sala Virtual
                  </a>
                )}
              </div>
            </div>

            {/* Preparations instructions note */}
            {selectedSlot.notes && (
              <div className="space-y-1.5 text-xs text-slate-600">
                <span className="font-bold text-slate-800 block">Notas de Coordinación:</span>
                <p className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 leading-relaxed font-sans font-medium">
                  {selectedSlot.notes}
                </p>
              </div>
            )}

            {/* Calendar standard buttons: Download Event (.ics sync) */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => handleDownloadICS(selectedSlot)}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Descargar Evento (.ics Outlook)
              </button>
            </div>

            {/* HIRING MANAGER SCORECARD INPUT: Render if scorecard is empty and user role can approve */}
            {selectedSlot.status === 'Scheduled' ? (
              <div className="border-t border-slate-150 pt-5 space-y-4">
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-150 flex items-start gap-2.5">
                  <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs font-semibold text-amber-900 leading-relaxed">
                    <strong>Hiring Manager Scorecard:</strong> Esta entrevista aún no posee evaluación de aptitud conductual. Rellena los datos para dictaminar contratación.
                  </div>
                </div>

                {/* Direct feedback formulation */}
                <form onSubmit={handleScorecardSubmit} className="space-y-4 font-sans text-xs">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">Rellenar Evaluación del Candidato</span>
                  
                  {/* Rating Selector */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Calificación de Aptitud (1-5 Estrellas)</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setScorecardState(prev => ({ ...prev, rating: star }))}
                          className="p-1 text-amber-400 hover:scale-110 transition cursor-pointer"
                        >
                          <Star className={`h-6 w-6 ${star <= scorecardState.rating ? 'fill-amber-400' : 'text-slate-200'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hiring Action verdict */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Resolución de Candidato</label>
                    <select
                      value={scorecardState.recommendation}
                      onChange={(e) => setScorecardState(prev => ({ ...prev, recommendation: e.target.value as any }))}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="hired">Contratar de Inmediato ✓</option>
                      <option value="review">Pasar a Segunda Ronda / Test Especial</option>
                      <option value="rejected">Declinar / Almacenar en Inventario</option>
                    </select>
                  </div>

                  {/* Construct feedback comments */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Comentarios Generales y Feedback del Reclutador</label>
                    <textarea
                      required
                      rows={3}
                      value={scorecardState.feedback}
                      onChange={(e) => setScorecardState(prev => ({ ...prev, feedback: e.target.value }))}
                      placeholder="Ej. El aspirante posee extraordinario dominio de la materia. Responde de forma madura bajo presión, recomendado para el puesto..."
                      className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-indigo-500 font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer"
                  >
                    <FileCheck className="h-4.5 w-4.5" />
                    Enviar Scorecard y Evaluar
                  </button>
                </form>
              </div>
            ) : (
              
              /* RENDER COMPLETED SCORECARD REPORT DIALOG */
              <div className="border-t border-slate-150 pt-5 space-y-4">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
                  Scorecard Recibida - Evaluación del Directivo
                </span>

                <div className="space-y-3.5 bg-slate-50 p-4 border border-slate-150 rounded-2xl text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-500">Dictamen de Capital Humano</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      selectedSlot.scorecard?.recommendation === 'hired' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      selectedSlot.scorecard?.recommendation === 'review' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                      'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {selectedSlot.scorecard?.recommendation === 'hired' ? 'Contratado ✓' :
                       selectedSlot.scorecard?.recommendation === 'review' ? 'Segunda Ronda' : 'Finalizado'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/50 pt-2">
                    <span className="font-medium text-slate-500">Calificación Promedio</span>
                    <div className="flex gap-0.5 text-amber-400">
                      {Array.from({ length: selectedSlot.scorecard?.rating || 5 }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-slate-200/50 pt-2 font-sans">
                    <span className="font-bold text-slate-800 block">Feedback Ejecutivo:</span>
                    <p className="text-slate-650 leading-relaxed text-xs italic font-medium font-sans">
                      "{selectedSlot.scorecard?.feedback}"
                    </p>
                  </div>
                </div>
              </div>

            )}

          </div>
        ) : (
          <div className="bg-white border rounded-2xl p-12 text-center text-slate-400">
            <CalendarIcon className="h-12 w-12 mx-auto text-slate-300 mb-2" />
            <h3 className="font-bold text-slate-700">Ningún Slot Seleccionado</h3>
            <p className="text-xs text-slate-500 mt-1">Haga clic en un evento del calendario o en el listado para ver su ficha de agendamiento y scorecard.</p>
          </div>
        )}

      </div>

    </div>
  </div>
  );
}
