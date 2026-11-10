
const PROFILE_SOFTSKILLS_CATALOG: Record<string, { softSkills: string[], minL: number, minC: number, minT: number, minTe: number, minR: number, defaultReqs: string }> = {
  "Becario": {
    softSkills: ["Proactividad", "Deseo de Aprendizaje", "Trabajo en Equipo", "Orientación al Servicio"],
    minL: 40, minC: 60, minT: 75, minTe: 50, minR: 55,
    defaultReqs: "soporte básico, documentación, trabajo en equipo, aprendizaje rápido"
  },
  "Guia Becario": {
    softSkills: ["Proactividad", "Deseo de Aprendizaje", "Trabajo en Equipo", "Orientación al Servicio"],
    minL: 40, minC: 60, minT: 75, minTe: 50, minR: 55,
    defaultReqs: "soporte básico, documentación, trabajo en equipo, aprendizaje rápido"
  },
  "Jr. C": {
    softSkills: ["Trabajo en Equipo", "Comunicación Baremos", "Responsabilidad", "Apoyo Operativo"],
    minL: 50, minC: 65, minT: 75, minTe: 60, minR: 60,
    defaultReqs: "soporte técnico, tareas operativas, análisis simple, reportes"
  },
  "Jr.B": {
    softSkills: ["Responsabilidad", "Orientación a Resultados", "Adaptabilidad", "Soporte Técnico"],
    minL: 60, minC: 70, minT: 80, minTe: 70, minR: 68,
    defaultReqs: "desarrollo de análisis, gestión de casos, solución de problemas"
  },
  "Jr. A": {
    softSkills: ["Autonomía", "Comunicación Clara", "Escucha Activa", "Diagnóstico Técnico Preciso"],
    minL: 70, minC: 85, minT: 80, minTe: 80, minR: 80,
    defaultReqs: "prospección B2B, venta consultiva, negociación C-Level, soluciones técnicas"
  },
  "Consultor A": {
    softSkills: ["Autonomía", "Comunicación Clara", "Escucha Activa", "Diagnóstico Técnico Preciso"],
    minL: 70, minC: 85, minT: 80, minTe: 80, minR: 80,
    defaultReqs: "prospección B2B, venta consultiva, negociación C-Level, soluciones técnicas"
  },
  "Consultor A (Jr. A)": {
    softSkills: ["Autonomía", "Comunicación Clara", "Escucha Activa", "Diagnóstico Técnico Preciso"],
    minL: 70, minC: 85, minT: 80, minTe: 80, minR: 80,
    defaultReqs: "prospección B2B, venta consultiva, negociación C-Level, soluciones técnicas"
  },
  "Senior B": {
    softSkills: ["Liderazgo de Procesos", "Inteligencia Emocional", "Toma de Decisiones", "Supervisión Jr"],
    minL: 80, minC: 85, minT: 85, minTe: 85, minR: 85,
    defaultReqs: "proyectos alta complejidad, liderazgo técnico, atención a clientes"
  },
  "Sr B": {
    softSkills: ["Liderazgo de Procesos", "Inteligencia Emocional", "Toma de Decisiones", "Supervisión Jr"],
    minL: 80, minC: 85, minT: 85, minTe: 85, minR: 85,
    defaultReqs: "proyectos alta complejidad, liderazgo técnico, atención a clientes"
  },
  "Consultor B (Sr. B)": {
    softSkills: ["Liderazgo de Procesos", "Inteligencia Emocional", "Toma de Decisiones", "Supervisión Jr"],
    minL: 80, minC: 85, minT: 85, minTe: 85, minR: 85,
    defaultReqs: "proyectos alta complejidad, liderazgo técnico, atención a clientes"
  },
  "Senior A": {
    softSkills: ["Liderazgo Estratégico", "Visión de Negocio", "Compromiso Alto", "Requerimientos Complejos"],
    minL: 85, minC: 90, minT: 85, minTe: 90, minR: 90,
    defaultReqs: "arquitectura de soluciones, evaluación de necesidades complejas, dirección de área"
  },
  "Sr A": {
    softSkills: ["Liderazgo Estratégico", "Visión de Negocio", "Compromiso Alto", "Requerimientos Complejos"],
    minL: 85, minC: 90, minT: 85, minTe: 90, minR: 90,
    defaultReqs: "arquitectura de soluciones, evaluación de necesidades complejas, dirección de área"
  },
  "Consultor Sr (Sr. A)": {
    softSkills: ["Liderazgo Estratégico", "Visión de Negocio", "Compromiso Alto", "Requerimientos Complejos"],
    minL: 85, minC: 90, minT: 85, minTe: 90, minR: 90,
    defaultReqs: "arquitectura de soluciones, evaluación de necesidades complejas, dirección de área"
  },

};

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api, authFetch } from '../api';
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  DollarSign, 
  Plus, 
  Trash2, 
  Users, 
  ChevronRight, 
  CheckCircle,
  AlertCircle,
  FileCheck,
  ShieldAlert,
  Sparkles,
  Mail,
  Copy,
  Edit,
  X,
  UploadCloud
} from 'lucide-react';
import { Vacancy, Candidate, UserRole, EnglishLevel } from '../types';
import { formatVacancyTitle, fixCorruptedAccents, cleanCandidateName, calculateStrictFitScore, interpretVacancyProfileWeights, synthesizeAnalyticalCandidateSummary } from '../utils/vacancyUtils';
import { areaOptionsFor, normalizeArea } from '../utils/areas';
import { recordAuditLog } from '../utils/auditLogger';
import { copyToClipboard } from '../utils/clipboardUtils';

interface VacanciesPanelProps {
  vacancies: Vacancy[];
  setVacancies: React.Dispatch<React.SetStateAction<Vacancy[]>>;
  candidates: Candidate[];
  activeRole: UserRole;
  userArea?: string;
}

export default function VacanciesPanel({ 
  vacancies, 
  setVacancies, 
  candidates, 
  activeRole,
  userArea
}: VacanciesPanelProps) {
  const [filterOnlyMyArea, setFilterOnlyMyArea] = useState<boolean>(activeRole === 'MANAGER');
  const [isAdding, setIsAdding] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string | null>(null);

  const effectiveArea = userArea || 'Dirección General & Gobernanza';

  const displayedVacancies = useMemo(() => {
    if (!filterOnlyMyArea || !effectiveArea) return vacancies;
    const targetArea = effectiveArea.toLowerCase().trim();
    const isDirector = targetArea.includes('dirección') || targetArea.includes('gobernanza') || targetArea.includes('admin');
    return vacancies.filter(v => {
      const vDept = (v.department || '').toLowerCase().trim();
      if (isDirector) return vDept.includes('geradva') || vDept.includes('proman') || vDept.includes('comercial') || vDept.includes('otcpro') || vDept.includes('dirección') || vDept.includes('gobernanza') || targetArea.includes(vDept);
      return vDept.includes(targetArea) || targetArea.includes(vDept);
    });
  }, [vacancies, filterOnlyMyArea, effectiveArea]);
  
  // Email Template Modal States
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [generatedEmailBody, setGeneratedEmailBody] = useState('');
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [emailScope, setEmailScope] = useState<'top3' | 'all'>('top3');
  const [currentEmailVacancy, setCurrentEmailVacancy] = useState<Vacancy | null>(null);
  const [currentEmailCandidates, setCurrentEmailCandidates] = useState<Candidate[]>([]);

  const buildEmailContent = (vacancy: Vacancy, cands: Candidate[], scope: 'top3' | 'all') => {
    const evaluated = cands.map(cand => {
      const strictEval = calculateStrictFitScore(cand, vacancy);
      const effectiveFitScore = strictEval.fitScore;
      return {
        cand,
        strictEval,
        effectiveFitScore
      };
    });

    // Sort by effectiveFitScore descending
    evaluated.sort((a, b) => b.effectiveFitScore - a.effectiveFitScore);

    const targetList = scope === 'top3' ? evaluated.slice(0, 3) : evaluated;
    const hasIncompatibles = targetList.some(item => item.strictEval.hasDomainMismatch || item.effectiveFitScore <= 30);
    const hasViableCandidates = targetList.some(item => !item.strictEval.hasDomainMismatch && item.effectiveFitScore >= 50);

    let email = `Estimado Líder Solicitante,\n\n`;
    email += `Espero que se encuentre muy bien. A continuación, presento la propuesta de candidatos evaluados para la vacante de "${vacancy.title}" (Departamento de ${vacancy.department}), analizados por nuestro sistema de evaluación por competencias en EAS Consulting:\n\n`;

    if (scope === 'top3') {
      email += `[SELECCIÓN: TOP 3 PERFILES ORDENADOS POR AFINIDAD]\n`;
    } else {
      email += `[LISTADO COMPLETO: ${targetList.length} CANDIDATOS VINCULADOS]\n`;
    }

    if (hasIncompatibles) {
      email += `AVISO: Los perfiles con incompatibilidad de profesión o brechas críticas se encuentran explícitamente señalados como NO APTOS para descartar su postulación en esta posición.\n\n`;
    } else {
      email += `\n`;
    }

    targetList.forEach((item, index) => {
      const { cand, strictEval, effectiveFitScore } = item;
      const isMismatch = !!strictEval.hasDomainMismatch;
      const isLowFit = effectiveFitScore <= 30;

      let statusBadge = `[RECOMENDADO / IDÓNEO]`;
      if (isMismatch) {
        statusBadge = `[NO APTO / INCOMPATIBILIDAD CRÍTICA DE PROFESIÓN]`;
      } else if (isLowFit) {
        statusBadge = `[NO APTO / BRECHA SEVERA DE COMPETENCIAS]`;
      } else if (effectiveFitScore < 60) {
        statusBadge = `[EN OBSERVACIÓN / CUMPLE REQUISITOS PARCIALES]`;
      }

      email += `${index + 1}. CANDIDATO: ${cleanCandidateName(cand.name, cand.resumeText, cand.email)}\n`;
      email += `   - Ajuste al puesto: ${effectiveFitScore}% ${statusBadge}\n`;
      
      if (isMismatch) {
        email += `   - Alerta Crítica: Incompatible con la vacante. ${strictEval.domainMismatchReason || 'Profesión y vocación no afines con los requerimientos operativos del puesto'}.\n`;
        email += `   - Dictamen: Sin cabida para postulación en este perfil.\n`;
      } else if (strictEval.hasSeniorityGap && strictEval.seniorityGapReason) {
        email += `   - Observación de Seniority: ${strictEval.seniorityGapReason}\n`;
      }

      const analyticalSummary = synthesizeAnalyticalCandidateSummary(cand, vacancy);
      email += `   - Resumen Ejecutivo: ${isMismatch ? 'Candidato con formación y experiencia en otra disciplina. No viable para la vacante requerida.' : (analyticalSummary || 'Perfil idóneo precalificado por competencias.')}\n`;
      
      email += `   - Fortalezas Clave:\n`;
      const strengthsToShow = isMismatch 
        ? ['Formación técnica en su disciplina vocacional de origen']
        : ((strictEval.strengths && strictEval.strengths.length > 0) ? strictEval.strengths.slice(0, 3) : (cand.strengths && cand.strengths.length > 0 ? cand.strengths.slice(0, 3) : ['Alta orientación al logro y competencias técnicas sólidas']));
      strengthsToShow.forEach(str => {
        email += `     • ${str}\n`;
      });

      email += `   - Áreas de Oportunidad:\n`;
      const growthsToShow = isMismatch
        ? [strictEval.domainMismatchReason || 'Desfase crítico de profesión con los requerimientos del puesto']
        : ((strictEval.growths && strictEval.growths.length > 0) ? strictEval.growths.slice(0, 2) : (cand.growths && cand.growths.length > 0 ? cand.growths.slice(0, 2) : ['Adaptación progresiva al ritmo acelerado de la organización']));
      growthsToShow.forEach(gro => {
        email += `     • ${gro}\n`;
      });

      email += `\n`;
    });

    if (hasViableCandidates) {
      email += `Quedo a su entera disposición para coordinar entrevistas con los candidatos viables recomendados. ¿Cuál de ellos considera adecuado para avanzar a la siguiente fase?\n\n`;
    } else {
      email += `Se continuará con la atracción de talento en los canales de reclutamiento para presentar perfiles idóneos y compatibles con las funciones solicitadas.\n\n`;
    }

    email += `Atentamente,\n`;
    email += `Equipo de Atracción de Capital Humano\n`;
    email += `EAS Consulting`;

    return email;
  };

  const handleGenerateEmailTemplate = (vacancy: Vacancy, vacancyCandidates: Candidate[]) => {
    setCurrentEmailVacancy(vacancy);
    setCurrentEmailCandidates(vacancyCandidates);
    setEmailScope('top3');
    const email = buildEmailContent(vacancy, vacancyCandidates, 'top3');
    setGeneratedEmailBody(email);
    setShowEmailModal(true);
    setCopiedSuccess(false);
  };

  const handleCopyToClipboard = async () => {
    const success = await copyToClipboard(generatedEmailBody);
    if (success) {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2000);
    }
  };

  // Form States

  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('COMERCIAL');
  const [location, setLocation] = useState('CDMX - Híbrido');
  const [description, setDescription] = useState('');
  const [requirementsInput, setRequirementsInput] = useState('');
  const [experienceYears, setExperienceYears] = useState(3);
  const [salaryRange, setSalaryRange] = useState('');
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>('Avanzado');
  const [modalidad, setModalidad] = useState<'Presencial' | 'Remoto' | 'Híbrido'>('Híbrido');
  const [status, setStatus] = useState<'Activa' | 'StandBy' | 'Baja' | 'Cubierta' | 'Open' | 'Closed'>('Activa');
  const [requiredGuidanceLevel, setRequiredGuidanceLevel] = useState<string>('Jr. A');
  
  // Competency targets states
  const [minLid, setMinLid] = useState(70);
  const [minCom, setMinCom] = useState(70);
  const [minTrab, setMinTrab] = useState(70);
  const [minTec, setMinTec] = useState(70);
  const [minRes, setMinRes] = useState(70);

  const getAssignedCandidates = (vacId: string) => {
    return candidates.filter(cand => cand.vacancyId === vacId);
  };

  const handleEditVacancy = (vac: Vacancy) => {
    setEditingVacancy(vac);
    setTitle(vac.title);
    setDepartment(normalizeArea(vac.department) || vac.department);
    setLocation(vac.location);
    setDescription(vac.description);
    setRequirementsInput(vac.requirements.join(', '));
    setExperienceYears(vac.experienceYears);
    setSalaryRange(vac.salaryRange || 'TBD (Por Definir)');
    setEnglishLevel(vac.englishLevel || 'Medio');
    setModalidad(vac.modalidad || 'Híbrido');
    const isAcademia = /\b(academia|becari[oa]|trainee|intern|practicante)\b/i.test(vac.title) || vac.experienceYears === 0;
    setRequiredGuidanceLevel(vac.requiredGuidanceLevel || (isAcademia ? 'Becario' : 'Jr. A'));
    setMinLid(vac.minCompetenciesRequired['Liderazgo'] || 70);
    setMinCom(vac.minCompetenciesRequired['Comunicación'] || 70);
    setMinTrab(vac.minCompetenciesRequired['Trabajo en Equipo'] || 70);
    setMinTec(vac.minCompetenciesRequired['Habilidades Técnicas'] || 70);
    setMinRes(vac.minCompetenciesRequired['Resolución de Problemas'] || 70);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingVacancy(null);
    setTitle('');
    setDescription('');
    setRequirementsInput('');
    setEnglishLevel('Avanzado');
    setModalidad('Híbrido');
    setStatus('Activa');
    setRequiredGuidanceLevel('Jr. A');
    setMinLid(70);
    setMinCom(70);
    setMinTrab(70);
    setMinTec(70);
    setMinRes(70);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const requirements = requirementsInput
      .split(',')
      .map(req => req.trim().toLowerCase())
      .filter(req => req.length > 0);

    const formattedTitle = formatVacancyTitle(title, department);

    if (editingVacancy) {
      const updatedVacancy: Vacancy = {
        ...editingVacancy,
        title: formattedTitle,
        department,
        location,
        description,
        requirements: requirements.length > 0 ? requirements : ['general'],
        experienceYears,
        salaryRange: salaryRange.trim() || 'TBD (Por Definir)',
        minCompetenciesRequired: {
          'Liderazgo': minLid,
          'Comunicación': minCom,
          'Trabajo en Equipo': minTrab,
          'Habilidades Técnicas': minTec,
          'Resolución de Problemas': minRes
        },
        englishLevel,
        modalidad,
        status,
        requiredGuidanceLevel,
        softSkills: PROFILE_SOFTSKILLS_CATALOG[requiredGuidanceLevel]?.softSkills || []
      };
      api.updateVacancy(editingVacancy.id, updatedVacancy)
        .then(res => {
          setVacancies(prev => prev.map(v => v.id === editingVacancy.id ? { ...updatedVacancy, ...(res.vacancy || {}) } : v));
          setEditingVacancy(null);
          recordAuditLog('CAMBIO_VACANTE', 'Vacantes', 'SUCCESS', `Actualización de vacante "${updatedVacancy.title}" (Estado: ${updatedVacancy.status}).`);
        })
        .catch(err => {
          // Antes: el error se ignoraba y la vacante se actualizaba solo en pantalla/localStorage.
          console.error("Error al actualizar vacante:", err);
          alert(`⚠️ La vacante NO se guardó en el servidor: ${err?.message || err}`);
        });

      // Reset Form & exit edit mode
      setTitle('');
      setDescription('');
      setRequirementsInput('');
      setExperienceYears(3);
      setSalaryRange('');
      setEnglishLevel('Avanzado');
      setModalidad('Híbrido');
      setStatus('Activa');
      setRequiredGuidanceLevel('Jr. A');
      setMinLid(70);
      setMinCom(70);
      setMinTrab(70);
      setMinTec(70);
      setMinRes(70);
      setIsAdding(false);
      return;
    }

    const newVacancy: Vacancy = {
        id: `vac-${Date.now()}`,
        title: formattedTitle,
        department,
        location,
        description,
        requirements: requirements.length > 0 ? requirements : ['general'],
        experienceYears,
        salaryRange: salaryRange.trim() || 'TBD (Por Definir)',
        status: status || 'Activa',
        minCompetenciesRequired: {
          'Liderazgo': minLid,
          'Comunicación': minCom,
          'Trabajo en Equipo': minTrab,
          'Habilidades Técnicas': minTec,
          'Resolución de Problemas': minRes
        },
        englishLevel,
        modalidad,
        requiredGuidanceLevel,
        softSkills: PROFILE_SOFTSKILLS_CATALOG[requiredGuidanceLevel]?.softSkills || []
      };

      // Optimista en pantalla; si el servidor rechaza, se retira y se avisa
      // (antes quedaba "retenida localmente" sin existir en la BD).
      setVacancies(prev => [newVacancy, ...prev.filter(v => v.id !== newVacancy.id)]);

      api.createVacancy(newVacancy)
        .then(res => {
          if (res?.vacancy) {
            setVacancies(prev => prev.map(v => v.id === newVacancy.id ? { ...v, ...res.vacancy, minCompetenciesRequired: v.minCompetenciesRequired || res.vacancy.minCompetenciesRequired } : v));
          }
          recordAuditLog('ALTA_VACANTE', 'Vacantes', 'SUCCESS', `Publicación de nueva vacante "${newVacancy.title}" (${newVacancy.department}).`);
        })
        .catch(err => {
          console.error("Error al crear vacante:", err);
          setVacancies(prev => prev.filter(v => v.id !== newVacancy.id));
          alert(`⚠️ La vacante "${newVacancy.title}" NO se guardó en el servidor: ${err?.message || err}`);
        });
    
    // Reset Form
    setTitle('');
    setDescription('');
    setRequirementsInput('');
    setExperienceYears(3);
    setSalaryRange('');
    setEnglishLevel('Avanzado');
    setModalidad('Híbrido');
    setStatus('Activa');
    setRequiredGuidanceLevel('Jr. A');
    setMinLid(70);
    setMinCom(70);
    setMinTrab(70);
    setMinTec(70);
    setMinRes(70);
    setIsAdding(false);
  };

  const handleDeleteVacancy = (vacId: string, vacTitle: string) => {
    if (confirm(`¿Estás seguro de eliminar la vacante "${vacTitle}"? Los candidatos asignados permanecerán en el sistema sin vacante vinculada.`)) {
      // Antes: si el DELETE fallaba, la vacante se ocultaba igual con una "lista negra" local
      // (eas_deleted_vacancies) aunque siguiera existiendo en la BD.
      api.deleteVacancy(vacId)
        .then(() => {
          setVacancies(prev => prev.filter(v => v.id !== vacId));
          if (selectedVacancyId === vacId) setSelectedVacancyId(null);
          recordAuditLog('BAJA_VACANTE', 'Vacantes', 'WARNING', `Eliminación de vacante "${vacTitle}" (ID: ${vacId}).`);
        })
        .catch(err => {
          console.error("Error deleting vacancy from DB:", err);
          alert(`⚠️ La vacante NO se eliminó: ${err?.message || err}`);
        });
    }
  };

  const handleLayoutUploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const customKey = localStorage.getItem('eas_gemini_key') || '';
    const headers: any = {};
    if (customKey) {
      headers['x-gemini-api-key'] = customKey;
    }
    
    let parsedVacancy: any = null;

    try {
      const res = await authFetch('/api/parse-vacancy', {
        method: 'POST',
        headers,
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.vacancy) {
          parsedVacancy = data.vacancy;
        }
      }
    } catch (err) {
      console.warn("Backend parse-vacancy API unreachable, activating fallback parser:", err);
    }

    let inferredDept = fixCorruptedAccents(parsedVacancy?.department || '').trim();
    if (!inferredDept) {
      const lowerFile = file.name.toLowerCase();
      if (lowerFile.includes('comercial') || lowerFile.includes('ventas')) {
        inferredDept = 'Comercial';
      } else {
        inferredDept = 'General';
      }
    }

    if (!parsedVacancy) {
      const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/^[A-Z0-9_\-\s]+[_\-]/gi, '').replace(/_/g, ' ').trim();
      parsedVacancy = {
        title: cleanFileName || "Vacante",
        department: inferredDept,
        description: `Requisición de puesto cargada desde el archivo de Layout oficial "${file.name}".`,
        requirements: ["Experiencia requerida en el área", "Liderazgo de Equipos"],
        salaryRange: "De $80,000 a $85,000 MXN",
        experienceYears: 5,
        englishLevel: "Avanzado",
        modality: "Híbrido"
      };
    }

    const cleanTitle = fixCorruptedAccents(parsedVacancy.title || "Vacante");
    const cleanDesc = fixCorruptedAccents(parsedVacancy.description || parsedVacancy.objective || "Descripción cargada automáticamente desde el Layout.");
    const cleanReqs = (parsedVacancy.requirements && parsedVacancy.requirements.length > 0 ? parsedVacancy.requirements : ['general']).map((r: string) => fixCorruptedAccents(r));
    const finalDept = normalizeArea(fixCorruptedAccents(parsedVacancy.department || inferredDept || "COMERCIAL"));
    const parsedTitle = formatVacancyTitle(cleanTitle, finalDept);
    const newVacancy: Vacancy = {
      id: `vac-${Date.now()}`,
      title: parsedTitle,
      department: finalDept,
      location: fixCorruptedAccents(parsedVacancy.location || "CDMX - Híbrido"),
      description: cleanDesc,
      requirements: cleanReqs,
      experienceYears: parsedVacancy.experienceYears || 10,
      salaryRange: fixCorruptedAccents(parsedVacancy.salaryRange || 'De $80,000 a $85,000 MXN'),
      status: 'Activa',
      minCompetenciesRequired: {
        'Liderazgo': 80,
        'Comunicación': 80,
        'Trabajo en Equipo': 80,
        'Habilidades Técnicas': 85,
        'Resolución de Problemas': 80
      },
      englishLevel: parsedVacancy.englishLevel || 'Avanzado',
      modalidad: parsedVacancy.modality || 'Híbrido'
    };

    // Synchronous immediate local state & storage update (0ms lag when switching modules)
    setVacancies(prev => [newVacancy, ...prev.filter(v => v.id !== newVacancy.id)]);

    api.createVacancy(newVacancy)
      .then(saveRes => {
        if (saveRes?.vacancy) {
          setVacancies(prev => prev.map(v => v.id === newVacancy.id ? { ...v, ...saveRes.vacancy, minCompetenciesRequired: v.minCompetenciesRequired || saveRes.vacancy.minCompetenciesRequired } : v));
        }
        recordAuditLog('ALTA_VACANTE', 'Vacantes', 'SUCCESS', `Importación de vacante desde archivo Layout de Excel "${file.name}": ${newVacancy.title}.`);
        alert(`¡Vacante "${newVacancy.title}" importada y guardada desde el Layout "${file.name}"!`);
      })
      .catch(saveErr => {
        console.error("Error guardando vacante importada:", saveErr);
        setVacancies(prev => prev.filter(v => v.id !== newVacancy.id));
        alert(`⚠️ La vacante "${newVacancy.title}" se leyó del Layout pero NO se guardó en el servidor: ${saveErr?.message || saveErr}`);
      });
  };

  const handleLayoutUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleLayoutUploadFile(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      
      {/* Header and Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-sans tracking-tight">
            Vacantes Corporativas Publicadas
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Administración analítica de perfiles y emparejamiento inteligente de CVs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 6, 
            fontSize: 12, 
            fontWeight: 600, 
            color: filterOnlyMyArea ? '#1e40af' : '#475569', 
            cursor: 'pointer', 
            padding: '6px 12px', 
            borderRadius: 10, 
            backgroundColor: filterOnlyMyArea ? '#eff6ff' : '#f8fafc', 
            border: filterOnlyMyArea ? '1px solid #bfdbfe' : '1px solid #cbd5e1', 
            transition: 'all 0.15s ease' 
          }}>
            <input
              type="checkbox"
              checked={filterOnlyMyArea}
              onChange={(e) => setFilterOnlyMyArea(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Solo mi área ({effectiveArea})</span>
          </label>

          {activeRole !== 'MANAGER' && (
            <>
              <button
                onClick={() => {
                  const el = document.getElementById('layout-upload');
                  if (el) el.click();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition duration-150 cursor-pointer"
              >
                <FileCheck className="h-4.5 w-4.5" />
                Cargar desde Layout (Excel)
              </button>
              <input
                id="layout-upload"
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleLayoutUpload}
              />
              <button
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition duration-150 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Publicar Nueva Vacante
              </button>
            </>
          )}
        </div>
      </div>

      {activeRole !== 'MANAGER' && (
        <div
          style={{
            border: '2px dashed #059669',
            borderRadius: 12,
            padding: '24px 16px',
            textAlign: 'center',
            backgroundColor: '#f0fdf4',
            color: '#065f46',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: 20
          }}
          onClick={() => document.getElementById('layout-upload')?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              const file = e.dataTransfer.files[0];
              const lowerName = file.name.toLowerCase();
              if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
                handleLayoutUploadFile(file);
              } else {
                alert('Por favor, arrastra un archivo de Excel válido (.xlsx o .xls)');
              }
            }
          }}
          className="hover:bg-emerald-50/50 hover:border-emerald-600 transition-colors"
        >
          <UploadCloud size={32} style={{ color: '#059669', marginBottom: 8, display: 'inline-block' }} />
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 'bold' }}>Arrastra tu archivo de Layout (Excel) aquí o haz clic para buscar</p>
          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#047857' }}>Soporta importación automática de requisiciones (Formatos .xlsx, .xls)</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT & CENTER COLUMNS: Vacancy card grid (size 2/3) */}
        <div className="lg:col-span-2 space-y-4">
            {displayedVacancies.length === 0 ? (
              <div className="bg-white border border-slate-150 p-8 rounded-2xl text-center col-span-2 w-full">
                <Briefcase className="h-8 w-8 text-slate-350 mx-auto mb-2" />
                <p className="text-slate-500 font-medium text-sm">No hay vacantes publicadas.</p>
                <p className="text-slate-400 text-xs mt-0.5">Haga clic en 'Publicar Nueva Vacante' para iniciar el proceso.</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedVacancies.map((vac) => {
                const assigned = getAssignedCandidates(vac.id);
                const isSelected = selectedVacancyId === vac.id;

                return (
                  <div
                    key={vac.id}
                    onClick={() => setSelectedVacancyId(isSelected ? null : vac.id)}
                    className={`bg-white border text-left p-5 rounded-2xl cursor-pointer hover:shadow-xs transition duration-150 flex flex-col justify-between h-full relative ${
                      isSelected 
                        ? 'border-indigo-600 ring-2 ring-indigo-500/10' 
                        : 'border-slate-150 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                          {vac.department}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          vac.status === 'Activa' || vac.status === 'Open' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          vac.status === 'StandBy' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          vac.status === 'Baja' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          vac.status === 'Cubierta' || vac.status === 'Closed' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {vac.status === 'Open' ? 'Activa' : vac.status === 'Closed' ? 'Cubierta' : vac.status}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-bold text-slate-850 text-sm leading-tight group-hover:text-indigo-600">
                          {vac.title}
                        </h3>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {vac.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {vac.experienceYears}+ años exp
                          </span>
                          {vac.salaryRange && (
                            <span className="flex items-center gap-0.5">
                              <DollarSign className="h-3 w-3" />
                              {vac.salaryRange}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-2">
                        {vac.description}
                      </p>

                      {/* Requirements Tags */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {vac.requirements.slice(0, 4).map((req, idx) => (
                          <span key={idx} className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                            {req}
                          </span>
                        ))}
                        {vac.requirements.length > 4 && (
                          <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-md">
                            +{vac.requirements.length - 4} más
                          </span>
                        )}
                      </div>

                      {/* AI Profile Weights Summary on Card */}
                      {(() => {
                        const profiles = interpretVacancyProfileWeights(vac);
                        const primary = profiles[0];
                        return primary ? (
                          <div className="pt-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold text-indigo-900 bg-indigo-50/70 border border-indigo-100 rounded-lg px-2.5 py-1">
                              <span>IA Perfil Mayor Peso: {primary.profile}</span>
                              <span className="text-indigo-700 font-extrabold">{primary.weight}%</span>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span>{assigned.length} Candidato{assigned.length !== 1 ? 's' : ''}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {activeRole !== 'MANAGER' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditVacancy(vac);
                              }}
                              className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-500 hover:text-indigo-700 transition"
                              title="Editar Vacante"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteVacancy(vac.id, vac.title);
                              }}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-700 transition"
                              title="Eliminar Vacante"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${isSelected ? 'rotate-90 text-indigo-600' : ''}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Detail / Assigned Candidates List (size 1/3) */}
        <div className="space-y-4">
          {selectedVacancyId ?
            (() => {
              const selectedVac = vacancies.find(v => v.id === selectedVacancyId);
              if (!selectedVac) return null;
              const assigned = getAssignedCandidates(selectedVacancyId);

              return (
                <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-5 text-left">
                  <div className="space-y-2 border-b border-slate-100 pb-4">
                    <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider block">Inspección de Vacante</span>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {selectedVac.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      {selectedVac.description}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
                        {selectedVac.modalidad || 'Híbrido'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-100">
                        Inglés: {selectedVac.englishLevel || 'Avanzado'}
                      </span>
                                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wider border border-purple-100">
                        Nivel Guía: {selectedVac.requiredGuidanceLevel || 'Jr. A'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
                        Sueldo: {selectedVac.salaryRange || 'Tope SR'}
                      </span>
                    </div>

                    {/* Soft Skills badges per Guidance Level */}
                    {((selectedVac.softSkills && selectedVac.softSkills.length > 0) || PROFILE_SOFTSKILLS_CATALOG[selectedVac.requiredGuidanceLevel || 'Jr. A']) && (
                      <div className="space-y-1.5 pt-2">
                        <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest block">
                          Soft Skills Requeridas ({selectedVac.requiredGuidanceLevel || 'Jr. A'})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(selectedVac.softSkills && selectedVac.softSkills.length > 0
                            ? selectedVac.softSkills
                            : PROFILE_SOFTSKILLS_CATALOG[selectedVac.requiredGuidanceLevel || 'Jr. A']?.softSkills || []
                          ).map((ss, idx) => (
                            <span key={idx} className="bg-purple-50 text-purple-800 border border-purple-200 text-[10px] px-2.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                              <span>✓</span> {ss}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Profile Interpretation & Weight Breakdown */}
                  {(() => {
                    const profiles = interpretVacancyProfileWeights(selectedVac);
                    return (
                      <div className="space-y-2.5 bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest block">
                            Interpretación IA: Perfiles y Peso Porcentual
                          </span>
                          <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                            Mayor Peso: {profiles[0]?.weight}%
                          </span>
                        </div>
                        <div className="space-y-2">
                          {profiles.map((p, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between items-center text-[11px]">
                                <span className={`font-bold ${idx === 0 ? 'text-indigo-950' : 'text-slate-700'}`}>
                                  {p.profile} <span className="text-[9.5px] text-indigo-600 font-extrabold">[{p.roleType}]</span>
                                </span>
                                <span className="font-mono font-extrabold text-indigo-800">{p.weight}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${idx === 0 ? 'bg-indigo-600' : 'bg-indigo-400'}`}
                                  style={{ width: `${p.weight}%` }}
                                />
                              </div>
                              {p.focusAreas.length > 0 && (
                                <p className="text-[10px] text-slate-500 leading-tight">
                                  Enfoque: {p.focusAreas.slice(0, 3).join(', ')}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Competency thresholds targets */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ubrales Esperados (IA Pre-calificación)</span>
                    <div className="grid grid-cols-1 gap-2 font-semibold text-xs">
                      {Object.entries(selectedVac.minCompetenciesRequired).map(([compName, val]) => (
                        <div key={compName} className="space-y-1">
                          <div className="flex justify-between items-center text-slate-600 text-[11px]">
                            <span>{compName}</span>
                            <span>Min: {val}/100</span>
                          </div>
                          <div className="w-full h-1 bg-slate-100 rounded-full">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${val}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Requirements List */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Palabras Clave Críticas</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedVac.requirements.map((req, idx) => (
                        <span key={idx} className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-bold">
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Assigned Candidates list inside the vacancy */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Talentos Vinculados ({assigned.length})</span>
                      {assigned.length > 0 && (
                        <button
                          onClick={() => handleGenerateEmailTemplate(selectedVac, assigned)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-100/70 transition rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          <Mail className="h-3.5 w-3.5 text-indigo-650" />
                          Generar Correo
                        </button>
                      )}
                    </div>


                    {assigned.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {assigned.map((cand) => {
                          const strictEval = calculateStrictFitScore(cand, selectedVac);
                          const isMismatch = !!strictEval.hasDomainMismatch;
                          const displayScore = strictEval.fitScore;
                          return (
                            <div 
                              key={cand.id}
                              className={`p-3 bg-slate-50 border rounded-xl flex items-center justify-between hover:border-indigo-200 transition ${
                                isMismatch ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'
                              }`}
                            >
                              <div className="space-y-0.5 text-xs">
                                <h4 className="font-bold text-slate-900 leading-tight block">{cleanCandidateName(cand.name, cand.resumeText, cand.email)}</h4>
                                <p className="text-[10px] text-slate-500 block leading-tight font-medium">Clasificación: <strong className="text-slate-700 font-bold">{cand.stage}</strong></p>
                                {isMismatch && (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-rose-100 text-rose-800 border border-rose-200 mt-0.5">
                                    [AVISO] Incompatible con la vacante
                                  </span>
                                )}
                              </div>
                              <div className={`px-2 py-1 rounded-lg text-right shrink-0 border ${
                                isMismatch ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              }`}>
                                <span className="text-xs font-black block">{displayScore}%</span>
                                <span className="text-[8px] block tracking-wide uppercase font-black text-[8px]">Ajuste</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-4 text-center rounded-xl border border-dashed border-slate-200">
                        <AlertCircle className="h-5 w-5 text-slate-400 mx-auto mb-1.5" />
                        <p className="text-xs text-slate-500">Ningún candidato asignado a esta vacante.</p>
                        <p className="text-[10px] text-slate-400">Vincula talentos desde el Pipeline.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          :
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-500">
              <Sparkles className="h-7 w-7 text-indigo-500 mx-auto mb-2 animate-pulse" />
              <h3 className="text-xs font-bold text-slate-700">Analizador Inteligente</h3>
              <p className="text-[11px] text-slate-400 leading-normal max-w-xs mx-auto mt-1">
                Selecciona una vacante corporativa a la izquierda para inspeccionar requerimientos clave, umbrales de pre-selección u observar los candidatos asignados por inteligencia de coincidencia.
              </p>
            </div>
          }
        </div>

      </div>

      {/* MODAL WINDOW: Add Vacancy */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-left">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl relative overflow-hidden"
            >
              <div className="pb-4 border-b border-slate-100 mb-5">
                <h3 className="text-base font-bold text-slate-900">
                  {editingVacancy ? 'Editar Vacante Corporativa' : 'Publicar Vacante Corporativa'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Define los requerimientos básicos que usará el motor de precalificación de EAS Engine AI™.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-1 sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Título del Puesto</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Líder de Selección en Atracción de Talento"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Área / Departamento</label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                    >
                      {/* Catálogo + el valor actual si no está en él: el detalle siempre muestra el área real
                          (antes, un valor fuera de catálogo se veía como la primera opción, "COMERCIAL"). */}
                      {areaOptionsFor(department).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Región / Ubicación</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. CDMX - Presencial"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                    />
                  </div>

                                    <div className="space-y-1.5 col-span-1 sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700">Nivel Guía de Puesto (Perfil Puesto Guias - Rangos 1 al 6)</label>
                    <select
                      value={requiredGuidanceLevel}
                      onChange={(e) => {
                        const level = e.target.value;
                        setRequiredGuidanceLevel(level);
                        const profile = PROFILE_SOFTSKILLS_CATALOG[level];
                        if (profile) {
                          setMinLid(profile.minL);
                          setMinCom(profile.minC);
                          setMinTrab(profile.minT);
                          setMinTec(profile.minTe);
                          setMinRes(profile.minR);
                          if (!requirementsInput.trim()) {
                            setRequirementsInput(profile.defaultReqs);
                          }
                        }
                      }}
                      className="w-full bg-indigo-50/60 border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                    >
                      <option value="Becario">Becario (Rango 1 - 0 a 1 año exp)</option>
                      <option value="Jr. C">Jr. C (Rango 2 - 0.5 a 1.5 años exp)</option>
                      <option value="Jr.B">Jr. B (Rango 3 - 1 a 2 años exp)</option>
                      <option value="Consultor A">Consultor A (Rango 4 - 1 a 3 años exp)</option>
                      <option value="Senior B">Senior B (Rango 5 - 3 a 5 años exp)</option>
                      <option value="Senior A">Senior A (Rango 6 - 5 a 7 años exp)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Experiencia Mínima (Años)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-700">Oferta Salarial Mensual / Tabulador</label>
                      <button
                        type="button"
                        onClick={() => setSalaryRange('TBD (Por Definir)')}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 cursor-pointer"
                      >
                        Fijar "TBD (Por Definir)"
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder='Ej. $40,000 - $60,000 MXN o "TBD (Por Definir)"'
                      value={salaryRange}
                      onChange={(e) => setSalaryRange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Nivel de Inglés (Requisito SR)</label>
                    <select
                      value={englishLevel}
                      onChange={(e) => setEnglishLevel(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                    >
                      <option value="Básico">Básico</option>
                      <option value="Medio">Medio</option>
                      <option value="Avanzado">Avanzado</option>
                    </select>
                  </div>

                   <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Modalidad de Trabajo</label>
                    <select
                      value={modalidad}
                      onChange={(e) => setModalidad(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                    >
                      <option value="Presencial">Presencial</option>
                      <option value="Remoto">Remoto</option>
                      <option value="Híbrido">Híbrido</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Estatus de la Vacante</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                    >
                      <option value="Activa">Activa</option>
                      <option value="StandBy">StandBy</option>
                      <option value="Baja">Baja</option>
                      <option value="Cubierta">Cubierta</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Descripción Breve de la Vacante</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Describe las responsabilidades centrales del puesto de forma atractiva..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700">Habilidades Clave Exigidas (Separadas por comas)</label>
                    <span className="text-[10px] text-slate-400 font-bold">Crítico para EAS Match Engine™</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ejemp: react, typescript, tailwind, frontend, css"
                    value={requirementsInput}
                    onChange={(e) => setRequirementsInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                  />
                </div>

                {/* Expected Thresholds setup */}
                                  {PROFILE_SOFTSKILLS_CATALOG[requiredGuidanceLevel] && (
                    <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wide block">
                        Soft Skills & Competencias Tropicalizadas ({requiredGuidanceLevel})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {PROFILE_SOFTSKILLS_CATALOG[requiredGuidanceLevel].softSkills.map((ss, idx) => (
                          <span key={idx} className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-md font-bold">
                            ✓ {ss}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Umbrales de Competencias Mínimas (1-100)</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold text-slate-600">
                        <span>Liderazgo</span>
                        <span>{minLid}</span>
                      </div>
                      <input type="range" min="10" max="100" value={minLid} onChange={e => setMinLid(Number(e.target.value))} className="w-full accent-indigo-600" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold text-slate-600">
                        <span>Comunicación</span>
                        <span>{minCom}</span>
                      </div>
                      <input type="range" min="10" max="100" value={minCom} onChange={e => setMinCom(Number(e.target.value))} className="w-full accent-indigo-600" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold text-slate-600">
                        <span>Trabajo en Equipo</span>
                        <span>{minTrab}</span>
                      </div>
                      <input type="range" min="10" max="100" value={minTrab} onChange={e => setMinTrab(Number(e.target.value))} className="w-full accent-indigo-600" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold text-slate-600">
                        <span>Habilidades Técnicas</span>
                        <span>{minTec}</span>
                      </div>
                      <input type="range" min="10" max="100" value={minTec} onChange={e => setMinTec(Number(e.target.value))} className="w-full accent-indigo-600" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <div className="flex justify-between font-bold text-slate-600">
                        <span>Resolución de Problemas</span>
                        <span>{minRes}</span>
                      </div>
                      <input type="range" min="10" max="100" value={minRes} onChange={e => setMinRes(Number(e.target.value))} className="w-full accent-indigo-600" />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition"
                  >
                    {editingVacancy ? 'Guardar Cambios' : 'Publicar Vacante'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL WINDOW: Email Template Preview */}
      <AnimatePresence>
        {showEmailModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-left animate-fadeIn">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl relative overflow-hidden"
            >
              <div className="pb-4 border-b border-slate-100 mb-4 flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                    <Mail className="h-5 w-5 text-indigo-650" />
                    Propuesta de Candidatos por Correo
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Copia esta plantilla optimizada con resúmenes, fortalezas y áreas de oportunidad.</p>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Selector de alcance: TOP 3 vs Todos */}
              <div className="flex items-center gap-2 mb-3 bg-slate-100 p-1 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setEmailScope('top3');
                    if (currentEmailVacancy) {
                      setGeneratedEmailBody(buildEmailContent(currentEmailVacancy, currentEmailCandidates, 'top3'));
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    emailScope === 'top3' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  TOP 3 Recomendados (Óptimo)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailScope('all');
                    if (currentEmailVacancy) {
                      setGeneratedEmailBody(buildEmailContent(currentEmailVacancy, currentEmailCandidates, 'all'));
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    emailScope === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos los Candidatos ({currentEmailCandidates.length})
                </button>
              </div>

              <div className="space-y-4">
                <textarea
                  readOnly
                  rows={14}
                  value={generatedEmailBody}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-mono text-slate-800 focus:outline-none resize-none font-semibold leading-relaxed"
                />

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyToClipboard}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      copiedSuccess 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {copiedSuccess ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        ¡Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copiar Correo
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
