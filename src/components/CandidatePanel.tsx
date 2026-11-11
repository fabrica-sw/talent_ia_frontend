import React, { useMemo, useState, useEffect } from 'react';
import { Plus, Sparkles, TrendingUp, TrendingDown, HelpCircle, Send, X, Users, UploadCloud, Copy, Mail, Award, Briefcase, ChevronDown, ChevronUp, ChevronRight, Download, AlertTriangle, Edit, Phone, MapPin } from 'lucide-react';
import type { Candidate, CandidateStage, CompetencyMap, EnglishLevel, Vacancy, UserRole } from '../types';
import { api, authFetch } from '../api';
import FitGauge from './FitGauge';
import InviteModal from './InviteModal';
import CandidateFitMatrix from './candidate/CandidateFitMatrix';
import logoUrl from '../eas_logo.png';

import {
  fixCorruptedAccents,
  cleanCandidateName,
  calculateStrictFitScore,
  computeGuidanceForCandidate,
  interpretVacancyProfileWeights,
  synthesizeAnalyticalCandidateSummary,
  isLegacyOrClonedSummary,
  calculateCandidateCompetencies,
  isStaticLegacyCompetencies
} from '../utils/vacancyUtils';
import { generateExperienceQuestions, FIXED_AVAILABILITY_QUESTIONS, isQuestionRelevant } from '../utils/questionEngine';
import { recordAuditLog } from '../utils/auditLogger';
import { copyToClipboard } from '../utils/clipboardUtils';
import {
  normalizeCanonicalExperience,
  normalizeCanonicalEducation,
  normalizeCanonicalCertifications,
  isLocationString,
  stripBulletPoints,
  cleanExecutiveDetails,
  detectDegradedCvFields
} from '../utils/canonicalCvNormalizer';

export function cleanEnginePrefix(text?: string): string {
  if (!text) return '';
  return fixCorruptedAccents(text.replace(/\[EAS Engine[^\]]*\]\s*/gi, '').trim());
}

export function extractLocationFromResume(resumeText?: string): string {
  if (!resumeText) return 'México (Remoto / Presencial)';
  const match = resumeText.match(/\b(Ciudad de M[ée]xico|CDMX|Guadalajara|Monterrey|Quer[ée]taro|Puebla|M[ée]rida|Tijuana|Le[oó]n|Toluca|Canc[uú]n|Estado de M[ée]xico|Edomex|M[ée]xico|Colombia|Bogot[aá]|Per[uú]|Lima|Chile|Santiago|Argentina|Buenos Aires|Venezuela|Caracas|Espa[ñn]a|Madrid)\b/i);
  if (match) return match[0];
  if (/remoto|remote/i.test(resumeText)) return 'Remoto';
  if (/h[íi]brido|hybrid/i.test(resumeText)) return 'Híbrido';
  return 'México (Disponible)';
}

const MONTHS_NAMES_REGEX = /^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|feb|mar|apr|jun|jul|aug|sept)$/i;
const TEMPORAL_MARKERS_REGEX = /^(presente|actual|actualidad|vigente|present|current|ongoing)$/i;

const isActionPhrase = (str: string): boolean => {
  if (!str) return false;
  const l = str.trim().toLowerCase();
  return /^(impulsando|coordinando|liderando|gestionando|definiendo|desarrollando|implementando|administrando|supervisando|diseñando|creando|ejecutando|asegurando|colaborando|apoyando|generando|optimizando|automatizando|monitoreando|brindando|participando|responsable de|encargado de|definición de|toma de decisiones|seguimiento ejecutivo|gestión de|dirección de|administración de|experiencia en)/i.test(l) ||
    (/\b(toma de decisiones|planes de trabajo|seguimiento ejecutivo|gestión ágil|cumplimiento de objetivos|entregables)\b/i.test(l) && l.length > 25);
};

export function formatWorkExperienceItem(expStr: string): { position: string; company: string; period: string; details?: string } {
  if (!expStr || !expStr.trim()) {
    return { position: 'Consultor / Especialista Senior', company: 'Empresa Corporativa / Servicios TI', period: 'Periodo profesional' };
  }
  const cleanStr = fixCorruptedAccents(expStr.replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim());
  const rawParts = cleanStr.split('|').map(s => fixCorruptedAccents(s.trim())).filter(Boolean);

  if (rawParts.length === 0) {
    return { position: 'Consultor / Especialista Senior', company: 'Empresa Corporativa / Servicios TI', period: 'Periodo profesional' };
  }

  let position = '';
  let company = '';
  let period = '';
  let details = '';

  const isPeriodStr = (str: string): boolean => {
    if (!str) return false;
    const l = str.trim().toLowerCase();
    if (l === 'periodo profesional' || l === 'periodo laboral' || l === 'periodo no especificado' || l.includes('periodo')) return false;
    if (MONTHS_NAMES_REGEX.test(l) || TEMPORAL_MARKERS_REGEX.test(l)) return true;
    return /\b(19\d{2}|20\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|presente|actual|actualidad|present)\b/i.test(str) ||
      /\b(20\d{2}\s*[-–—\sa-zÁÉÍÓÚáéíóú]*\s*(?:20\d{2}|19\d{2}|presente|actual)?)\b/i.test(str);
  };

  const isPositionStr = (str: string): boolean => {
    if (!str) return false;
    const s = str.trim();
    if (MONTHS_NAMES_REGEX.test(s) || TEMPORAL_MARKERS_REGEX.test(s) || isPeriodStr(s) || isActionPhrase(s)) return false;
    return /\b(manager|gerente|director|directora|subdirector|subdirectora|líder|lider|lead|leader|head|consultor|consultora|consultant|desarrollador|desarrolladora|developer|analista|analyst|especialista|specialist|ingeniero|ingeniera|engineer|coordinador|coordinadora|coordinator|coordinación|coordinacion|jefe|jefa|system|project|sales|executive|ejecutivo|ejecutiva|architect|arquitecto|arquitecta|admin|administrator|administrador|administradora|sdr|ae|kam|account manager|scrum master|scrum|product owner|product manager|data owner|agile coach|trainee|practicante|officer|asesor|asesora|empleada|empleado|maestra|maestro|tester|qa|quality assurance|vicepresidente|vp|socio|partner)\b/i.test(str);
  };

  const isCompanyStr = (str: string): boolean => {
    if (!str) return false;
    const l = str.trim().toLowerCase();
    if (isPeriodStr(str) || MONTHS_NAMES_REGEX.test(l) || TEMPORAL_MARKERS_REGEX.test(l) || isActionPhrase(str)) return false;
    if (l.includes('empresa líder') || l.includes('empresa destacada') || l.includes('institución de educación') || l.includes('periodo') || l.includes('eas consulting') || l.includes('eas group')) return false;
    if (/\b(s\.?a\.?|de c\.?v\.?|inc\.?|llc|corp|corporation|company|grupo|group|banco|bank|financiero|financiera|seguros|insurance|consulting|solutions|technologies|services|servicios|systems|laboratorios|fundación|fundacion|hospital|editorial|tienda|retail|comercial|banorte|bbva|santander|citibanamex|banamex|hsbc|scotiabank|inbursa|axa|gnp|metlife|mapfre|qualitas|google|microsoft|amazon|aws|ibm|oracle|sap|dxc|accenture|tcs|tata|infosys|wipro|softtek|globant|neoris|alestra|totalplay|telcel|telmex|claro|at&t|televisa|tv azteca|liverpool|palacio|walmart|soriana|chedraui|femsa|oxxo|bimbo|cemex|modelo|heineken|dondé|donde|salinas|elektra|coppel|trinity|tecmilenio|tec milenio|b-more|sector privado)\b/i.test(l)) {
      return true;
    }
    if (str.length > 55 || str.includes(';') || (str.includes(',') && !/\b(s\.a\.|inc\.|llc)\b/i.test(l))) return false;
    return !isPositionStr(str);
  };

  // Extraer detalles de frases de acción primero para no contaminar empresa o puesto
  const cleanParts: string[] = [];
  for (const part of rawParts) {
    if (isActionPhrase(part)) {
      details = details ? `${details} | ${part}` : part;
    } else {
      cleanParts.push(part);
    }
  }

  // 1. Detección de anomalía con mes huérfano en Parte 0 (ej: "Octubre | Grupo Financiero Banorte | 2024 - 2026")
  if (cleanParts.length >= 2 && MONTHS_NAMES_REGEX.test(cleanParts[0]) && isCompanyStr(cleanParts[1])) {
    company = cleanParts[1];
    period = cleanParts[2] && isPeriodStr(cleanParts[2]) ? `${cleanParts[0]} ${cleanParts[2]}` : cleanParts[0];
    if (cleanParts[3]) details = details ? `${details} | ${cleanParts.slice(3).join(' | ')}` : cleanParts.slice(3).join(' | ');
    position = 'Coordinador / Especialista de Proyecto';
    return { position, company, period, details: details ? fixCorruptedAccents(cleanExecutiveDetails(details)) : undefined };
  }

  // 2. Asignación directa si cumple el orden canónico [PUESTO | EMPRESA]
  if (cleanParts.length >= 2) {
    const p0 = cleanParts[0];
    const p1 = cleanParts[1];

    if (isPositionStr(p0) && isCompanyStr(p1)) {
      position = p0;
      company = p1;
    } else if (isCompanyStr(p0) && isPositionStr(p1)) {
      company = p0;
      position = p1;
    } else if (isPositionStr(p0) && !isPeriodStr(p1)) {
      position = p0;
      company = p1;
    } else if (isCompanyStr(p1)) {
      company = p1;
      position = isPositionStr(p0) ? p0 : '';
    }
  }

  // 3. Procesamiento de periodo y responsabilidades/logros
  for (let i = 0; i < cleanParts.length; i++) {
    const part = cleanParts[i];
    if (part === position || part === company) continue;
    if (!period && isPeriodStr(part)) {
      period = part;
    } else if (isPositionStr(part) && !position) {
      position = part;
    } else if (isCompanyStr(part) && !company) {
      company = part;
    } else if (part.length > 20 && !details) {
      details = part;
    }
  }

  // 4. Fallbacks con los elementos restantes
  if (!position) {
    const posCandidate = cleanParts.find(p => p !== company && p !== period && !isPeriodStr(p) && !isCompanyStr(p));
    if (posCandidate && !MONTHS_NAMES_REGEX.test(posCandidate) && !TEMPORAL_MARKERS_REGEX.test(posCandidate)) {
      position = posCandidate;
    }
  }
  if (!company) {
    const compCandidate = cleanParts.find(p => p !== position && p !== period && !isPeriodStr(p));
    if (compCandidate && !isActionPhrase(compCandidate)) {
      company = compCandidate;
    }
  }
  if (!period) {
    const perCandidate = cleanParts.find(p => isPeriodStr(p));
    if (perCandidate) period = perCandidate;
  }

  // 5. Swap de seguridad: si la empresa contiene un cargo evidente y la posición una empresa
  if (company && isPositionStr(company) && (!position || isCompanyStr(position))) {
    const tmp = position;
    position = company;
    company = tmp;
  }

  // Si position resultó ser un mes huérfano o un marcador temporal (ej: "Octubre" o "Presente")
  if (position && (MONTHS_NAMES_REGEX.test(position.trim()) || TEMPORAL_MARKERS_REGEX.test(position.trim()))) {
    if (!period || period.toLowerCase().includes('periodo')) {
      period = position;
    } else {
      period = `${period} (${position})`;
    }
    position = 'Coordinador / Especialista de Proyecto';
  }

  // Si company contiene una frase de acción, moverla a details
  if (company && isActionPhrase(company)) {
    details = details ? `${company} | ${details}` : company;
    company = 'Empresa del Sector Privado';
  }

  // Limpieza de empresas genéricas o EAS residual
  if (!company || company.toLowerCase().includes('empresa líder') || company.toLowerCase().includes('empresa destacada') || company.toLowerCase().includes('eas consulting') || company.toLowerCase().includes('eas group')) {
    company = 'Empresa del Sector Privado / Servicios TI';
  }
  if (!position || isLocationString(position)) {
    position = 'Consultor / Especialista Senior';
  }
  if (isLocationString(company)) {
    company = 'Empresa del Sector Privado';
  }
  if (!period || period.toLowerCase().includes('periodo')) {
    period = 'Periodo profesional';
  }

  if (details) {
    details = cleanExecutiveDetails(details);
  }

  return { position, company, period, details: details ? fixCorruptedAccents(details) : undefined };
}

const isJunkEduString = (str: string): boolean => {
  if (!str) return true;
  const l = str.trim().toLowerCase();
  return /^(of \d+|page \d+|\d+ of \d+|p[aá]gina \d+|hoja \d+|--|\/\/|==|\.)$/i.test(l) ||
    /\b(of 2|of 3|of 4|página|hoja)\b/i.test(l) ||
    l === '--' || l.length <= 2;
};

export function normalizeEducationList(rawList: string[]): string[] {
  if (!Array.isArray(rawList)) return [];
  const results: string[] = [];

  const isInstStr = (str: string) => {
    if (!str || isJunkEduString(str)) return false;
    return /\b(universidad|instituto|unam|ipn|itesm|tecnologico|tecnológico|tecmilenio|tec milenio|college|school|faculty|facultad|centro de estudios|politécnico|politecnico|escom|upiicsa|cecyt|uam|ibero|anahuac|anáhuac|autónoma|autonoma|cbtis|upt|unitec|uvm)\b/i.test(str);
  };

  const isDegreeStr = (str: string) => {
    if (!str || isJunkEduString(str)) return false;
    const l = str.trim().toLowerCase();
    if (l.startsWith('instituto') || l.startsWith('universidad') || l.startsWith('escuela') || l.startsWith('facultad') || l.startsWith('ipn') || l.startsWith('unam') || l.startsWith('itesm') || l.startsWith('tecmilenio')) {
      return false;
    }
    return /\b(licenciatura|ingeniería|ingenieria|maestría|maestria|doctorado|posgrado|diplomado|bachelor|degree|master|mba|m\.sc|phd|titulado|pasante|carrera|curso|\bt[eé]cnico\b)\b/i.test(str);
  };

  for (const item of rawList) {
    if (!item || typeof item !== 'string') continue;
    const clean = item.trim();

    // Descartar encabezados espurios o secciones cruzadas
    if (/^(certificaciones|certificados|idiomas|cursos|habilidades|skills)/i.test(clean)) {
      continue;
    }
    if (clean.toLowerCase().includes('certificaciones e idiomas') && (clean.toLowerCase().includes('axa seguros') || clean.toLowerCase().includes('data engineer'))) {
      continue;
    }
    if (isJunkEduString(clean)) {
      continue;
    }

    // Si contiene múltiples grados colapsados con pipes
    const rawParts = clean.split(/\s*\|\s*/);
    const subDegrees: string[] = [];
    let currentDegreeParts: string[] = [];

    for (let i = 0; i < rawParts.length; i++) {
      const p = rawParts[i].replace(/^[\uF0B7\u2022\u25CF\u25AA\u25FE•\-\*\s]+/, '').trim();
      if (!p || p.toLowerCase().includes('periodo de estudios') || isJunkEduString(p)) continue;

      const hasDegreeAlready = currentDegreeParts.some(x => isDegreeStr(x));
      const hasInstAlready = currentDegreeParts.some(x => isInstStr(x));
      const isNewDegree = (isDegreeStr(p) && hasDegreeAlready) || (isInstStr(p) && hasInstAlready && currentDegreeParts.length >= 2);

      if (isNewDegree && currentDegreeParts.length > 0) {
        subDegrees.push(currentDegreeParts.join(' | '));
        currentDegreeParts = [p];
      } else {
        currentDegreeParts.push(p);
      }
    }
    if (currentDegreeParts.length > 0) {
      subDegrees.push(currentDegreeParts.join(' | '));
    }

    if (subDegrees.length > 1) {
      for (const sd of subDegrees) {
        results.push(sd);
      }
      continue;
    }

    results.push(clean);
  }

  return results.filter(r => r.length > 5 && !isJunkEduString(r) && !r.toLowerCase().includes('certificaciones e idiomas'));
}

export function formatEducationItem(eduStr: string): { degree: string; institution: string; period: string } {
  if (!eduStr || !eduStr.trim()) {
    return { degree: 'Licenciatura / Ingeniería en Sistemas o Formación Afín', institution: 'Universidad / Instituto de Educación Superior', period: 'Periodo de estudios' };
  }
  const cleanStr = fixCorruptedAccents(eduStr.replace(/^[•\-\*\d\.\)\s✓●\uF0B7]+/, '').trim());
  const rawParts = cleanStr.split('|').map(s => fixCorruptedAccents(s.trim())).filter(p => Boolean(p) && !isJunkEduString(p));

  if (rawParts.length === 0) {
    return { degree: 'Licenciatura / Formación Profesional', institution: 'Universidad / Instituto de Educación Superior', period: 'Periodo de estudios' };
  }

  let degree = '';
  let institution = '';
  let period = '';

  const isPeriodStr = (str: string) => {
    if (!str) return false;
    const l = str.toLowerCase();
    if (l.includes('periodo')) return false;
    return /\b(19\d{2}|20\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/i.test(str) ||
      /\b(20\d{2}\s*[-–—\sa-zÁÉÍÓÚáéíóú]*\s*(?:20\d{2}|19\d{2})?)\b/i.test(str);
  };

  const isInstStr = (str: string) => {
    if (!str || isJunkEduString(str)) return false;
    return /\b(universidad|instituto|unam|ipn|itesm|tecnologico|tecnológico|tecmilenio|tec milenio|college|school|faculty|facultad|centro de estudios|politécnico|politecnico|escom|upiicsa|cecyt|uam|ibero|anahuac|anáhuac|autónoma|autonoma|cbtis|upt|unitec|uvm)\b/i.test(str);
  };

  const isDegreeStr = (str: string) => {
    if (!str || isJunkEduString(str)) return false;
    const l = str.trim().toLowerCase();
    if (l.startsWith('instituto') || l.startsWith('universidad') || l.startsWith('escuela') || l.startsWith('facultad') || l.startsWith('ipn') || l.startsWith('unam') || l.startsWith('itesm') || l.startsWith('tecmilenio')) {
      return false;
    }
    return /\b(licenciatura|ingeniería|ingenieria|maestría|maestria|doctorado|posgrado|diplomado|bachelor|degree|master|mba|m\.sc|phd|titulado|pasante|carrera|curso|\bt[eé]cnico\b)\b/i.test(str);
  };

  // Desacoplar años o fechas que vengan pegadas a la institución o carrera
  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    const yearMatch = part.match(/(?:,\s*|\s*[-–—]\s*|\s+)(19\d{2}|20\d{2})\b/);
    if (yearMatch && yearMatch[1]) {
      if (!period || period.toLowerCase().includes('periodo')) {
        period = yearMatch[1];
      }
      rawParts[i] = part.replace(yearMatch[0], '').trim();
    }
  }

  // Buscar periodo en las partes
  for (const part of rawParts) {
    if (!period && isPeriodStr(part)) {
      period = part;
    }
  }

  // Si una sola parte contiene tanto Institución como Grado
  for (const part of rawParts) {
    if (isPeriodStr(part) || isJunkEduString(part)) continue;

    const matchInstAndDegree = part.match(/^(.*?(?:ITESM|IPN|UNAM|UAM|UVM|UNITEC|Tecmilenio|Tec Milenio|Tecnológico de Monterrey(?:\s*\([^\)]+\))?|Instituto Politécnico Nacional(?:\s*\([^\)]+\))?(?:\s*[-–—\s*[A-Za-z0-9]+)?|Universidad [^\(\n\-]+(?:\s*\([^\)]+\))?))\s+((?:Posgrado|Licenciatura|Ingeniería|Ingenieria|Maestría|Maestria|Doctorado|MBA|Técnico|Tecnico|Diplomado).*)$/i);
    if (matchInstAndDegree && matchInstAndDegree[1] && matchInstAndDegree[2]) {
      if (!institution) institution = matchInstAndDegree[1].trim();
      if (!degree) degree = matchInstAndDegree[2].trim();
      continue;
    }

    const matchDegreeAndInst = part.match(/^(.*?(?:Posgrado|Licenciatura|Ingeniería|Ingenieria|Maestría|Maestria|Doctorado|MBA|Técnico|Tecnico)[^,\-]+)(?:[-–—|]|en)\s*(.*)$/i);
    if (matchDegreeAndInst && matchDegreeAndInst[1] && matchDegreeAndInst[2] && isInstStr(matchDegreeAndInst[2])) {
      if (!degree) degree = matchDegreeAndInst[1].trim();
      if (!institution) institution = matchDegreeAndInst[2].trim();
      continue;
    }

    if (!institution && isInstStr(part)) {
      institution = part;
    } else if (!degree && isDegreeStr(part)) {
      degree = part;
    }
  }

  // Fallbacks con las partes restantes limpias
  const nonPeriodParts = rawParts.filter(p => !isPeriodStr(p) && !isJunkEduString(p));
  if (!degree && nonPeriodParts.length > 0) {
    const candidate = nonPeriodParts.find(p => p !== institution);
    if (candidate && !isJunkEduString(candidate)) degree = candidate;
  }
  if (!institution && nonPeriodParts.length > 0) {
    const candidate = nonPeriodParts.find(p => p !== degree && !p.toLowerCase().includes('periodo') && !isJunkEduString(p));
    if (candidate) institution = candidate;
  }

  // Swap de seguridad: si degree contiene universidad e institution grado
  if (degree && isInstStr(degree) && !isInstStr(institution)) {
    const tmp = institution;
    institution = degree;
    degree = tmp;
  }

  // Swap de seguridad si institution quedó como "Periodo de estudios" y period tiene la institución
  if (institution && institution.toLowerCase().includes('periodo') && period && !period.toLowerCase().includes('periodo')) {
    const tmp = institution;
    institution = period;
    period = tmp.toLowerCase().includes('periodo de estudios') ? 'Periodo de estudios' : tmp;
  }

  if (isJunkEduString(degree)) {
    degree = '';
  }
  if (isJunkEduString(institution)) {
    institution = '';
  }

  if (!degree) degree = 'Licenciatura / Formación Profesional';
  if (!institution || institution.toLowerCase().includes('periodo')) institution = 'Universidad / Instituto de Educación Superior';
  if (!period || period.toLowerCase().includes('periodo')) period = 'Periodo de estudios';

  return { degree, institution, period };
}

export function escapeHtml(str: string = ''): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function extractCvSectionsFromText(resumeText: string = ''): {
  summary: string;
  experience: string[];
  education: string[];
  certifications: string[];
} {
  if (!resumeText || !resumeText.trim()) {
    return {
      summary: "Profesional especialista con sólida trayectoria en gestión de proyectos y consultoría tecnológica.",
      experience: ["Consultor / Especialista Senior | Empresa Corporativa / Servicios TI | Periodo profesional"],
      education: ["Licenciatura / Ingeniería en Sistemas Computacionales o Administración | Universidad / Instituto | Periodo de estudios"],
      certifications: ["Certificación en Metodologías Ágiles (Scrum Master / Product Owner) | 2024"]
    };
  }

  const rawLines = resumeText.split('\n').map(l => l.trim()).filter(Boolean);
  const summaryLines: string[] = [];
  let inSummary = false;

  const dateRegex = /\b((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|[0-9]{1,2}[\/\.]?)?\s*(?:19\d{2}|20\d{2})\s*(?:[-–—\sa-zÁÉÍÓÚáéíóú0-9\/\.]*)\s*(?:19\d{2}|20\d{2}|presente|actual|actualidad|present|to\s+actual)?))\b/i;
  const roleKeywordsRegex = /\b(analyst|analista|owner|manager|gerente|lead|lider|líder|consultant|consultor|consultora|developer|desarrollador|engineer|ingeniero|ingeniera|director|directora|specialist|especialista|architect|arquitecto|coordinador|coordinadora|subdirector|subdirectora|scrum master|head|administrator|administrador|ejecutivo|executive|account manager|kam)\b/i;
  const sectionBreakRegex = /^(educaci[oó]n|education|estudios|formaci[oó]n|certificac|certificados?|habilidades|skills|idiomas|languages|cursos|diplomados|reconocimientos)[\s\:\-]*$/i;

  // 1. Resumen Ejecutivo
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lower = line.toLowerCase();
    const cleanL = line.replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
    const cleanLow = cleanL.toLowerCase();

    const inlineMatch = line.match(/^(?:summary|resumen|perfil\s+profesional|perfil|profile)\s*[\:\-]\s*(.{25,})/i);
    if (inlineMatch && inlineMatch[1] && summaryLines.length === 0) {
      summaryLines.push(inlineMatch[1].trim());
      inSummary = true;
      continue;
    }

    if (
      cleanLow === 'perfil' || cleanLow === 'resumen' || cleanLow === 'perfil profesional' ||
      cleanLow === 'summary' || cleanLow === 'profile' || cleanLow === 'professional summary' ||
      cleanLow === 'executive summary' || cleanLow.startsWith('perfil profesional:')
    ) {
      inSummary = true;
      continue;
    }

    if (inSummary) {
      if (
        cleanLow.includes('experiencia') || cleanLow.includes('experience') ||
        cleanLow.includes('educación') || cleanLow.includes('education') ||
        cleanLow.includes('habilidades') || cleanLow.includes('skills')
      ) {
        break;
      }
      if (cleanL.length > 5 && summaryLines.join(' ').length < 650) {
        if (!cleanL.includes('@') && !cleanL.includes('http') && !cleanL.startsWith('linkedin.com')) {
          summaryLines.push(cleanL);
        }
      }
    }
  }

  // 2. Experiencia Laboral Estructurada
  const experience: string[] = [];
  let inExp = false;
  let currentCompany = '';
  let currentRole = '';
  let currentPeriod = '';
  let currentDetails: string[] = [];

  const commitJob = () => {
    if (currentCompany || currentRole) {
      let comp = currentCompany.trim();
      comp = comp.replace(/^(en\s+|at\s+)/i, '').trim();
      comp = comp.replace(/\s*[\(].*contract.*[\)]/i, '').trim();
      comp = comp.replace(/[\,\.\-\–\|]+$/, '').trim();
      if (!comp || ['empresa', 'company', 'actualmente', 'presente', 'of 3', 'of 2'].includes(comp.toLowerCase())) {
        comp = 'Empresa';
      }

      let role = currentRole.trim();
      role = role.replace(/[\,\.\-\–\|]+$/, '').trim();
      if (!role) role = 'Consultor / Especialista';

      const detailsStr = cleanExecutiveDetails(currentDetails.slice(0, 3).join('. '));
      const item = `${role} | ${comp} | ${currentPeriod || 'Periodo profesional'}${detailsStr ? ' | ' + detailsStr : ''}`;
      experience.push(item);
      currentCompany = '';
      currentRole = '';
      currentPeriod = '';
      currentDetails = [];
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const l = line.toLowerCase();
    const cleanL = line.replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
    const cleanLow = cleanL.toLowerCase();
    const collapsed = cleanLow.replace(/\s+/g, '');

    // Split check: Work \n Experience
    if (l === 'work' && i + 1 < rawLines.length && rawLines[i + 1].toLowerCase().startsWith('experience')) {
      inExp = true;
      continue;
    }

    // Header trigger check (incluye dos columnas, espaciado o extendido)
    const expHeaderSegs = line.split(/\t|\s{3,}/).map(s => s.replace(/^[•\-\*\d\.\)\s✓●:]+|[:\s]+$/g, '').trim()).filter(Boolean);
    const hasExpSeg = expHeaderSegs.some(seg => {
      const segLow = seg.toLowerCase();
      const segCol = segLow.replace(/\s+/g, '');
      return seg.length < 55 && (
        [
          'experiencialaboral', 'experienciaprofesional', 'experienciaprofesionalyaplicada',
          'trayectorialaboral', 'trayectoriaprofesional', 'workexperience', 'experiencia',
          'experience', 'professionalexperience', 'professionalworkexperience',
          'employmenthistory', 'workhistory', 'relevantexperience', 'experienciarelevante',
          'historiallaboral'
        ].includes(segCol) ||
        segLow.startsWith('experiencia profesional') || segLow.startsWith('experiencia laboral') ||
        segLow.startsWith('professional experience') || segLow.startsWith('work experience') ||
        segLow.startsWith('professional work experience') || segLow.startsWith('experiencia relevante')
      );
    });
    if (hasExpSeg || (cleanL.length < 55 && (
      [
        'experiencialaboral', 'experienciaprofesional', 'experienciaprofesionalyaplicada',
        'trayectorialaboral', 'trayectoriaprofesional', 'workexperience', 'experiencia',
        'experience', 'professionalexperience', 'professionalworkexperience',
        'employmenthistory', 'workhistory', 'relevantexperience', 'experienciarelevante',
        'historiallaboral'
      ].includes(collapsed) ||
      cleanLow.startsWith('experiencia profesional') || cleanLow.startsWith('experiencia laboral') ||
      cleanLow.startsWith('professional experience') || cleanLow.startsWith('work experience') ||
      cleanLow.startsWith('professional work experience') || cleanLow.startsWith('experiencia relevante')
    ))) {
      inExp = true;
      continue;
    }

    if (inExp && experience.length > 0 && cleanL.length < 35 && (
      sectionBreakRegex.test(cleanLow) ||
      ['educacion', 'educación', 'formacionacademica', 'formaciónacadémica', 'estudios', 'certificaciones'].includes(collapsed)
    )) {
      break;
    }

    if (!inExp) continue;

    if (
      cleanLow.startsWith('nacimiento') || cleanLow.startsWith('nacionalidad') || cleanLow.startsWith('estado civil') ||
      cleanLow.startsWith('dirección') || cleanLow.startsWith('email') || cleanLow.startsWith('teléfono') ||
      cleanLow.startsWith('phone:') || cleanLow.startsWith('e-mail:') || cleanLow.includes('of 3') || cleanLow.includes('of 2')
    ) {
      continue;
    }

    // Labeled formats
    if (/^company\s+name\s*[\:\-]/i.test(cleanL)) {
      commitJob();
      currentCompany = cleanL.replace(/^company\s+name\s*[\:\-]\s*/i, '').trim();
      continue;
    }
    if (/^(role|puesto|cargo|cargo desempeñado)\s*[\:\-]/i.test(cleanL)) {
      currentRole = cleanL.replace(/^(role|puesto|cargo|cargo desempeñado)\s*[\:\-]\s*/i, '').trim();
      continue;
    }
    if (/^(working\s+period|periodo|fechas?)\s*[\:\-]/i.test(cleanL)) {
      currentPeriod = cleanL.replace(/^(working\s+period|periodo|fechas?)\s*[\:\-]\s*/i, '').trim();
      continue;
    }

    // Patrón: "De MM/YYYY a MM/YYYY", Empresa en i+1, Cargo en i+2
    if (/^(?:de\s+)?\d{2}\/\d{4}\s+a\s+\d{2}\/\d{4}/i.test(cleanLow) && i + 1 < rawLines.length) {
      commitJob();
      currentPeriod = cleanL;
      const nextL = rawLines[i + 1].trim();
      if (/sector[\:\-]/i.test(nextL)) {
        currentCompany = nextL.replace(/\,?\s*sector[\:\-].*$/i, '').trim();
      } else {
        currentCompany = nextL;
      }
      if (i + 2 < rawLines.length && (/cargo/i.test(rawLines[i + 2]) || roleKeywordsRegex.test(rawLines[i + 2]))) {
        currentRole = rawLines[i + 2].replace(/^(?:cargo|puesto)\s+desempeñado\s*[\:\-]\s*/i, '').trim();
      }
      continue;
    }

    // Patrón 3 renglones: Puesto -> Empresa -> Fecha
    if (roleKeywordsRegex.test(cleanL) && cleanL.length < 65 && !line.startsWith('●') && !line.startsWith('') && !line.startsWith('✔') && !line.startsWith('-') && !cleanLow.startsWith('gestión')) {
      if (i + 1 < rawLines.length) {
        const next1 = rawLines[i + 1].trim();
        if (next1.length > 2 && next1.length < 60 && !next1.startsWith('●') && !next1.startsWith('') && !next1.startsWith('✔') && !next1.startsWith('-') && !next1.startsWith('*') && !/^(soporte|desarrollo|liderar|gestión|responsable)/i.test(next1)) {
          if (i + 2 < rawLines.length && dateRegex.test(rawLines[i + 2]) && rawLines[i + 2].length < 40) {
            commitJob();
            currentRole = cleanL;
            currentCompany = next1;
            currentPeriod = rawLines[i + 2].trim();
            continue;
          } else if (!/^(educación|habilidades|contacto)/i.test(next1)) {
            if (!currentRole && !currentCompany) {
              commitJob();
              currentRole = cleanL;
              currentCompany = next1;
              continue;
            }
          }
        }
      }
    }

    // Patrón: "Puesto, Empresa" seguido de Fecha en renglón siguiente
    if (roleKeywordsRegex.test(cleanL) && cleanL.includes(',') && cleanL.length < 85 && !line.startsWith('●') && !line.startsWith('') && !line.startsWith('✔')) {
      if (i + 1 < rawLines.length && dateRegex.test(rawLines[i + 1]) && rawLines[i + 1].length < 40) {
        const parts = cleanL.split(',').map(p => p.trim()).filter(Boolean);
        commitJob();
        currentRole = parts[0];
        currentCompany = parts[1] || 'Empresa';
        currentPeriod = rawLines[i + 1].trim();
        continue;
      }
    }

    // Patrón en dos renglones: Renglón 1 = Puesto, Renglón 2 = Empresa | Periodo
    if (!currentRole && roleKeywordsRegex.test(cleanL) && cleanL.length < 60 && !line.startsWith('●') && !line.startsWith('')) {
      if (i + 1 < rawLines.length) {
        const nextL = rawLines[i + 1].trim();
        if ((nextL.includes('|') || nextL.includes('–') || nextL.includes('-')) && dateRegex.test(nextL) && nextL.length < 90) {
          commitJob();
          currentRole = cleanL;
          const pMatch = nextL.match(dateRegex);
          currentPeriod = pMatch ? pMatch[0].trim() : 'Periodo profesional';
          const cClean = nextL.replace(currentPeriod, '').replace(/\|/g, '').replace(/[–-]/g, '').trim();
          currentCompany = cClean || 'Empresa';
          continue;
        }
      }
    }

    // Renglón aislado con SOLO rango de fechas (ej: "Junio 2023–Actualidad"), seguido de "Puesto • Empresa" en i+1
    const standaloneDateRangeMatch = cleanL.match(/^(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-záéíóú]*\.?\s*(?:de\s+)?)?(?:19\d{2}|20\d{2}|\d{1,2}\/\d{4})\s*[-–—a]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-záéíóú]*\.?\s*(?:de\s+)?)?(?:19\d{2}|20\d{2}|\d{1,2}\/\d{4}|actual|actualidad|present|presente|fecha)\s*$/i);
    if (standaloneDateRangeMatch && cleanL.length < 55 && !roleKeywordsRegex.test(cleanL)) {
      commitJob();
      currentPeriod = cleanL;
      if (i + 1 < rawLines.length) {
        const next1 = rawLines[i + 1].replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
        if (next1.length > 3 && next1.length < 130 && !/^(educaci[oó]n|certificac|habilidades)/i.test(next1)) {
          const splitByBulletOrPipe = next1.split(/[•|]/).map(p => p.trim()).filter(Boolean);
          const parts = splitByBulletOrPipe.length >= 2
            ? splitByBulletOrPipe
            : next1.split(/\s+[–—-]\s+/).map(p => p.trim()).filter(Boolean);
          if (parts.length >= 2) {
            const validParts = parts.filter(p => !isLocationString(p));
            if (validParts.length >= 2) {
              if (roleKeywordsRegex.test(validParts[0])) {
                currentRole = validParts[0];
                currentCompany = validParts[1];
              } else {
                currentCompany = validParts[0];
                currentRole = validParts[1];
              }
            } else if (validParts.length === 1) {
              if (roleKeywordsRegex.test(validParts[0])) {
                currentRole = validParts[0];
              } else {
                currentCompany = validParts[0];
              }
            }
            i++;
          } else if (next1.length < 85 && !next1.endsWith('.')) {
            if (roleKeywordsRegex.test(next1)) {
              currentRole = next1;
              if (i + 2 < rawLines.length && rawLines[i + 2].trim().length < 80 && !dateRegex.test(rawLines[i + 2]) && !/^(●|•|\-)/.test(rawLines[i + 2].trim())) {
                currentCompany = rawLines[i + 2].replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
                i += 2;
              } else {
                i++;
              }
            } else {
              currentCompany = next1;
              i++;
            }
          }
        }
      }
      continue;
    }

    // Formato con fecha al inicio: "Fecha \t Puesto, Empresa" o "Fecha \t Empresa | Puesto"
    const dateFirstMatch = cleanL.match(/^([a-záéíóú0-9\s–—\-\.\/]+(?:20\d{2}|19\d{2}|actual|presente))\s*[\t\|]\s*(.+)$/i)
      || cleanL.match(/^((?:(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)[a-z]*\s+)?(?:19\d{2}|20\d{2})\s*[-–—]\s*(?:(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)[a-z]*\s+)?(?:19\d{2}|20\d{2}|actual|actualidad|present|presente))\s+[-–—\|]?\s*(.+)$/i);
    if (dateFirstMatch && cleanL.length < 130 && !/^(?:actual|actualidad|present|presente|fecha)$/i.test(dateFirstMatch[2].trim())) {
      commitJob();
      currentPeriod = dateFirstMatch[1].trim();
      const rest = dateFirstMatch[2].trim();
      if (rest.includes('|')) {
        const parts = rest.split('|').map(p => p.trim()).filter(Boolean);
        if (roleKeywordsRegex.test(parts[0])) {
          currentRole = parts[0];
          currentCompany = parts[1] || 'Empresa';
        } else {
          currentCompany = parts[0];
          currentRole = parts[1] || 'Consultor / Especialista';
        }
      } else if (rest.includes(',')) {
        const parts = rest.split(',').map(p => p.trim()).filter(Boolean);
        if (roleKeywordsRegex.test(parts[0])) {
          currentRole = parts[0];
          currentCompany = parts[1] || 'Empresa';
        } else {
          currentCompany = parts[0];
          currentRole = parts[1] || 'Consultor / Especialista';
        }
      } else {
        currentRole = rest;
        currentCompany = 'Empresa';
      }
      continue;
    }

    // Formato "Puesto, Empresa, Fecha"
    if (roleKeywordsRegex.test(cleanL) && dateRegex.test(cleanL) && (cleanL.includes(',') || cleanL.includes('–') || cleanL.includes('-'))) {
      const pMatch = cleanL.match(dateRegex);
      const period = pMatch ? pMatch[0].trim() : 'Periodo profesional';
      const noDate = cleanL.replace(period, '').replace(/^[•*()\[\]\s\t–—,.\-]+/, '').replace(/[•*()\[\]\s\t–—,.\-]+$/, '').trim();
      if (noDate.includes(',')) {
        const parts = noDate.split(',').map(p => p.trim()).filter(Boolean);
        commitJob();
        currentPeriod = period;
        currentRole = parts[0];
        currentCompany = parts[1] || 'Empresa';
        continue;
      }
    }

    // Formato estándar con separadores (| o – o -)
    const isHeaderCandidate = (
      (cleanL.includes('|') || cleanL.includes(' – ') || cleanL.includes(' - ') || cleanL.includes(' –') || dateRegex.test(cleanL)) &&
      cleanL.length > 5 && cleanL.length < 115 &&
      (roleKeywordsRegex.test(cleanL) || dateRegex.test(cleanL))
    );

    if (isHeaderCandidate) {
      const periodMatch = cleanL.match(dateRegex);
      const period = periodMatch ? periodMatch[0].trim() : 'Periodo profesional';
      const cleanHeader = cleanL.replace(period, '').replace(/to Actual/gi, '').replace(/to actual/gi, '').replace(/^[•*()\[\]\s\t–—,\-]+/, '').replace(/[•*()\[\]\s\t–—,\-]+$/, '').trim();

      if (cleanHeader.includes('|')) {
        const parts = cleanHeader.split('|').map(p => p.trim()).filter(Boolean);
        commitJob();
        currentPeriod = period;
        if (parts.length >= 2) {
          if (roleKeywordsRegex.test(parts[0])) {
            currentRole = parts[0];
            currentCompany = parts[1];
          } else {
            currentCompany = parts[0];
            currentRole = parts[1];
          }
        } else if (parts.length === 1) {
          if (roleKeywordsRegex.test(parts[0])) {
            currentRole = parts[0];
          } else {
            currentCompany = parts[0];
          }
        }
        continue;
      } else if (cleanHeader.includes('–') || cleanHeader.includes('-') || cleanHeader.includes(',')) {
        const parts = cleanHeader.split(/[–\-,]/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          commitJob();
          currentPeriod = period;
          if (roleKeywordsRegex.test(parts[0])) {
            currentRole = parts[0];
            currentCompany = parts[1];
          } else {
            currentCompany = parts[0];
            currentRole = parts[1];
          }
          continue;
        } else if (parts.length === 1) {
          commitJob();
          currentPeriod = period;
          if (roleKeywordsRegex.test(parts[0])) {
            currentRole = parts[0];
          } else {
            currentCompany = parts[0];
          }
          continue;
        }
      }
    } else if (cleanL.length > 10 && inExp) {
      if (cleanL.length > 8 && !cleanL.includes('@') && !cleanL.includes('http')) {
        currentDetails.push(cleanL);
      }
    }

    if (experience.length >= 3) {
      break;
    }
  }

  commitJob();

  // Rescate heurístico sin cabecera de sección si el texto tiene empleos con fecha y puesto/separador
  if (experience.length === 0) {
    for (let i = 0; i < rawLines.length && experience.length < 3; i++) {
      const cleanL = rawLines[i].replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
      if (cleanL.length < 10 || cleanL.length > 135) continue;
      if (/\b(universidad|instituto tecnol[oó]gico|facultad|licenciatura|ingenier[ií]a en|bachillerato)\b/i.test(cleanL) && !roleKeywordsRegex.test(cleanL)) continue;
      const pMatch = cleanL.match(dateRegex);
      if (!pMatch) continue;
      const period = pMatch[0].trim();
      const noDate = cleanL.replace(period, '').replace(/^[•*()\[\]\s\t–—,.\-|]+|[•*()\[\]\s\t–—,.\-|]+$/g, '').trim();
      if (noDate.length < 6) continue;
      const segs = noDate.split(/\t|\||•|\s+[–—-]\s+/).map(s => s.trim()).filter(Boolean).filter(s => !isLocationString(s));
      if (segs.length >= 2) {
        const r = roleKeywordsRegex.test(segs[0]) ? segs[0] : (roleKeywordsRegex.test(segs[1]) ? segs[1] : segs[0]);
        const c = r === segs[0] ? segs[1] : segs[0];
        experience.push(`${r} | ${c} | ${period}`);
      } else if (roleKeywordsRegex.test(noDate)) {
        experience.push(`${noDate} | Empresa | ${period}`);
      }
    }
    // Pares consecutivos sin fecha en el mismo renglón: Empresa en i, Puesto en i+1
    if (experience.length === 0) {
      for (let i = 0; i < rawLines.length - 1 && experience.length < 3; i++) {
        const compCand = rawLines[i].replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
        const roleCand = rawLines[i + 1].replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
        if (
          compCand.length >= 3 && compCand.length <= 55 &&
          roleCand.length >= 5 && roleCand.length <= 65 &&
          !/^[●•\-*]/.test(rawLines[i].trim()) && !/^[●•\-*]/.test(rawLines[i + 1].trim()) &&
          !compCand.includes(':') && !isLocationString(compCand) &&
          !/^(quien soy|estudios|idiomas|referencias|programas|habilidades|experiencia|educaci[oó]n|t[ií]tulo)/i.test(compCand) &&
          roleKeywordsRegex.test(roleCand) &&
          !/\b(universidad|instituto|licenciatura|ingenier[ií]a|egresado|t[ií]tulo)\b/i.test(compCand + ' ' + roleCand)
        ) {
          const item = `${roleCand} | ${compCand} | Periodo profesional`;
          if (!experience.some(e => e.toLowerCase() === item.toLowerCase())) {
            experience.push(item);
          }
          i++;
        }
      }
    }
  }

  // 3. Educación
  const education: string[] = [];
  let inEdu = false;
  const eduLines: string[] = [];

  for (const line of rawLines) {
    const l = line.toLowerCase();
    const cleanL = line.replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
    const eduHeaderSegs = line.split(/\t|\s{3,}/).map(s => s.replace(/^[•\-\*\d\.\)\s✓●:]+|[:\s]+$/g, '').trim()).filter(Boolean);
    const matchesEduHeader = eduHeaderSegs.some(seg => {
      const segLow = seg.toLowerCase();
      const segCol = segLow.replace(/\s+/g, '');
      return seg.length < 45 && (
        ['educacion', 'educación', 'estudios', 'formacionacademica', 'formaciónacadémica', 'formacion', 'formación', 'education', 'academicbackground', 'escolaridad', 'preparacionacademica', 'preparaciónacadémica'].includes(segCol) ||
        segLow.startsWith('formación académica') || segLow.startsWith('educación:')
      );
    });

    if (matchesEduHeader || (cleanL.length < 40 && ['educacion', 'educación', 'estudios', 'formacionacademica', 'formaciónacadémica', 'formacion', 'formación', 'education', 'escolaridad'].includes(cleanL.toLowerCase().replace(/\s+/g, '')))) {
      inEdu = true;
      continue;
    }
    if (inEdu && cleanL.length < 40 && /^(certificaciones|cursos|idiomas|habilidades|contacto|experiencia|referencias)\b/i.test(cleanL)) {
      break;
    }
    if (!inEdu) continue;

    if (l.startsWith('nacimiento') || l.startsWith('nacionalidad') || l.startsWith('estado civil') || l.startsWith('dirección') || l.startsWith('email') || l.startsWith('teléfono') || l.includes('of 3') || l.includes('of 2') || isJunkEduString(cleanL)) {
      continue;
    }
    const hasAcademicSignal = /\b(licenciatura|ingenier[ií]a|ingeniero|maestr[ií]a|master|mba|doctorado|t[eé]cnico|bachillerato|t[ií]tulo|certificado|universidad|instituto|tecnol[oó]gico|facultad|escuela|unam|ipn|uam|itesm|uvm|unitec|udg|uanl|buap)\b/i.test(cleanL);
    const hasWorkSignal = /\b(empresa|s\.?a\.?\s*de\s*c\.?v\.?|consultor|analista|desarrollador|gerente|actualidad|presente|tareas realizadas|monitoreo|administraci[oó]n de usuarios|solman|service\s*now)\b/i.test(cleanL) || /\t/.test(line) || /^[•●▪]/.test(line.trim());
    if ((hasWorkSignal || eduLines.length === 0) && !hasAcademicSignal) {
      continue;
    }

    if (cleanL.length > 3 && !isJunkEduString(cleanL) && eduLines.length < 4) {
      if (eduLines.length === 1 && !hasAcademicSignal && cleanL.length < 32 && !/\d{4}/.test(cleanL) && /^[a-záéíóúñ\s]+$/i.test(cleanL)) {
        eduLines[0] = `${eduLines[0]} ${cleanL}`.replace(/\s{2,}/g, ' ').trim();
      } else if (eduLines.length < 3) {
        eduLines.push(cleanL);
      }
    }
  }

  if (eduLines.length === 0) {
    let foundDeg = '';
    let foundInst = '';
    let foundPeriod = '';
    for (const line of rawLines) {
      const cleanLine = line.replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
      if (cleanLine.length < 6 || cleanLine.length > 140) continue;
      if (!foundDeg && /\b(licenciatura|ingenier[ií]a|maestr[ií]a|posgrado|bachelor|master|mba|doctorado|t[eé]cnico superior)\b/i.test(cleanLine)) {
        foundDeg = cleanLine;
        const pMatch = cleanLine.match(/\b(19\d{2}|20\d{2})(?:\s*[-–—]\s*(?:19\d{2}|20\d{2}|actual|actualidad))?\b/i);
        if (pMatch) foundPeriod = pMatch[0];
      }
      if (!foundInst && /\b(universidad|instituto tecnol[oó]gico|tecnol[oó]gico de|itesm|unam|ipn|uam|uvm|unitec|udg|uanl|buap|poli|facultad)\b/i.test(cleanLine)) {
        foundInst = cleanLine;
        const pMatch = cleanLine.match(/\b(19\d{2}|20\d{2})(?:\s*[-–—]\s*(?:19\d{2}|20\d{2}|actual|actualidad))?\b/i);
        if (pMatch && !foundPeriod) foundPeriod = pMatch[0];
      }
    }
    if (foundDeg) eduLines.push(foundDeg);
    if (foundInst && foundInst !== foundDeg) eduLines.push(foundInst);
    if (foundPeriod) eduLines.push(foundPeriod);
  }

  if (eduLines.length > 0) {
    let degree = eduLines[0];
    let inst = eduLines.length > 1 ? eduLines[1] : 'Universidad / Instituto de Educación Superior';
    let period = 'Periodo de estudios';
    if (eduLines.length >= 3 && dateRegex.test(eduLines[2])) {
      period = eduLines[2];
    }

    if (/universidad|instituto|unitec|unam|ipn|itesm|uvm|uam|tecmilenio/i.test(degree) && !/universidad|instituto|unitec|unam|ipn|itesm|uvm|uam|tecmilenio/i.test(inst)) {
      const tmp = degree;
      degree = inst;
      inst = tmp;
    }
    education.push(`${degree} | ${inst} | ${period}`);
  } else {
    education.push("Formación Profesional / Superior | Institución Educativa (por validar en entrevista) | Periodo de estudios");
  }

  // 4. Certificaciones
  const certifications: string[] = [];
  let inCert = false;

  for (const line of rawLines) {
    const cleanL = line.replace(/^[•\-\*\d\.\)\s✓]+/, '').trim();
    const l = cleanL.toLowerCase();
    if (cleanL.length < 35 && (l.includes('certifica') || l.includes('cursos') || l.includes('diplomados'))) {
      inCert = true;
      continue;
    }
    if (inCert && cleanL.length < 35 && (l.includes('habilidades') || l.includes('contacto') || l.includes('idiomas'))) {
      break;
    }
    if (!inCert) continue;

    if (cleanL.length > 5 && certifications.length < 4) {
      certifications.push(cleanL);
    }
  }

  if (certifications.length === 0) {
    certifications.push("Certificación Profesional en Tecnologías de Información y Gestión Ágil | 2024");
  }

  let finalSummary = summaryLines.join(' ').trim();
  if (finalSummary) {
    finalSummary = cleanEnginePrefix(finalSummary);
  }

  return {
    summary: finalSummary || "Profesional especialista con sólida trayectoria en gestión de proyectos y consultoría tecnológica.",
    experience: experience.length > 0 ? experience.slice(0, 3) : ["Consultor / Especialista Senior | Empresa Corporativa / Servicios TI | Periodo profesional"],
    education: education.slice(0, 3),
    certifications: certifications.slice(0, 4)
  };
}



interface CandidatePanelProps {
  vacancies: Vacancy[];
  candidates: Candidate[];
  onCandidateCreated: (candidate: Candidate) => void;
  onCandidateUpdated: (candidate: Candidate) => void;
  onCandidateDeleted?: (id: string) => void;
  onDataChanged?: () => void;
  activeRole: UserRole;
  userEmail: string;
  userArea?: string;
}

const STAGES: CandidateStage[] = [
  'CV\'s',
  'Candidatos',
  'Filtrado',
  'Entrevista Capital Humano',
  'Entrevista Líder',
  'Entrevista Cliente',
  'Pruebas Psicométricas',
  'Oferta',
  'Contratado',
  'Rechazado'
];
const COMPETENCY_KEYS: (keyof CompetencyMap)[] = [
  'Liderazgo',
  'Habilidades Técnicas',
  'Trabajo en Equipo',
  'Comunicación',
  'Resolución de Problemas'
];

function estimateFitScoreForVacancy(candidate: Candidate, vacancy: Vacancy): number {
  if (!candidate || !vacancy) return 50;
  // Evaluación estricta y real por compatibilidad de dominio, experiencia, requisitos e idiomas
  const res = calculateStrictFitScore(
    { ...candidate, fitScore: undefined, doubleCheckReport: undefined },
    vacancy
  );
  return res.fitScore;
}


export default function CandidatePanel({
  vacancies,
  candidates,
  onCandidateCreated,
  onCandidateUpdated,
  onCandidateDeleted,
  onDataChanged,
  activeRole,
  userEmail,
  userArea
}: CandidatePanelProps) {
  const [filterOnlyMyArea, setFilterOnlyMyArea] = useState<boolean>(false);
  const [showForm, setShowForm] = useState(false);
  const [formTargetVacancyId, setFormTargetVacancyId] = useState<string | undefined>(undefined);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inviteFor, setInviteFor] = useState<Candidate | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [initialBulkMode, setInitialBulkMode] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'profile' | 'fitMatrix' | 'doubleCheck' | 'speech'>('profile');
  const [isRefreshingAI, setIsRefreshingAI] = useState(false);
  const [doubleCheckAnswersText, setDoubleCheckAnswersText] = useState('');
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false);
  const [answersError, setAnswersError] = useState<string | null>(null);
  const [commentsText, setCommentsText] = useState("");
  const [feedbackOutcome, setFeedbackOutcome] = useState<'Hired' | 'Rejected' | 'Note'>('Hired');
  const [feedbackDimension, setFeedbackDimension] = useState<string>('Evaluación Técnica de Perfil');
  const [savingComments, setSavingComments] = useState(false);
  const [isRegeneratingQuestions, setIsRegeneratingQuestions] = useState(false);

  const handlePurgeTalentPool = async () => {
    const poolCands = candidates.filter(c => c.stage === 'Rechazado' || c.stage === 'Pool' || !c.vacancyId);
    if (poolCands.length === 0) {
      alert("No hay candidatos desvinculados o en el Talent Pool para eliminar.");
      return;
    }
    if (confirm(`¿Estás seguro de eliminar permanentemente a los ${poolCands.length} candidato(s) que se encuentran en el Talent Pool / Rechazados?`)) {
      try {
        const res = await authFetch('/api/candidates/purge-pool', { method: 'POST' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || body.error || `HTTP ${res.status}`);
        if (onDataChanged) onDataChanged();
        alert(`¡Se eliminaron ${body.deletedCount ?? poolCands.length} candidato(s) del Talent Pool!`);
      } catch (err: any) {
        console.error("Error al purgar candidatos del pool:", err);
        alert(`No se eliminaron los candidatos del pool: ${err?.message || err}`);
      }
    }
  };

  const [sortField, setSortField] = useState<'name' | 'vacancy' | 'channel' | 'stage' | 'fitScore' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [vacancyStatusFilter, setVacancyStatusFilter] = useState<'all' | 'Activa' | 'StandBy' | 'Cerrada'>('all');
  const [selectedVacancyFilter, setSelectedVacancyFilter] = useState<string>('all');
  const [collapsedVacancies, setCollapsedVacancies] = useState<Record<string, boolean>>({});

  const matchesVacancyStatus = (v?: Vacancy | null, statusFilter: 'all' | 'Activa' | 'StandBy' | 'Cerrada' = vacancyStatusFilter): boolean => {
    if (!v) return false;
    if (statusFilter === 'all') return true;
    const st = (v.status || 'Activa').trim();
    if (statusFilter === 'Activa') return st === 'Activa' || st === 'Open';
    if (statusFilter === 'StandBy') return st === 'StandBy';
    if (statusFilter === 'Cerrada') return st === 'Cubierta' || st === 'Closed' || st === 'Baja' || (st as string) === 'Cerrada';
    return true;
  };

  const statusFilteredVacancies = useMemo(() => {
    return vacancies.filter(v => matchesVacancyStatus(v, vacancyStatusFilter));
  }, [vacancies, vacancyStatusFilter]);

  const toggleVacancyCollapse = (vId: string) => {
    setCollapsedVacancies(prev => ({
      ...prev,
      [vId]: !prev[vId]
    }));
  };

  const collapseAllVacancies = () => {
    const next: Record<string, boolean> = {};
    groupedByVacancy.forEach(g => { next[g.vacancyId] = true; });
    setCollapsedVacancies(next);
  };

  const expandAllVacancies = () => {
    setCollapsedVacancies({});
  };

  const isUnassignedOrPoolCandidate = (c: Candidate) => c.stage === 'Pool' || !c.vacancyId || !vacancies.some(v => v.id === c.vacancyId);

  const processedCandidates = useMemo<Candidate[]>(() => {
    return candidates.map((c): Candidate => {
      const cleanName = cleanCandidateName(c.name, c.resumeText, c.email);
      const cleanChannel: Candidate['channel'] = (c.channel ? (c.channel.replace(/^(ventas\s*[\-\:\_\,]?\s*)+/i, '').trim() as Candidate['channel']) : 'Otros') || 'Otros';
      const isPoolOrUnassigned = isUnassignedOrPoolCandidate(c);
      const assignedVacancy = !isPoolOrUnassigned && c.vacancyId ? vacancies.find(v => v.id === c.vacancyId) : undefined;
      const gEval = computeGuidanceForCandidate(c, assignedVacancy);
      const strictEval = calculateStrictFitScore(c, assignedVacancy);

      const hasActualDoubleCheckAnswers = !!(
        (Array.isArray(c.screeningQuestions) && c.screeningQuestions.some(q => !!(q?.answer && q.answer.trim().length > 0))) ||
        (typeof c.doubleCheckReport === 'string' && c.doubleCheckReport.trim().length > 50 && !c.doubleCheckReport.includes('[EAS Engine Precalificación Local]')) ||
        (typeof (c as any).doubleCheckReport === 'object' && (c as any).doubleCheckReport !== null && (
          (Array.isArray((c as any).doubleCheckReport.answers) && (c as any).doubleCheckReport.answers.length > 0) ||
          ((c as any).doubleCheckReport.answers && Object.keys((c as any).doubleCheckReport.answers).length > 0) ||
          (typeof (c as any).doubleCheckReport.aiAssessment === 'string' && (c as any).doubleCheckReport.aiAssessment.length > 50)
        ))
      );

      const hasHumanFeedback = !!(
        (c.comments && c.comments.includes('[Retroalimentación')) ||
        (Array.isArray(c.history) && c.history.some(h => (h as any)?.user?.includes('Retroalimentación') || (h as any)?.details?.includes('[Retroalimentación')))
      );

      const realFitScore = (assignedVacancy && !hasActualDoubleCheckAnswers && !hasHumanFeedback)
        ? strictEval.fitScore
        : (typeof c.fitScore === 'number' && c.fitScore > 0 ? c.fitScore : strictEval.fitScore);

      const realInitialFitScore = (assignedVacancy && !hasActualDoubleCheckAnswers && !hasHumanFeedback)
        ? strictEval.initialFitScore
        : (typeof c.initialFitScore === 'number' && c.initialFitScore > 0 ? c.initialFitScore : strictEval.initialFitScore);

      let finalSummary = fixCorruptedAccents(c.summary || '');
      if (isLegacyOrClonedSummary(finalSummary, c.resumeText)) {
        finalSummary = synthesizeAnalyticalCandidateSummary({ ...c, name: cleanName }, assignedVacancy);
      }

      const dynamicCompetencies = isStaticLegacyCompetencies(c.competencies)
        ? calculateCandidateCompetencies({ ...c, name: cleanName }, assignedVacancy)
        : c.competencies;

      const hasGenericStrengths = !Array.isArray(c.strengths) || c.strengths.length === 0 ||
        c.strengths.some(s => /perfil clasificado como nivel gu[ií]a|s[oó]lido nivel de aptitudes alineadas|s[oó]lidas habilidades de comunicaci[oó]n interna|experiencia t[eé]cnica af[ií]n al puesto|s[oó]lida base t[eé]cnica y metodol[oó]gica/i.test(String(s)));

      const hasGenericGrowths = !Array.isArray(c.growths) || c.growths.length === 0 ||
        c.growths.some(g => /profundizar en habilidades espec[ií]ficas|alinear espectro salarial y expectativas|validar expectativas y disponibilidad|profundizar en herramientas espec[ií]ficas/i.test(String(g)));

      return {
        ...c,
        name: cleanName,
        summary: finalSummary,
        competencies: dynamicCompetencies,
        suggestedTime: '',
        channel: cleanChannel,
        fitScore: realFitScore,
        initialFitScore: realInitialFitScore,
        strengths: (strictEval.hasDomainMismatch || assignedVacancy || hasGenericStrengths)
          ? strictEval.strengths.map(fixCorruptedAccents)
          : c.strengths.map(fixCorruptedAccents),
        growths: (strictEval.hasDomainMismatch || assignedVacancy || hasGenericGrowths)
          ? strictEval.growths.map(fixCorruptedAccents)
          : c.growths.map(fixCorruptedAccents),
        guidanceAlert: assignedVacancy ? (strictEval.hasDomainMismatch ? true : gEval.guidanceAlert) : false,
        detectedGuidanceLevel: gEval.detectedGuidanceLevel,
        guidanceGapDetails: strictEval.hasDomainMismatch
          ? (strictEval.mismatchReason || 'INCOMPATIBILIDAD CRÍTICA DE PROFESIÓN: La formación o profesión del candidato no es acorde con la vacante solicitada.')
          : gEval.guidanceGapDetails
      };
    });
  }, [candidates, vacancies]);

  const effectiveArea = userArea || 'Dirección General & Gobernanza';

  const filteredCandidates = useMemo(() => {
    let list = processedCandidates;
    if (vacancyStatusFilter !== 'all') {
      list = list.filter(c => {
        if (isUnassignedOrPoolCandidate(c)) return false;
        const v = vacancies.find(vac => vac.id === c.vacancyId);
        return matchesVacancyStatus(v, vacancyStatusFilter);
      });
    }
    if (selectedVacancyFilter === 'unassigned') {
      list = list.filter(c => isUnassignedOrPoolCandidate(c));
    } else if (selectedVacancyFilter !== 'all') {
      list = list.filter(c => c.vacancyId === selectedVacancyFilter && c.stage !== 'Pool');
    }
    if (filterOnlyMyArea && effectiveArea) {
      const targetArea = effectiveArea.toLowerCase().trim();
      const isDirector = targetArea.includes('dirección') || targetArea.includes('gobernanza') || targetArea.includes('admin');
      list = list.filter(c => {
        const v = vacancies.find(vac => vac.id === c.vacancyId);
        if (!v) return false;
        const vDept = (v.department || '').toLowerCase().trim();
        if (isDirector) return vDept.includes('geradva') || vDept.includes('proman') || vDept.includes('comercial') || vDept.includes('otcpro') || vDept.includes('dirección') || vDept.includes('gobernanza') || targetArea.includes(vDept);
        return vDept.includes(targetArea) || targetArea.includes(vDept);
      });
    }
    return list;
  }, [processedCandidates, vacancyStatusFilter, selectedVacancyFilter, filterOnlyMyArea, effectiveArea, vacancies]);

  const sortedCandidates = useMemo(() => {
    if (!sortField) return filteredCandidates;
    return [...filteredCandidates].sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';
      if (sortField === 'name') {
        aVal = (a?.name || '').toLowerCase();
        bVal = (b?.name || '').toLowerCase();
      } else if (sortField === 'vacancy') {
        aVal = (vacancies.find(v => v.id === a?.vacancyId)?.title || '').toLowerCase();
        bVal = (vacancies.find(v => v.id === b?.vacancyId)?.title || '').toLowerCase();
      } else if (sortField === 'channel') {
        aVal = (a?.channel || '').toLowerCase();
        bVal = (b?.channel || '').toLowerCase();
      } else if (sortField === 'stage') {
        aVal = (a?.stage || '').toLowerCase();
        bVal = (b?.stage || '').toLowerCase();
      } else if (sortField === 'fitScore') {
        aVal = a?.fitScore ?? 0;
        bVal = b?.fitScore ?? 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCandidates, sortField, sortDirection, vacancies]);

  const toggleSort = (field: 'name' | 'vacancy' | 'channel' | 'stage' | 'fitScore') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    setCommentsText("");
  }, [selectedId]);

  // Las 3 preguntas de experiencia del candidato: las guardadas en BD o, si no hay, las del motor
  // (semilla = id del candidato, así se ven igual en cada apertura hasta que se regeneren).
  const experienceQuestionsFor = (cand: Candidate, vac?: Vacancy): string[] => {
    const qVac = { title: vac?.title || cand.role, department: vac?.department, requirements: vac?.requirements || [] };
    const storedAll = cand.screeningQuestions || [];
    const hasAnswers = storedAll.some(q => q?.answer && String(q.answer).trim().length > 0);
    const stored = storedAll
      .map(q => q?.question)
      .filter((q): q is string => !!q && !FIXED_AVAILABILITY_QUESTIONS.includes(q));
    if (stored.length >= 3 && (hasAnswers || !vac || stored.every(q => isQuestionRelevant(q, qVac)))) {
      return stored.slice(0, 3);
    }
    return generateExperienceQuestions(
      qVac,
      {
        name: cand.name,
        resumeText: cand.resumeText,
        summary: cand.summary,
        experience: cand.experience || [],
        education: cand.education || [],
        certifications: cand.certifications || []
      },
      { seed: cand.id }
    );
  };
  const answerFor = (cand: Candidate, question: string): string | undefined =>
    (cand.screeningQuestions || []).find(q => q?.question === question)?.answer;

  // Guarda un cambio de candidato en el servidor. Aplica el cambio de forma optimista y, si el
  // servidor lo rechaza, lo REVIERTE y avisa. (Antes todos los errores se ignoraban: el cambio se
  // veía en pantalla pero nunca llegaba a la base de datos.)
  const persistCandidateChange = async (
    original: Candidate,
    patch: Partial<Candidate> & { forceRegenerate?: boolean },
    optimistic?: Candidate
  ): Promise<Candidate | null> => {
    if (optimistic) onCandidateUpdated(optimistic);
    try {
      const res = await api.updateCandidate(original.id, patch);
      const merged = { ...(optimistic || original), ...(res?.candidate || {}) } as Candidate;
      onCandidateUpdated(merged);
      return merged;
    } catch (err: any) {
      onCandidateUpdated(original);
      alert(`⚠️ El cambio NO se guardó en el servidor: ${err?.message || err}`);
      return null;
    }
  };

  const handleSaveComments = async () => {
    if (!selected) return;
    const cleanComments = commentsText.trim();
    if (!cleanComments || cleanComments.length < 10) {
      alert('Por favor ingresa una justificación de al menos 10 caracteres con la evidencia observable para calificar al candidato.');
      return;
    }
    setSavingComments(true);
    try {
      const explicitDelta = feedbackOutcome === 'Hired' ? 8 : feedbackOutcome === 'Rejected' ? -10 : 0;
      const fbRes = await api.submitFeedback(
        selected.id,
        feedbackOutcome,
        cleanComments,
        cleanComments,
        undefined,
        feedbackDimension,
        explicitDelta,
        false
      ).catch((e) => {
        console.warn("Error enviando feedback:", e);
        return null;
      });

      if (fbRes?.candidate) {
        onCandidateUpdated(fbRes.candidate);
        setCommentsText('');
        const delta = (fbRes.boostApplied !== undefined) ? fbRes.boostApplied : (fbRes.newScore ? fbRes.newScore - selected.fitScore : 0);
        const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
        if (feedbackOutcome === 'Note') {
          alert('Nota informativa registrada exitosamente sin modificar el score.');
        } else {
          alert(`Evaluación heurística guardada exitosamente.\n\n• Dimensión: ${feedbackDimension}\n• Dictamen: ${feedbackOutcome === 'Hired' ? 'Favorable (+8 pts)' : 'Brecha Crítica (-10 pts)'}\n• Score actualizado: ${fbRes.newScore ?? fbRes.candidate.fitScore}% (${deltaStr} pts).`);
        }
      } else {
        alert('No se pudo sincronizar la evaluación con el servidor. Revisa tu conexión.');
      }
    } finally {
      setSavingComments(false);
    }
  };

  const handleRevertEvaluationNote = async (noteId: string) => {
    if (!selected) return;
    setSavingComments(true);
    try {
      const res = await api.revertEvaluationNote(selected.id, noteId);
      if (res?.candidate) {
        onCandidateUpdated(res.candidate);
      }
    } catch (err: any) {
      alert(`No se pudo revertir el ajuste: ${err?.message || err}`);
    } finally {
      setSavingComments(false);
    }
  };

  // Evalúa las respuestas pegadas del correo del candidato. La evaluación es 100% del servidor
  // (rúbrica crítica). Antes: si una pregunta no se identificaba se inventaba la respuesta
  // "Respuesta registrada para validación técnica.", y si el servidor fallaba se aplicaba un
  // "motor local" que sumaba puntos por palabras sueltas.
  const handleDoubleCheckSubmit = async (candidate: Candidate) => {
    if (!doubleCheckAnswersText.trim()) return;
    setIsSubmittingAnswers(true);
    setAnswersError(null);
    try {
      const vac = vacancies.find(v => v.id === candidate.vacancyId);
      const questionTexts = [...experienceQuestionsFor(candidate, vac), ...FIXED_AVAILABILITY_QUESTIONS];
      const body = await api.submitScreening({
        candidate,
        name: candidate.name,
        role: vac?.title || candidate.role || 'la vacante',
        resumeText: candidate.resumeText || candidate.summary || '',
        vacancy: vac,
        questions: questionTexts,
        rawText: doubleCheckAnswersText,
        comments: candidate.comments || ''
      });

      const baseScore = typeof body.cvBaseScore === 'number'
        ? body.cvBaseScore
        : (typeof candidate.cvBaseScore === 'number' ? candidate.cvBaseScore : (typeof candidate.initialFitScore === 'number' ? candidate.initialFitScore : candidate.fitScore));
      const patch: Partial<Candidate> = {
        fitScore: body.fitScore,
        initialFitScore: baseScore,
        cvBaseScore: baseScore,
        doubleCheckDelta: typeof body.doubleCheckDelta === 'number' ? body.doubleCheckDelta : (body.fitScore - baseScore),
        fitScoreBreakdown: body.fitScoreBreakdown,
        doubleCheckReport: body.doubleCheckReport,
        growths: body.growths,
        interviewSpeech: body.interviewSpeech,
        screeningQuestions: body.screeningQuestions
      };
      const saved = await persistCandidateChange(candidate, patch, { ...candidate, ...patch });
      if (!saved) return; // el helper ya revirtió y avisó; se conservan las respuestas escritas
      setDoubleCheckAnswersText('');
      alert(`Double-Check: ${body.verdict}\nCalidad de respuestas: ${body.quality}/100\nEncaje: ${baseScore}% → ${body.fitScore}%\n\nEl dictamen completo quedó en "Perfil General".`);
    } catch (err: any) {
      console.error("Error al procesar Double-Check:", err);
      setAnswersError(err?.message || 'No se pudo evaluar el Double-Check.');
    } finally {
      setIsSubmittingAnswers(false);
    }
  };

  const handleExportCv = (candidate: Candidate) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const selectedVacancy = vacancies.find(v => v.id === candidate.vacancyId);

    const comps = candidate.competencies || { 'Liderazgo': 75, 'Comunicación': 80, 'Trabajo en Equipo': 80, 'Habilidades Técnicas': 75, 'Resolución de Problemas': 75 };
    const competenciesHtml = Object.entries(comps)
      .map(([name, score]) => `
        <div class="competency-item">
          <div class="competency-header">
            <span>${escapeHtml(String(name))}</span>
            <strong>${Number(score) || 0}/100</strong>
          </div>
          <div class="competency-bar-track">
            <div class="competency-bar-fill" style="width: ${Math.max(0, Math.min(100, Number(score) || 0))}%"></div>
          </div>
        </div>
      `).join('');

    // Todo dato de candidato se escapa: viene de CVs y del portal público (XSS almacenado vía document.write).
    const strengthsHtml = (candidate.strengths || []).slice(0, 3).map(s => `<li>${escapeHtml(String(s))}</li>`).join('');
    const growthsHtml = (candidate.growths || []).slice(0, 3).map(g => `<li>${escapeHtml(String(g))}</li>`).join('');

    let doubleCheckSection = '';
    const hasReport = !!candidate.doubleCheckReport;
    const answeredQs = (candidate.screeningQuestions || []).filter(q => !!q.answer && q.answer.trim().length > 0);
    const hasAnsweredQuestions = answeredQs.length > 0;

    if (hasReport || hasAnsweredQuestions) {
      const questionsListHtml = answeredQs
        .map((q, idx) => `
          <div style="margin-bottom: 2.5px; padding: 3px 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; page-break-inside: avoid;">
            <div style="color: #1e1b4b; font-size: 9.5px; font-weight: bold;">Pregunta ${idx + 1}: ${escapeHtml(String(q.question || ''))}</div>
            <div style="color: #047857; margin-top: 1px; font-size: 9px; padding-left: 6px; border-left: 2px solid #10b981; font-style: italic;">
              <strong>Respuesta:</strong> ${escapeHtml(String(q.answer || ''))}
            </div>
          </div>
        `).join('');

      doubleCheckSection = `
        <div class="section-title" style="margin-top: 4px;">Análisis de Coherencia & Cuestionario de Doble Validación (Double-Check)</div>
        ${hasReport ? `
          <div class="card font-sans" style="font-size: 10px; line-height: 1.3; color: #374151; white-space: pre-line; margin-bottom: 4px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 4px 8px; border-radius: 4px;">
            <strong style="color: #166534; font-size: 9.5px; display: block; margin-bottom: 2px;">📌 Dictamen del Análisis de Coherencia:</strong>
            ${escapeHtml(cleanEnginePrefix(candidate.doubleCheckReport))}
          </div>
        ` : ''}
        ${answeredQs.length > 0 ? `
          <div style="font-size: 9.5px; font-weight: bold; color: #4338ca; margin: 4px 0 2px; text-transform: uppercase;">
            📋 Preguntas y Respuestas del Doble Check (${answeredQs.length} Preguntas Contestadas):
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            ${questionsListHtml}
          </div>
        ` : ''}
      `;
    }

    const cvExtracted = extractCvSectionsFromText(candidate.resumeText || '');
    const candSummaryClean = cleanEnginePrefix(candidate.summary);
    const effectiveSummary = (candSummaryClean && candSummaryClean.length > 40 && !candSummaryClean.toLowerCase().startsWith('perfil profesional no'))
      ? candSummaryClean
      : (cvExtracted.summary || candSummaryClean || "Profesional especialista con sólida trayectoria en gestión de proyectos y consultoría tecnológica.");
    const fullExperience = (Array.isArray(candidate.experience) && candidate.experience.length > 0) ? candidate.experience : cvExtracted.experience;
    const activeExperience = normalizeCanonicalExperience(fullExperience);

    const activeEducationRaw = (Array.isArray(candidate.education) && candidate.education.length > 0) ? candidate.education : cvExtracted.education;
    let activeEducation = normalizeCanonicalEducation(activeEducationRaw);
    if (activeEducation.length === 0 && candidate.resumeText) {
      const fallback = extractCvSectionsFromText(candidate.resumeText);
      activeEducation = normalizeCanonicalEducation(fallback.education);
    }

    const activeCertificationsRaw = (Array.isArray(candidate.certifications) && candidate.certifications.length > 0) ? candidate.certifications : cvExtracted.certifications;
    const activeCertifications = normalizeCanonicalCertifications(activeCertificationsRaw);

    const formatJobItemPdf = (expStr: string) => {
      const item = formatWorkExperienceItem(expStr);
      let html = `<strong>Dónde trabajó (Empresa):</strong> ${escapeHtml(item.company)} &nbsp;|&nbsp; <strong>Puesto ocupado:</strong> ${escapeHtml(item.position)} &nbsp;|&nbsp; <strong>Periodo:</strong> ${escapeHtml(item.period)}`;
      if (item.details) {
        html += `<br/><span style="font-size: 8.5px; color: #374151; padding-left: 8px;">&bull; <strong>Responsabilidades/Logros:</strong> ${escapeHtml(stripBulletPoints(item.details))}</span>`;
      }
      return html;
    };

    const formatEduItemPdf = (eduStr: string) => {
      const item = formatEducationItem(eduStr);
      return `<strong>Dónde estudió (Institución):</strong> ${escapeHtml(item.institution)} &nbsp;|&nbsp; <strong>Qué estudió (Carrera/Grado):</strong> ${escapeHtml(item.degree)} &nbsp;|&nbsp; <strong>Periodo:</strong> ${escapeHtml(item.period)}`;
    };

    const expList = activeExperience.length > 0
      ? activeExperience.map(exp => `<li style="margin-bottom: 2px;">${formatJobItemPdf(exp)}</li>`).join('')
      : `<li style="margin-bottom: 2px; color: #6b7280; font-style: italic;">No registrada en el CV</li>`;

    const eduList = activeEducation.length > 0
      ? activeEducation.map(edu => `<li style="margin-bottom: 2px;">${formatEduItemPdf(edu)}</li>`).join('')
      : `<li style="margin-bottom: 2px; color: #6b7280; font-style: italic;">No registrada en el CV</li>`;

    const certList = activeCertifications.length > 0
      ? activeCertifications.map(cert => `<li style="margin-bottom: 2px;">${escapeHtml(stripBulletPoints(cert))}</li>`).join('')
      : `<li style="margin-bottom: 2px; color: #6b7280; font-style: italic;">No especificadas en el CV</li>`;

    const fitScoreBadge = candidate.initialFitScore && candidate.initialFitScore !== candidate.fitScore
      ? `Ajuste CV: ${Number(candidate.initialFitScore) || 0}% &rarr; Validado: ${Number(candidate.fitScore) || 0}%`
      : `Ajuste Global: ${Number(candidate.fitScore) || 0}%`;

    const cleanCandName = cleanCandidateName(candidate.name, candidate.resumeText, candidate.email);
    printWindow.document.write(`
      <html>
        <head>
          <title>CV EAS Consulting - ${escapeHtml(cleanCandName)}</title>
          <style>
            @page {
              size: letter;
              margin: 0.25in;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                zoom: 0.77;
              }
              .competency-item, .card, .section-title {
                page-break-inside: avoid;
                break-inside: avoid;
              }
            }
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; margin: 0px 8px; font-size: 10.5px; line-height: 1.3; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #4f46e5; padding-bottom: 4px; margin-bottom: 6px; }
            .logo-title { font-size: 16px; font-weight: bold; color: #1e1b4b; }
            .badge-score { background: #e0e7ff; color: #4338ca; font-weight: bold; padding: 3px 8px; border-radius: 5px; font-size: 11px; }
            .candidate-info { margin-bottom: 6px; font-size: 10.5px; line-height: 1.25; }
            .section-title { font-size: 11px; font-weight: bold; color: #4338ca; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; margin: 6px 0 3px; }
            .competency-item { margin-bottom: 4px; font-size: 10px; }
            .competency-header { display: flex; justify-content: space-between; margin-bottom: 1px; font-weight: bold; }
            .competency-bar-track { background: #f3f4f6; height: 4px; border-radius: 2px; overflow: hidden; }
            .competency-bar-fill { background: #4f46e5; height: 100%; border-radius: 2px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .card { background: #f9fafb; border: 1px solid #f3f4f6; padding: 4px 6px; border-radius: 5px; }
            ul { padding-left: 12px; font-size: 10px; line-height: 1.25; margin: 2px 0; }
            li { margin-bottom: 1.5px; }
            .footer { text-align: center; font-size: 8.5px; color: #9ca3af; margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${window.location.origin + logoUrl}" alt="EAS Consulting" style="height: 32px; width: auto; object-fit: contain;" />
              <div>
                <div class="logo-title">EAS Consulting</div>
                <div style="font-size: 9px; color: #4f46e5; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1px;">Talent Assessment & Validation Report</div>
              </div>
            </div>
            <div class="badge-score">${fitScoreBadge}</div>
          </div>
          
          <div class="candidate-info">
            <h1 style="margin: 0 0 2px; color: #111827; font-size: 16px;">${escapeHtml(cleanCandName)}</h1>
            <p style="margin: 0; font-weight: bold; color: #4b5563; font-size: 12px;">${escapeHtml(selectedVacancy?.title || 'Candidato')} &nbsp;|&nbsp; <span style="font-size: 10.5px; color: #4f46e5;">Seniority: ${escapeHtml(candidate.detectedGuidanceLevel || 'Consultor / Especialista')}</span></p>
            <p style="margin: 2px 0 0; color: #4b5563; font-size: 10px;">
              <strong>Correo:</strong> ${escapeHtml(candidate.email)} &nbsp;|&nbsp; 
              <strong>Teléfono:</strong> ${escapeHtml(candidate.phone)} &nbsp;|&nbsp; 
              <strong>Canal:</strong> ${escapeHtml(candidate.channel)} &nbsp;|&nbsp; 
              <strong>Inglés:</strong> ${escapeHtml(candidate.englishLevel || 'Medio')} &nbsp;|&nbsp; 
              <strong>Pretensión:</strong> ${candidate.expectedSalary ? `$${Number(candidate.expectedSalary).toLocaleString('es-MX')} MXN` : 'A negociar'}
            </p>
          </div>
          
          <div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 4px; width: 100%;">
            <div style="width: 58%; min-width: 0; display: flex; flex-direction: column;">
              <div class="section-title" style="margin-top: 0;">Perfil Deducido del CV</div>
              <p style="font-size: 10px; line-height: 1.3; color: #374151; margin: 0 0 4px; text-align: justify;">${escapeHtml(effectiveSummary)}</p>
              
              <div class="section-title">Experiencia Laboral / 3 Últimos Empleos</div>
              <ul style="margin: 2px 0 0; padding-left: 14px; font-size: 10px; color: #374151;">
                ${expList}
              </ul>
              
              <div class="section-title">Educación & Grados Académicos</div>
              <ul style="margin: 2px 0 0; padding-left: 14px; font-size: 10px; color: #374151;">
                ${eduList}
              </ul>
              
              <div class="section-title">Certificaciones & Cursos</div>
              <ul style="margin: 2px 0 0; padding-left: 14px; font-size: 10px; color: #374151;">
                ${certList}
              </ul>
            </div>

            
            <div style="width: 38%; min-width: 0; display: flex; flex-direction: column;">
              <div class="section-title" style="margin-top: 0;">Evaluación de Competencias</div>
              ${competenciesHtml}
              
              <div class="section-title">Fortalezas y Oportunidades</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div class="card" style="border-left: 3px solid #10b981; padding: 4px 6px;">
                  <strong style="color: #047857; font-size: 9.5px; display: block; margin-bottom: 1px;">Fortalezas</strong>
                  <ul style="margin: 0; padding-left: 10px; font-size: 9.5px; line-height: 1.2;">${strengthsHtml}</ul>
                </div>
                <div class="card" style="border-left: 3px solid #f59e0b; padding: 4px 6px;">
                  <strong style="color: #b45309; font-size: 9.5px; display: block; margin-bottom: 1px;">Áreas de Oportunidad</strong>
                  <ul style="margin: 0; padding-left: 10px; font-size: 9.5px; line-height: 1.2;">${growthsHtml}</ul>
                </div>
              </div>
            </div>
          </div>
          
          ${doubleCheckSection}
          
          ${candidate.comments ? `
            <div class="section-title" style="margin-top: 6px;">Historial de Notas & Retroalimentación del Evaluador</div>
            <div class="card" style="font-size: 9.5px; line-height: 1.35; color: #1e293b; background: #f8fafc; border: 1px solid #cbd5e1; padding: 5px 8px; border-radius: 4px; white-space: pre-line;">
              ${escapeHtml(candidate.comments)}
            </div>
          ` : ''}
          
          <div class="footer" style="margin-top: 10px; padding-top: 4px;">
            EAS Consulting &copy; ${new Date().getFullYear()} - Reporte de Ajuste de Candidatos Automatizado
          </div>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };



  const groupedByVacancy = useMemo(() => {
    const vacancyMap = new Map<string, {
      vacancyId: string;
      vacancyTitle: string;
      department?: string;
      status?: string;
      candidates: Candidate[];
      stages: Record<CandidateStage, Candidate[]>;
    }>();

    statusFilteredVacancies.forEach(v => {
      if (selectedVacancyFilter !== 'all' && selectedVacancyFilter !== 'unassigned' && selectedVacancyFilter !== v.id) {
        return;
      }
      const initialStages: Record<CandidateStage, Candidate[]> = {
        'CV\'s': [],
        'Candidatos': [],
        'Filtrado': [],
        'Entrevista Capital Humano': [],
        'Entrevista Líder': [],
        'Entrevista Cliente': [],
        'Pruebas Psicométricas': [],
        'Oferta': [],
        'Contratado': [],
        'Rechazado': []
      };
      vacancyMap.set(v.id, {
        vacancyId: v.id,
        vacancyTitle: v.title,
        department: v.department || 'Operaciones',
        status: v.status || 'Abierta',
        candidates: [],
        stages: initialStages
      });
    });

    if (vacancyStatusFilter === 'all' && (selectedVacancyFilter === 'all' || selectedVacancyFilter === 'unassigned')) {
      const initialUnassignedStages: Record<CandidateStage, Candidate[]> = {
        'CV\'s': [],
        'Candidatos': [],
        'Filtrado': [],
        'Entrevista Capital Humano': [],
        'Entrevista Líder': [],
        'Entrevista Cliente': [],
        'Pruebas Psicométricas': [],
        'Oferta': [],
        'Contratado': [],
        'Rechazado': []
      };
      vacancyMap.set('unassigned', {
        vacancyId: 'unassigned',
        vacancyTitle: '⭐ Talent Pool — Candidatos Sin Asignación de Vacante',
        department: 'General',
        status: 'Activo',
        candidates: [],
        stages: initialUnassignedStages
      });
    }

    for (const c of filteredCandidates) {
      let vId = (!isUnassignedOrPoolCandidate(c) && c.vacancyId && vacancyMap.has(c.vacancyId)) ? c.vacancyId : 'unassigned';
      if (!vacancyMap.has(vId)) {
        if (vacancyStatusFilter === 'all' && selectedVacancyFilter === 'all' && vacancyMap.has('unassigned')) vId = 'unassigned';
        else continue;
      }

      let stageKey: CandidateStage = 'CV\'s';
      const clean = c.stage ? c.stage.toLowerCase().trim() : '';
      if (clean === 'cv\'s' || clean === 'cvs' || clean === 'cv' || clean === 'screening' || clean === 'application' || clean === 'filtrado') stageKey = 'CV\'s';
      else if (clean === 'candidatos' || clean === 'candidato') stageKey = 'Candidatos';
      else if (clean === 'interview' || clean === 'entrevista capital humano' || clean === 'entrevista') stageKey = 'Entrevista Capital Humano';
      else if (clean === 'entrevista líder' || clean === 'entrevista lider') stageKey = 'Entrevista Líder';
      else if (clean === 'entrevista cliente') stageKey = 'Entrevista Cliente';
      else if (clean === 'pruebas psicométricas' || clean === 'pruebas psicometricas' || clean === 'test') stageKey = 'Pruebas Psicométricas';
      else if (clean === 'offer' || clean === 'oferta') stageKey = 'Oferta';
      else if (clean === 'hired' || clean === 'contratado') stageKey = 'Contratado';
      else if (clean === 'rejected' || clean === 'rechazado') stageKey = 'Rechazado';

      const entry = vacancyMap.get(vId);
      if (entry) {
        entry.candidates.push(c);
        if (!entry.stages[stageKey]) {
          entry.stages[stageKey] = [];
        }
        entry.stages[stageKey].push(c);
      }
    }

    vacancyMap.forEach((entry) => {
      for (const stage of STAGES) {
        if (entry.stages[stage] && Array.isArray(entry.stages[stage])) {
          entry.stages[stage].sort((a, b) => (b?.fitScore ?? 0) - (a?.fitScore ?? 0));
        }
      }
    });

    return Array.from(vacancyMap.values()).filter(group => {
      if (group.vacancyId === 'unassigned' && group.candidates.length === 0) return false;
      return true;
    });
  }, [filteredCandidates, vacancies, selectedVacancyFilter]);

  const selected = processedCandidates.find((c) => c.id === selectedId) ?? null;
  const selectedVacancy = (selected && selected.stage !== 'Pool' && selected.vacancyId) ? vacancies.find((v) => v.id === selected.vacancyId) : undefined;

  async function moveStage(candidate: Candidate, stage: CandidateStage | 'Pool') {
    try {
      const userName = localStorage.getItem('eas_user_name') || userEmail || activeRole;
      const historyItem = {
        timestamp: new Date().toISOString(),
        stage,
        user: `${userName} (${activeRole})`
      };

      const newVacId = stage === 'Pool' ? '' : candidate.vacancyId;

      const updated = {
        ...candidate,
        stage,
        vacancyId: newVacId,
        history: [...(candidate.history || []), historyItem]
      };
      onCandidateUpdated(updated);
      const res = await api.setCandidateStage(candidate.id, stage, newVacId);
      if (res?.candidate) onCandidateUpdated({ ...updated, ...res.candidate });
      recordAuditLog('CAMBIO_ETAPA_CANDIDATO', 'Candidatos', 'SUCCESS', `Candidato ${candidate.name} movido a la etapa "${stage}".`);
    } catch (err: any) {
      console.error("Error al mover candidato de etapa:", err);
      onCandidateUpdated(candidate);
      alert(`⚠️ No se guardó el cambio de etapa de ${candidate.name}: ${err?.message || err}`);
    }
  }

  async function handleFeedback(candidate: Candidate, outcome: 'Hired' | 'Rejected') {
    const defaultComment = outcome === 'Hired'
      ? 'Demostró sólida experiencia técnica y aptitud profesional excelente durante la evaluación.'
      : 'No se adecúa al perfil requerido para la vacante.';

    const userComments = window.prompt(
      `Retroalimentación de Contratación para ${candidate.name} (${outcome === 'Hired' ? 'Contratar' : 'Rechazar'}):\n\nIngresa los comentarios ejecutivos. Los comentarios positivos contribuirán a incrementar el score del candidato:`,
      defaultComment
    );

    if (userComments === null) return; // Usuario canceló la operación

    setFeedbackBusy(true);
    try {
      const userName = localStorage.getItem('eas_user_name') || userEmail || activeRole;
      const historyItem = {
        timestamp: new Date().toISOString(),
        stage: outcome === 'Hired' ? 'Contratado' : 'Rechazado',
        user: `${userName} (${activeRole})`,
        details: `Retroalimentación: ${userComments}`
      };

      const updated = {
        ...candidate,
        stage: outcome === 'Hired' ? 'Contratado' : 'Rechazado',
        comments: candidate.comments ? `${candidate.comments}\n[Retroalimentación] ${userComments}` : `[Retroalimentación] ${userComments}`,
        history: [...(candidate.history || []), historyItem]
      };
      onCandidateUpdated(updated);

      try {
        const res = await api.setCandidateStage(candidate.id, updated.stage as CandidateStage);
        if (res?.candidate) onCandidateUpdated({ ...updated, ...res.candidate });
      } catch (err: any) {
        onCandidateUpdated(candidate);
        alert(`⚠️ No se guardó la decisión para ${candidate.name}: ${err?.message || err}`);
        return;
      }

      const fbRes = await api.submitFeedback(candidate.id, outcome, userComments, userComments, undefined, 'Dictamen Final', outcome === 'Hired' ? 8 : -10, true).catch((e) => {
        console.warn("Feedback de aprendizaje no registrado:", e);
        return null;
      });

      if (fbRes && fbRes.candidate) {
        onCandidateUpdated(fbRes.candidate);
        if (fbRes.newScore) {
          alert(`✅ Retroalimentación registrada exitosamente. Score actualizado a ${fbRes.newScore}% (+${fbRes.boostApplied || 0} pts).`);
        }
      }
    } finally {
      setFeedbackBusy(false);
    }
  }

  const handleExportAllCandidatesCsv = () => {
    const headers = [
      "ID",
      "Nombre Candidato",
      "Email",
      "Teléfono",
      "Vacante Asignada",
      "Etapa Actual",
      "Canal de Origen",
      "Fit Score (%)",
      "Nivel de Inglés",
      "Experiencia Laboral - 3 Últimos Empleos (Empresa, Posición y Periodo)",
      "Educación / Grados Académicos",
      "Certificaciones & Cursos",
      "Fortalezas Principales",
      "Áreas de Oportunidad",
      "Dictamen Double-Check",
      "Preguntas & Respuestas Double-Check",
      "Comentarios / Notas Evaluador",
      "Fecha de Registro"
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      // Neutraliza inyección de fórmulas en Excel (datos que vienen de CVs / portal público).
      if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = filteredCandidates.map((c) => {
      const vacancy = vacancies.find(v => v.id === c.vacancyId);
      const cvExtracted = extractCvSectionsFromText(c.resumeText || '');

      const fullExp = (Array.isArray(c.experience) && c.experience.length > 0) ? c.experience : cvExtracted.experience;
      const expText = fullExp.slice(0, 3).map(expStr => {
        const parts = String(expStr || '').split('|').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 3) {
          return `Empresa: ${parts[1]} / Posición: ${parts[0]} / Periodo: ${parts[2]}`;
        } else if (parts.length === 2) {
          return `Empresa / Posición: ${parts[0]} / Periodo: ${parts[1]}`;
        }
        return String(expStr || '');
      }).join(' ; ');
      const eduText = (Array.isArray(c.education) && c.education.length > 0) ? c.education.join(' | ') : cvExtracted.education.join(' | ');
      const certText = (Array.isArray(c.certifications) && c.certifications.length > 0) ? c.certifications.join(' | ') : cvExtracted.certifications.join(' | ');

      const screeningQsText = (c.screeningQuestions || [])
        .map((q, idx) => `[P${idx + 1}: ${q.question} => Resp: ${q.answer || 'Pendiente'}]`)
        .join(' ; ');

      return [
        escapeCsv(c.id),
        escapeCsv(c.name),
        escapeCsv(c.email),
        escapeCsv(c.phone),
        escapeCsv(vacancy?.title || 'Sin vacante asignada'),
        escapeCsv(c.stage),
        escapeCsv(c.channel),
        escapeCsv(c.fitScore),
        escapeCsv(c.englishLevel || 'Medio'),
        escapeCsv(expText),
        escapeCsv(eduText),
        escapeCsv(certText),
        escapeCsv((c.strengths || []).join(' | ')),
        escapeCsv((c.growths || []).join(' | ')),
        escapeCsv(c.doubleCheckReport || 'Sin dictamen'),
        escapeCsv(screeningQsText || 'Sin preguntas'),
        escapeCsv(c.comments || ''),
        escapeCsv(c.createdAt ? new Date(c.createdAt).toLocaleDateString('es-ES') : '')
      ].join(',');
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `EAS_Reporte_Candidatos_Completo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in">
      {/* Top Header & Control Menu - Dynamic Scrolling Header */}
      <div
        className="bg-[#f8fafc] transition-all pt-4 pb-4 mb-6 border-b border-slate-200 shadow-sm -mx-4 sm:-mx-6 lg:-mx-12 px-4 sm:px-6 lg:px-12"
      >
        <div className="view-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div>
            <p className="view-eyebrow">Atracción, Selección & Fidelización de Talento</p>
            <h1 className="view-title text-xl sm:text-2xl font-bold">Pipeline de Selección — EAS TalentCore AI</h1>
            <p className="view-subtitle text-xs text-slate-500">Optimiza tiempos de preselección, elimina candidatos perdidos en el Talent Pool y cumple con la protección de datos personales.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div style={{ display: 'inline-flex', backgroundColor: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                className={`btn ${viewMode === 'kanban' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6 }}
                onClick={() => setViewMode('kanban')}
              >
                Tablero Kanban
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6 }}
                onClick={() => setViewMode('list')}
              >
                Lista Detallada
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { setFormTargetVacancyId(undefined); setInitialBulkMode(false); setShowForm(true); }}
            >
              <Plus size={16} /> Analizar candidato
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { setFormTargetVacancyId(undefined); setInitialBulkMode(true); setShowForm(true); }}
              style={{ marginLeft: 8 }}
            >
              <UploadCloud size={16} style={{ marginRight: 4, verticalAlign: -3 }} /> Carga Masiva
            </button>
          </div>
        </div>

        {/* EAS TalentCore AI Floating Smart Banner */}
        <div style={{
          padding: '10px 18px',
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          color: '#ffffff',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          boxShadow: '0 4px 14px rgba(99,102,241,0.25)',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} color="#fff" />
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                EAS Multi-AI Ensemble Engine™ Active (Gemini + Claude + GPT-4o)
              </span>
              <p style={{ margin: 0, fontSize: 11.5, opacity: 0.95 }}>
                Junta Evaluadora Multi-IA por Consenso: Gemini 2.0 (Parsing) + Anthropic Claude 3.5 (Auditoría) + OpenAI GPT-4o (Hard Skills).
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 'bold' }}>
              {candidates.length} Candidatos En Pipeline
            </span>
            <span style={{ backgroundColor: '#10b981', color: '#ffffff', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 'bold' }}>
              🛡️ Protección Datos Activa
            </span>
          </div>
        </div>

        {/* Vacancy Filter Bar & Grouping Status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: '10px 16px',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          marginBottom: 8,
          gap: 16,
          flexWrap: 'wrap',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155', fontSize: 12, fontWeight: 700 }}>
              <Briefcase size={16} style={{ color: '#6366f1' }} />
              <span>Estatus de Vacante:</span>
            </div>
            <select
              value={vacancyStatusFilter}
              onChange={(e) => {
                const nextStatus = e.target.value as 'all' | 'Activa' | 'StandBy' | 'Cerrada';
                setVacancyStatusFilter(nextStatus);
                if (selectedVacancyFilter !== 'all') {
                  if (selectedVacancyFilter === 'unassigned' && nextStatus !== 'all') {
                    setSelectedVacancyFilter('all');
                  } else {
                    const targetVac = vacancies.find(v => v.id === selectedVacancyFilter);
                    if (targetVac && !matchesVacancyStatus(targetVac, nextStatus)) {
                      setSelectedVacancyFilter('all');
                    }
                  }
                }
              }}
              aria-label="Picklist Estatus de Vacantes"
              style={{
                backgroundColor: '#eef2ff',
                border: '1px solid #a5b4fc',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: '#312e81',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">Todos</option>
              <option value="Activa">Activos</option>
              <option value="StandBy">Stand by</option>
              <option value="Cerrada">Cerrada</option>
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155', fontSize: 12, fontWeight: 700, marginLeft: 4 }}>
              <span>Filtrar por Vacante:</span>
            </div>
            <select
              value={selectedVacancyFilter}
              onChange={(e) => setSelectedVacancyFilter(e.target.value)}
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: '#1e293b',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">
                Todas las vacantes ({vacancyStatusFilter === 'all' ? candidates.length : candidates.filter(c => c.vacancyId && statusFilteredVacancies.some(v => v.id === c.vacancyId) && c.stage !== 'Pool').length} candidatos)
              </option>
              {statusFilteredVacancies.map((v) => {
                const count = candidates.filter(c => c.vacancyId === v.id && c.stage !== 'Pool').length;
                return (
                  <option key={v.id} value={v.id}>
                    {v.title} ({count} {count === 1 ? 'candidato' : 'candidatos'})
                  </option>
                );
              })}
              {vacancyStatusFilter === 'all' && (
                <option value="unassigned">
                  [Talent Pool] Candidatos Sin Asignación de Vacante ({candidates.filter(c => isUnassignedOrPoolCandidate(c)).length})
                </option>
              )}
            </select>

            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: filterOnlyMyArea ? '#1e40af' : '#475569',
              cursor: 'pointer',
              padding: '5px 10px',
              borderRadius: 8,
              backgroundColor: filterOnlyMyArea ? '#eff6ff' : '#f1f5f9',
              border: filterOnlyMyArea ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
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
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={collapseAllVacancies}
              className="btn btn-ghost"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                color: '#475569'
              }}
            >
              Contraer Todas
            </button>
            <button
              type="button"
              onClick={expandAllVacancies}
              className="btn btn-ghost"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                color: '#475569'
              }}
            >
              Expandir Todas
            </button>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', backgroundColor: '#f1f5f9', padding: '4px 12px', borderRadius: 20 }}>
              📍 Carriles Horizontales ({groupedByVacancy.length} {groupedByVacancy.length === 1 ? 'vacante activa' : 'vacantes activas'})
            </span>
          </div>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="card empty-state">
          <Users size={28} />
          <p>Aún no hay candidatos. Analiza el primero con IA para comenzar el pipeline.</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="card" style={{ padding: 0, overflowX: 'auto', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left', color: '#1e293b' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', color: 'var(--text-mid)', backgroundColor: '#f8fafc', userSelect: 'none' }}>
                <th onClick={() => toggleSort('name')} style={{ padding: '12px 16px', cursor: 'pointer' }}>
                  Nombre {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('vacancy')} style={{ padding: '12px 16px', cursor: 'pointer' }}>
                  Rol Sugerido {sortField === 'vacancy' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('channel')} style={{ padding: '12px 16px', cursor: 'pointer' }}>
                  Canal {sortField === 'channel' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('stage')} style={{ padding: '12px 16px', cursor: 'pointer' }}>
                  Etapa {sortField === 'stage' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('fitScore')} style={{ padding: '12px 16px', textAlign: 'center', cursor: 'pointer' }}>
                  Ajuste {sortField === 'fitScore' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Double-Check</th>
              </tr>
            </thead>
            <tbody>
              {sortedCandidates.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }}
                  className="hover-row"
                  onClick={() => setSelectedId(c.id)}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{cleanCandidateName(c.name, c.resumeText, c.email)}</td>
                  <td style={{ padding: '12px 16px' }}>{vacancies.find(v => v.id === c.vacancyId)?.title || 'la vacante'}</td>
                  <td style={{ padding: '12px 16px' }}>{c.channel}</td>
                  <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                    <select
                      value={c.stage}
                      onChange={(e) => moveStage(c, e.target.value as CandidateStage)}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer pr-6 appearance-none"
                      style={{
                        backgroundPosition: 'right 6px center',
                        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23475569' stroke-width='2' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/></svg>")`,
                        backgroundRepeat: 'no-repeat',
                        paddingRight: '22px'
                      }}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: c.fitScore >= 80 ? 'var(--success)' : c.fitScore >= 60 ? 'var(--brass)' : 'var(--danger)' }}>
                      {c.fitScore}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {c.initialFitScore ? (
                      <span style={{ color: c.fitScore > c.initialFitScore ? 'var(--success)' : c.fitScore < c.initialFitScore ? 'var(--danger)' : 'var(--text-mid)', fontSize: 11, fontWeight: 'bold' }}>
                        {c.fitScore > c.initialFitScore ? '↑ Subió' : c.fitScore < c.initialFitScore ? '↓ Bajó' : '→ Conforme'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-low)', fontSize: 11 }}>Pendiente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groupedByVacancy.length === 0 ? (
            <div className="card empty-state">
              <Users size={28} />
              <p>No hay candidatos para la vacante seleccionada.</p>
            </div>
          ) : (
            groupedByVacancy.map((vGroup) => {
              const isCollapsed = !!collapsedVacancies[vGroup.vacancyId];
              return (
                <div
                  key={vGroup.vacancyId}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 16,
                    border: '1px solid #cbd5e1',
                    padding: 16,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Vacancy Swimlane Header */}
                  <div
                    onClick={() => toggleVacancyCollapse(vGroup.vacancyId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: isCollapsed ? 0 : 14,
                      paddingBottom: isCollapsed ? 0 : 10,
                      borderBottom: isCollapsed ? 'none' : '1.5px solid #e2e8f0',
                      flexWrap: 'wrap',
                      gap: 10,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 320px', minWidth: 0 }}>
                      <div style={{
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        padding: '6px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                      </div>
                      <div style={{
                        backgroundColor: vGroup.vacancyId === 'unassigned' ? '#f1f5f9' : '#e0e7ff',
                        color: vGroup.vacancyId === 'unassigned' ? '#475569' : '#4338ca',
                        padding: 8,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0
                      }}>
                        <Briefcase size={18} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display, sans-serif)', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
                          {vGroup.vacancyTitle}
                        </h3>
                        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                          {vGroup.department} • Estado: <strong style={{ color: vGroup.status === 'Abierta' ? '#10b981' : '#6366f1' }}>{vGroup.status}</strong>
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {/* Semáforo de Viabilidad / Métricas de Talent Pool */}
                      {(() => {
                        if (vGroup.vacancyId === 'unassigned') {
                          const totalCount = vGroup.candidates.length;
                          const prequalifiedCount = vGroup.candidates.filter(c => (c.fitScore || 0) >= 75).length;
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="px-3 py-1 rounded-full text-[13px] font-extrabold bg-blue-50 text-blue-700 border border-blue-300 flex items-center gap-1.5 shadow-2xs" title="Perfiles en Talent Pool">
                                <span>💼</span> Perfiles Disponibles: {totalCount}
                              </span>
                              <span className="px-3 py-1 rounded-full text-[13px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-300 flex items-center gap-1.5 shadow-2xs" title="Precalificados para Consultoría (>=75%)">
                                <span>✨</span> Precalificados Consultoría: {prequalifiedCount}
                              </span>
                              <span className="px-3 py-1 rounded-full text-[13px] font-extrabold bg-slate-50 text-slate-700 border border-slate-300 flex items-center gap-1.5 shadow-2xs" title="Pendientes de asignación a vacante específica">
                                <span>🎯</span> Pendientes de Vincular: {totalCount}
                              </span>
                            </div>
                          );
                        }
                        const viablesCount = vGroup.candidates.filter(c => (c.fitScore || 0) >= 80).length;
                        const porValidarCount = vGroup.candidates.filter(c => (c.fitScore || 0) >= 70 && (c.fitScore || 0) <= 79).length;
                        const noViablesCount = vGroup.candidates.filter(c => (c.fitScore || 0) <= 69).length;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="px-3 py-1 rounded-full text-[13px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs" title="Candidatos Viables (>=80%)">
                              <span>🟢</span> Viables: {viablesCount}
                            </span>
                            <span className="px-3 py-1 rounded-full text-[13px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1.5 shadow-2xs" title="Candidatos Por Validar (70-79%)">
                              <span>🟡</span> Por Validar: {porValidarCount}
                            </span>
                            <span className="px-3 py-1 rounded-full text-[13px] font-extrabold bg-orange-50 text-orange-800 border border-orange-300 flex items-center gap-1.5 shadow-2xs" title="Candidatos No Viables (<=69%)">
                              <span>🟠</span> No Viables: {noViablesCount}
                            </span>
                          </div>
                        );
                      })()}

                      {vGroup.vacancyId !== 'unassigned' && activeRole !== 'MANAGER' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCandidate(null);
                            setInitialBulkMode(false);
                            setFormTargetVacancyId(vGroup.vacancyId);
                            setShowForm(true);
                          }}
                          className="px-3.5 py-1.5 bg-[#103268] hover:bg-[#0d2956] text-white rounded-lg text-[13px] font-black shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                          title="Vincular o postular candidato para esta vacante"
                        >
                          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                          <span>Vincular Candidato</span>
                        </button>
                      )}
                      <span style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        color: '#1e293b',
                        padding: '6px 14px',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 800
                      }}>
                        {vGroup.candidates.length} {vGroup.candidates.length === 1 ? 'candidato en esta vacante' : 'candidatos en esta vacante'}
                      </span>
                    </div>
                  </div>

                  {!isCollapsed && (
                    /* Stage Columns Grid for this Vacancy */
                    <div className="kanban-board" style={{ margin: 0 }}>
                      {STAGES.map((stage) => {
                        const stageCandidates = vGroup.stages[stage];
                        return (
                          <div className="kanban-column" key={stage}>
                            <div className="kanban-column-header">
                              <span className="kanban-column-title">{stage}</span>
                              <span className="badge badge-neutral">{stageCandidates.length}</span>
                            </div>
                            {stageCandidates.length === 0 ? (
                              <div style={{
                                padding: '18px 8px',
                                textAlign: 'center',
                                color: '#94a3b8',
                                fontSize: 10.5,
                                fontStyle: 'italic',
                                border: '1px dashed #e2e8f0',
                                borderRadius: 10,
                                marginTop: 4
                              }}>
                                Sin candidatos
                              </div>
                            ) : (
                              stageCandidates.map((c) => {
                                const initial = c.initialFitScore;
                                const trend = initial ? (c.fitScore > initial ? '↑ Subió' : c.fitScore < initial ? '↓ Bajó' : '→ Conforme') : 'Nuevo';
                                const trendColor = initial ? (c.fitScore > initial ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : c.fitScore < initial ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-50 text-slate-600 border border-slate-200') : 'bg-slate-100 text-slate-500 border border-slate-200';

                                return (
                                  <div
                                    key={c.id}
                                    className="bg-white border border-slate-200 hover:border-slate-350 text-left p-3 rounded-xl cursor-pointer hover:shadow-xs transition duration-150 flex flex-col justify-between gap-2.5 relative min-w-0 w-full overflow-hidden box-border"
                                    onClick={() => setSelectedId(c.id)}
                                  >
                                    {/* Header Badges */}
                                    <div className="flex justify-between items-center gap-1 min-w-0 w-full overflow-hidden">
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-extrabold uppercase tracking-wider truncate max-w-[125px] shrink-0" title={`Canal de origen: ${c.channel || 'Postulación'}`}>
                                        {c.channel === 'EAS Consulting DB' ? 'Base de Talento' : (c.channel || 'Postulación')}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 whitespace-nowrap ${trendColor}`}>
                                        {trend}
                                      </span>
                                    </div>

                                    {/* Guidance Alert or Level Tag */}
                                    {c.guidanceAlert && c.vacancyId ? (
                                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold min-w-0 w-full overflow-hidden shrink-0 ${c.guidanceGapDetails?.includes('INCOMPATIBILIDAD CRÍTICA') || (c.fitScore && c.fitScore <= 25)
                                          ? 'bg-rose-100 border border-rose-300 text-rose-900 font-black'
                                          : 'bg-rose-50 border border-rose-200 text-rose-800'
                                        }`} title={c.guidanceGapDetails}>
                                        <AlertTriangle size={12} className="shrink-0 text-rose-600" />
                                        <span className="truncate">
                                          {c.guidanceGapDetails?.includes('INCOMPATIBILIDAD CRÍTICA') || (c.fitScore && c.fitScore <= 25)
                                            ? 'Incompatible con la vacante'
                                            : `Alerta Nivel Guía: ${c.detectedGuidanceLevel}`}
                                        </span>
                                      </div>
                                    ) : c.detectedGuidanceLevel ? (
                                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-800 text-[10.5px] font-bold min-w-0 w-full overflow-hidden shrink-0">
                                        <span className="truncate">{!c.vacancyId ? `Talent Pool: Nivel ${c.detectedGuidanceLevel}` : `Nivel Guía: ${c.detectedGuidanceLevel}`}</span>
                                      </div>
                                    ) : null}

                                    {/* Candidate Name & Fit Gauge */}
                                    <div className="flex justify-between items-start gap-2 min-w-0 w-full">
                                      <div className="space-y-0.5 min-w-0 flex-1 overflow-hidden">
                                        <h4 className="font-extrabold text-slate-900 text-[13.5px] leading-snug truncate font-sans" title={cleanCandidateName(c.name, c.resumeText, c.email)}>
                                          {cleanCandidateName(c.name, c.resumeText, c.email)}
                                        </h4>
                                        <p className="text-[11.5px] text-slate-600 font-semibold truncate" title={vacancies.find(v => v.id === c.vacancyId)?.title || 'la vacante'}>
                                          {vacancies.find(v => v.id === c.vacancyId)?.title || 'la vacante'}
                                        </p>
                                      </div>
                                      <div className="shrink-0">
                                        <FitGauge value={c.fitScore} initialValue={c.initialFitScore} size={34} />
                                      </div>
                                    </div>

                                    {/* Stage Selector */}
                                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 min-w-0 w-full">
                                      <span className="text-[11px] text-slate-500 font-bold font-mono shrink-0">Fase:</span>
                                      <select
                                        value={c.stage}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => moveStage(c, e.target.value as CandidateStage)}
                                        className="flex-1 min-w-0 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-[12px] font-bold text-slate-800 focus:outline-none cursor-pointer appearance-none truncate"
                                        style={{
                                          width: 'auto',
                                          maxWidth: '100%',
                                          backgroundPosition: 'right 6px center',
                                          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23475569' stroke-width='2' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/></svg>")`,
                                          backgroundRepeat: 'no-repeat',
                                          paddingRight: '22px'
                                        }}
                                      >
                                        {STAGES.map((s) => (
                                          <option key={s} value={s}>
                                            {s}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelectedId(null)}>
          <div className="modal-panel glass-panel" style={{ maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0 }}>{cleanCandidateName(selected.name, selected.resumeText, selected.email)}</h2>
                  {['ADMIN', 'RECRUITER'].includes(activeRole.toUpperCase()) && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '2px 8px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: 6, background: '#eef2ff', fontWeight: 600 }}
                      onClick={() => setEditingCandidate(selected)}
                      title="Editar nombre completo y datos del candidato"
                    >
                      <Edit size={12} /> Editar
                    </button>
                  )}
                  {selected.guidanceAlert && selected.vacancyId ? (
                    <span className="badge badge-danger" style={{ fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 4 }} title={selected.guidanceGapDetails}>
                      <AlertTriangle size={12} /> {selected.guidanceGapDetails?.includes('INCOMPATIBILIDAD CRÍTICA') || (selected.fitScore && selected.fitScore <= 25) ? 'Incompatibilidad Crítica de Profesión' : `Alerta Nivel Guía: Nivel "${selected.detectedGuidanceLevel || 'Inferior'}" < Nivel Exigido`}
                    </span>
                  ) : selected.detectedGuidanceLevel ? (
                    <span className="badge badge-success" style={{ fontSize: 10.5 }}>
                      {!selected.vacancyId ? `Talent Pool: Nivel ${selected.detectedGuidanceLevel}` : `Nivel Guía: ${selected.detectedGuidanceLevel}`}
                    </span>
                  ) : null}
                  {selected.initialFitScore && (
                    <span
                      className={`badge ${selected.fitScore > selected.initialFitScore ? 'badge-success' : selected.fitScore < selected.initialFitScore ? 'badge-danger' : 'badge-neutral'}`}
                      style={{ fontSize: 10.5, fontWeight: 'bold' }}
                      title={`Score Sugerido Base CV: ${selected.initialFitScore}% | Ajustado por Vacante: ${selected.fitScore}%`}
                    >
                      {selected.fitScore > selected.initialFitScore
                        ? `+${selected.fitScore - selected.initialFitScore}% Ajuste Vacante (Base CV ${selected.initialFitScore}%)`
                        : selected.fitScore < selected.initialFitScore
                          ? `-${selected.initialFitScore - selected.fitScore}% Brecha Vacante (Base CV ${selected.initialFitScore}%)`
                          : `Score Base CV: ${selected.fitScore}%`}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-mid)', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-low)' }}>Origen:</span>
                  <select
                    value={selected.channel}
                    onChange={async (e) => {
                      const newChannel = e.target.value as any;
                      const updatedLocally = { ...selected, channel: newChannel };
                      onCandidateUpdated(updatedLocally);
                      try {
                        const customKey = localStorage.getItem('eas_gemini_key') || '';
                        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                        if (customKey) headers['x-gemini-api-key'] = customKey;

                        const updateRes = await authFetch(`/api/candidates/${selected.id}`, {
                          method: 'PATCH',
                          headers,
                          body: JSON.stringify({
                            channel: newChannel
                          })
                        });
                        const resData = await updateRes.json().catch(() => ({}));
                        if (!updateRes.ok) throw new Error(resData.message || resData.error || `HTTP ${updateRes.status}`);
                        if (resData.candidate) {
                          onCandidateUpdated({ ...selected, ...resData.candidate });
                        }
                      } catch (err: any) {
                        // Antes: solo console.warn; el cambio quedaba en pantalla sin guardarse.
                        onCandidateUpdated(selected);
                        alert(`⚠️ El cambio NO se guardó en el servidor: ${err?.message || err}`);
                      }
                    }}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      color: '#0f172a',
                      fontSize: 12,
                      padding: '2px 8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      outline: 'none'
                    }}
                  >
                    {['LinkedIn', 'OCC', 'Redes Sociales', 'Glassdoor', 'Referido', 'EAS Consulting DB', 'Otros'].map(ch => (
                      <option key={ch} value={ch} style={{ background: '#ffffff', color: '#0f172a' }}>
                        {ch}
                      </option>
                    ))}
                  </select>
                  <span>·</span>
                  <span style={{ color: 'var(--text-low)' }}>Vacante vinculada:</span>
                  <select
                    value={selected.vacancyId || ''}
                    onChange={async (e) => {
                      const newVacId = e.target.value;
                      const isPool = !newVacId;
                      const targetVac = isPool ? undefined : vacancies.find(v => v.id === newVacId);
                      const strictEval = calculateStrictFitScore(selected, targetVac);
                      const updatedLocally: Candidate = {
                        ...selected,
                        vacancyId: isPool ? undefined : newVacId,
                        stage: isPool ? 'Pool' : (selected.stage === 'Pool' ? 'Filtrado' : selected.stage),
                        fitScore: strictEval.fitScore,
                        initialFitScore: strictEval.initialFitScore,
                        strengths: strictEval.strengths,
                        growths: strictEval.growths
                      };
                      onCandidateUpdated(updatedLocally);
                      try {
                        const customKey = localStorage.getItem('eas_gemini_key') || '';
                        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                        if (customKey) headers['x-gemini-api-key'] = customKey;

                        const updateRes = await authFetch(`/api/candidates/${selected.id}`, {
                          method: 'PATCH',
                          headers,
                          body: JSON.stringify({
                            vacancyId: isPool ? '' : newVacId,
                            stage: isPool ? 'Pool' : undefined,
                            fitScore: strictEval.fitScore,
                            initialFitScore: strictEval.initialFitScore,
                            forceRegenerate: !isPool
                          })
                        });
                        const resData = await updateRes.json().catch(() => ({}));
                        if (!updateRes.ok) throw new Error(resData.message || resData.error || `HTTP ${updateRes.status}`);
                        if (resData.candidate) {
                          onCandidateUpdated({ ...selected, ...resData.candidate });
                        }
                      } catch (err: any) {
                        onCandidateUpdated(selected);
                        alert(`⚠️ El cambio NO se guardó en el servidor: ${err?.message || err}`);
                      }
                    }}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      color: '#0f172a',
                      fontSize: 12,
                      padding: '2px 8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      outline: 'none'
                    }}
                  >
                    <option value="" style={{ background: '#ffffff', color: '#475569', fontWeight: 'bold' }}>⭐ Talent Pool (Sin vacante asignada)</option>
                    {vacancies.map(v => (
                      <option key={v.id} value={v.id} style={{ background: '#ffffff', color: '#0f172a' }}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                </p>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => { setSelectedId(null); setDetailsTab('profile'); }} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            {/* Warning de Incompatibilidad Crítica de Profesión */}
            {(selected.guidanceGapDetails?.includes('INCOMPATIBILIDAD CRÍTICA') || (selected.fitScore && selected.fitScore <= 25)) && (
              <div style={{ background: '#fef2f2', border: '1px solid #f87171', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <AlertTriangle size={20} color="#b91c1c" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.4 }}>
                  <strong>Alerta de Incompatibilidad con la Vacante:</strong> {selected.guidanceGapDetails || 'La formación o profesión del candidato no es acorde con la vacante solicitada. Perfil sin cabida para postulación.'}
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 16, gap: 12, paddingBottom: 6, flexShrink: 0 }}>
              <button
                type="button"
                className={`btn ${detailsTab === 'profile' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setDetailsTab('profile')}
              >
                Perfil General
              </button>
              <button
                type="button"
                className={`btn ${detailsTab === 'fitMatrix' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setDetailsTab('fitMatrix')}
              >
                Matriz Encaje AI
              </button>
              <button
                type="button"
                className={`btn ${detailsTab === 'doubleCheck' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setDetailsTab('doubleCheck')}
              >
                Cuestionario & Double-Check
              </button>
              <button
                type="button"
                className={`btn ${detailsTab === 'speech' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setDetailsTab('speech')}
              >
                Speech de Entrevista
              </button>
            </div>

            {/* Scrollable Tab contents wrapper */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column' }}>
              {detailsTab === 'fitMatrix' && (
                <div className="py-2">
                  <CandidateFitMatrix
                    candidate={selected}
                    vacancy={vacancies.find(v => v.id === selected.vacancyId)}
                  />
                </div>
              )}
              {detailsTab === 'profile' && (

                <>
                  {/* Ficha de Datos Personales y de Contacto */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginBottom: 14,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px 24px',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <Mail size={14} style={{ color: '#4f46e5' }} />
                      <span style={{ fontWeight: 600, color: '#475569' }}>Email:</span>
                      <a href={`mailto:${selected.email}`} style={{ color: '#0f172a', fontWeight: 'bold', textDecoration: 'underline' }}>
                        {selected.email || 'No especificado'}
                      </a>
                      {selected.email && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '2px 4px', fontSize: 10, height: 'auto', color: '#64748b' }}
                          onClick={() => {
                            navigator.clipboard.writeText(selected.email);
                            alert('Email copiado al portapapeles');
                          }}
                          title="Copiar email"
                        >
                          <Copy size={11} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <Phone size={14} style={{ color: '#059669' }} />
                      <span style={{ fontWeight: 600, color: '#475569' }}>Teléfono:</span>
                      <span style={{ color: '#0f172a', fontWeight: 'bold' }}>{selected.phone || 'No registrado'}</span>
                      {selected.phone && (
                        <>
                          <a
                            href={`tel:${selected.phone}`}
                            className="btn btn-ghost"
                            style={{ padding: '2px 6px', fontSize: 10, height: 'auto', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 4 }}
                            title="Llamar"
                          >
                            Llamar
                          </a>
                          <a
                            href={`https://wa.me/${selected.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost"
                            style={{ padding: '2px 6px', fontSize: 10, height: 'auto', color: '#059669', fontWeight: 'bold', border: '1px solid #a7f3d0', borderRadius: 4, background: '#ecfdf5' }}
                            title="Abrir WhatsApp"
                          >
                            WhatsApp
                          </a>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <MapPin size={14} style={{ color: '#d97706' }} />
                      <span style={{ fontWeight: 600, color: '#475569' }}>Ubicación:</span>
                      <span style={{ color: '#0f172a', fontWeight: 'bold' }}>{extractLocationFromResume(selected.resumeText)}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: '#475569' }}>Canal de Origen:</span>
                      <span className="badge badge-neutral" style={{ fontSize: 11, fontWeight: 'bold' }}>
                        {selected.channel === 'EAS Consulting DB' ? 'Base de Talento' : (selected.channel || 'Postulación')}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <FitGauge value={selected.fitScore} initialValue={selected.cvBaseScore ?? selected.initialFitScore} size={64} />
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--text-mid)', margin: 0, lineHeight: 1.6 }}>{cleanEnginePrefix(selected.summary)}</p>
                    </div>
                  </div>

                  {/* Trazabilidad y Desglose del Score (Pilar 5) */}
                  {(() => {
                    const liveStrict = selectedVacancy ? calculateStrictFitScore(selected, selectedVacancy) : undefined;
                    const bd = selected.fitScoreBreakdown || liveStrict?.breakdown;
                    const cvBase = selected.cvBaseScore ?? bd?.cvBaseScore ?? selected.initialFitScore ?? selected.fitScore;
                    const dcDelta = selected.doubleCheckDelta ?? bd?.doubleCheckDelta ?? 0;
                    const fbDelta = selected.manualFeedbackDelta ?? bd?.manualFeedbackDelta ?? 0;
                    const matched = bd?.matchedRequirements || liveStrict?.breakdown?.matchedRequirements || [];
                    const missing = bd?.missingRequirements || liveStrict?.breakdown?.missingRequirements || [];
                    return (
                      <div className="card" style={{ padding: 12, marginBottom: 14, borderRadius: 10, backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#1e293b', marginBottom: 8 }}>
                          Trazabilidad y Desglose del Score ({selected.fitScore}%)
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: (matched.length || missing.length) ? 10 : 0 }}>
                          <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 10, color: '#64748b' }}>Base CV vs Vacante</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{cvBase}%</div>
                          </div>
                          <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 10, color: '#64748b' }}>Ajuste Double-Check</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: dcDelta > 0 ? '#059669' : dcDelta < 0 ? '#dc2626' : '#475569' }}>
                              {dcDelta > 0 ? `+${dcDelta}` : dcDelta} pts
                            </div>
                          </div>
                          <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 10, color: '#64748b' }}>Comentarios Evaluador</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: fbDelta > 0 ? '#059669' : fbDelta < 0 ? '#dc2626' : '#475569' }}>
                              {fbDelta > 0 ? `+${fbDelta}` : fbDelta} pts
                            </div>
                          </div>
                        </div>
                        {(matched.length > 0 || missing.length > 0) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {matched.slice(0, 5).map((m, idx) => (
                              <span key={`m-${idx}`} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}>
                                Cubierto ({m.source === 'experience' ? 'Exp' : m.source === 'certifications' ? 'Cert' : m.source === 'education' ? 'Edu' : 'CV'}): {m.req}
                              </span>
                            ))}
                            {missing.slice(0, 4).map((req, idx) => (
                              <span key={`g-${idx}`} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                                Brecha: {req}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="tag-list" style={{ marginBottom: 18 }}>
                    <span className="badge badge-neutral">Inglés {selected.englishLevel}</span>
                    <span className="badge badge-neutral">
                      Sueldo pretendido {selected.expectedSalary && !isNaN(selected.expectedSalary) ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(selected.expectedSalary) : 'No especificado'}
                    </span>
                  </div>

                  {selected.doubleCheckReport && (() => {
                    // Color según el veredicto (antes siempre verde, aunque el dictamen fuera negativo)
                    const r = selected.doubleCheckReport || '';
                    const tone = /NO APROBADO/.test(r) ? { bg: 'rgba(239,68,68,0.06)', bd: 'rgba(239,68,68,0.35)', fg: '#b91c1c' }
                      : /NO CONCLUYENTE|CON RESERVAS/.test(r) ? { bg: 'rgba(245,158,11,0.07)', bd: 'rgba(245,158,11,0.4)', fg: '#b45309' }
                        : { bg: 'rgba(16,185,129,0.06)', bd: 'rgba(16,185,129,0.25)', fg: 'var(--success)' };
                    return (
                      <div className="card" style={{ padding: 12, marginBottom: 18, borderRadius: 10, backgroundColor: tone.bg, border: `1px solid ${tone.bd}` }}>
                        <h4 style={{ fontSize: 12, fontWeight: 'bold', color: tone.fg, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Sparkles size={14} /> Validación de Coherencia (Doble Validación / Double-Check)
                        </h4>
                        <p style={{ fontSize: 11.5, color: 'var(--text-high)', margin: 0, whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                          {cleanEnginePrefix(selected.doubleCheckReport)}
                        </p>
                      </div>
                    );
                  })()}

                  {selectedVacancy ? (
                    <>
                      {/* Ficha Técnica & Requisición de Puesto Asignado */}
                      <div className="card" style={{ padding: 14, marginBottom: 18, borderRadius: 12, backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Briefcase size={16} style={{ color: '#4338ca' }} />
                            <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: 0, color: '#0f172a' }}>
                              {selectedVacancy.title}
                            </h4>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 'bold', color: '#475569' }}>Vacante Vinculada:</span>
                            <select
                              value={(selected.stage === 'Pool' ? 'unassigned' : (selected.vacancyId || 'unassigned'))}
                              onChange={async (e) => {
                                const newVacId = e.target.value === 'unassigned' ? '' : e.target.value;
                                const newStage = newVacId ? (selected.stage === 'Pool' ? 'Filtrado' : selected.stage) : 'Pool';
                                const targetVac = newVacId ? vacancies.find(v => v.id === newVacId) : undefined;
                                const strictEval = calculateStrictFitScore(selected, targetVac);
                                const updatedCompetencies = calculateCandidateCompetencies(selected, targetVac);
                                const updatedSummary = synthesizeAnalyticalCandidateSummary(selected, targetVac);
                                const updatedCandidate: Candidate = {
                                  ...selected,
                                  vacancyId: newVacId,
                                  stage: newStage,
                                  fitScore: strictEval.fitScore,
                                  initialFitScore: strictEval.initialFitScore,
                                  competencies: updatedCompetencies,
                                  summary: updatedSummary,
                                  strengths: strictEval.strengths,
                                  growths: strictEval.growths
                                };
                                onCandidateUpdated(updatedCandidate);
                                try {
                                  const customKey = localStorage.getItem('eas_gemini_key') || '';
                                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                                  if (customKey) headers['x-gemini-api-key'] = customKey;

                                  const updateRes = await authFetch(`/api/candidates/${selected.id}`, {
                                    method: 'PATCH',
                                    headers,
                                    body: JSON.stringify({
                                      vacancyId: newVacId,
                                      stage: newStage,
                                      forceRegenerate: true
                                    })
                                  });
                                  const resData = await updateRes.json().catch(() => ({}));
                                  if (!updateRes.ok) throw new Error(resData.message || resData.error || `HTTP ${updateRes.status}`);
                                  if (resData.candidate) {
                                    onCandidateUpdated({ ...selected, ...resData.candidate });
                                  }
                                } catch (err: any) {
                                  onCandidateUpdated(selected);
                                  alert(`⚠️ El cambio NO se guardó en el servidor: ${err?.message || err}`);
                                }
                              }}
                              style={{
                                padding: '3px 8px',
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 'bold',
                                border: '1px solid #a5b4fc',
                                backgroundColor: '#ffffff',
                                color: '#3730a3',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="unassigned">⭐ Talent Pool (Sin vacante asignada)</option>
                              {vacancies.map(v => (
                                <option key={v.id} value={v.id}>{v.title}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#475569', marginBottom: 10, flexWrap: 'wrap' }}>
                          <span>📍 <strong>Ubicación:</strong> {selectedVacancy.location}</span>
                          <span>⌛ <strong>Experiencia requerida:</strong> {selectedVacancy.experienceYears}+ años</span>
                          <span>💵 <strong>Tabulador de la vacante:</strong> <strong style={{ color: '#059669' }}>{selectedVacancy.salaryRange || 'No especificado'}</strong></span>
                          <span>🌐 <strong>Inglés:</strong> {selectedVacancy.englishLevel}</span>
                        </div>

                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, fontSize: 11.5, color: '#334155', lineHeight: 1.5, marginBottom: 10 }}>
                          <strong style={{ color: '#1e1b4b', display: 'block', marginBottom: 4 }}>📋 Descripción & Observaciones Adicionales de la Vacante:</strong>
                          <p style={{ margin: 0, whiteSpace: 'pre-line' }}>
                            {selectedVacancy.description || 'Consultor experto en implementación integral (end-to-end) de SAP S/4HANA en el módulo especificado.'}
                          </p>
                        </div>

                        {/* Interpretación IA de Perfiles Incluidos y Ponderación de Peso */}
                        {(() => {
                          const profiles = interpretVacancyProfileWeights(selectedVacancy);
                          return (
                            <div style={{ backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, padding: '10px 12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#312e81', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                  Interpretación IA de Perfiles en Vacante & Peso de Evaluación
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#4338ca', backgroundColor: '#e0e7ff', padding: '2px 7px', borderRadius: 10 }}>
                                  Perfil Principal: {profiles[0]?.profile} ({profiles[0]?.weight}%)
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {profiles.map((p, idx) => (
                                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                                      <span style={{ fontWeight: idx === 0 ? 800 : 600, color: idx === 0 ? '#1e1b4b' : '#334155' }}>
                                        {p.profile} <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 700 }}>[{p.roleType}]</span>
                                        {p.focusAreas.length > 0 && (
                                          <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>
                                            ({p.focusAreas.slice(0, 3).join(', ')})
                                          </span>
                                        )}
                                      </span>
                                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: idx === 0 ? '#4338ca' : '#475569' }}>
                                        {p.weight}%
                                      </span>
                                    </div>
                                    <div style={{ height: 5, backgroundColor: '#dbeafe', borderRadius: 4, overflow: 'hidden' }}>
                                      <div
                                        style={{
                                          width: `${p.weight}%`,
                                          height: '100%',
                                          background: idx === 0 ? 'linear-gradient(90deg, #4f46e5, #059669)' : '#818cf8',
                                          borderRadius: 4
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-low)', marginBottom: 10 }}>
                        Auditoría de brechas vs. mínimos de la vacante
                      </h3>
                      {COMPETENCY_KEYS.map((k) => {
                        const score = (selected.competencies || {})[k] ?? 50;
                        const min = (selectedVacancy.minCompetenciesRequired || {})[k] ?? 60;
                        const gap = score - min;
                        return (
                          <div key={k} style={{ marginBottom: 10 }}>
                            <div className="slider-label">
                              <span>{k}</span>
                              <span style={{ color: gap >= 0 ? 'var(--success)' : 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
                                {score} <span style={{ color: 'var(--text-low)' }}>/ mín. {min}</span>
                              </span>
                            </div>
                            <div className="gov-bar-track">
                              <div
                                className="gov-bar-fill"
                                style={{
                                  width: `${score}%`,
                                  background: gap >= 0 ? 'linear-gradient(90deg, var(--brass), var(--success))' : 'var(--danger)'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      <hr className="divider" style={{ margin: '14px 0' }} />
                    </>
                  ) : (
                    <>
                      {/* Ficha Técnica para Candidato en Talent Pool (Sin Vacante) */}
                      <div className="card" style={{ padding: 14, marginBottom: 18, borderRadius: 12, backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Sparkles size={16} style={{ color: '#0284c7' }} />
                            <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: 0, color: '#0369a1' }}>
                              ⭐ Talent Pool (Candidato Sin Asignación de Vacante)
                            </h4>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 'bold', color: '#0369a1' }}>Asignar a Vacante:</span>
                            <select
                              value={(selected.stage === 'Pool' ? 'unassigned' : (selected.vacancyId || 'unassigned'))}
                              onChange={async (e) => {
                                const newVacId = e.target.value === 'unassigned' ? '' : e.target.value;
                                const newStage = newVacId ? (selected.stage === 'Pool' ? 'Filtrado' : selected.stage) : 'Pool';
                                const targetVac = newVacId ? vacancies.find(v => v.id === newVacId) : undefined;
                                const strictEval = calculateStrictFitScore(selected, targetVac);
                                const updatedCompetencies = calculateCandidateCompetencies(selected, targetVac);
                                const updatedSummary = synthesizeAnalyticalCandidateSummary(selected, targetVac);
                                const updatedCandidate: Candidate = {
                                  ...selected,
                                  vacancyId: newVacId,
                                  stage: newStage,
                                  fitScore: strictEval.fitScore,
                                  initialFitScore: strictEval.initialFitScore,
                                  competencies: updatedCompetencies,
                                  summary: updatedSummary,
                                  strengths: strictEval.strengths,
                                  growths: strictEval.growths
                                };
                                onCandidateUpdated(updatedCandidate);
                                try {
                                  const customKey = localStorage.getItem('eas_gemini_key') || '';
                                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                                  if (customKey) headers['x-gemini-api-key'] = customKey;

                                  const updateRes = await authFetch(`/api/candidates/${selected.id}`, {
                                    method: 'PATCH',
                                    headers,
                                    body: JSON.stringify({
                                      vacancyId: newVacId,
                                      stage: newStage,
                                      forceRegenerate: true
                                    })
                                  });
                                  const resData = await updateRes.json().catch(() => ({}));
                                  if (!updateRes.ok) throw new Error(resData.message || resData.error || `HTTP ${updateRes.status}`);
                                  if (resData.candidate) {
                                    onCandidateUpdated({ ...selected, ...resData.candidate });
                                  }
                                } catch (err: any) {
                                  onCandidateUpdated(selected);
                                  alert(`⚠️ El cambio NO se guardó en el servidor: ${err?.message || err}`);
                                }
                              }}
                              style={{
                                padding: '3px 8px',
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 'bold',
                                border: '1px solid #0284c7',
                                backgroundColor: '#ffffff',
                                color: '#0369a1',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="unassigned">⭐ Talent Pool (Sin vacante asignada)</option>
                              {vacancies.map(v => (
                                <option key={v.id} value={v.id}>{v.title}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e0f2fe', borderRadius: 8, padding: 10, fontSize: 11.5, color: '#0c4a6e', lineHeight: 1.5 }}>
                          <strong style={{ color: '#0369a1', display: 'block', marginBottom: 4 }}>💡 Justificación del Score en Talent Pool ({selected.fitScore}%):</strong>
                          <p style={{ margin: 0 }}>
                            Este candidato pertenece al <strong>Talent Pool (Sin Asignación de Vacante)</strong>. Su score actual (<strong>{selected.fitScore}%</strong>) representa su <strong>Idoneidad General de Consultoría EAS</strong> (evaluada a partir de soft skills, trayectoria profesional e inglés). Para realizar una auditoría de brechas contra un puesto específico y generar su Cuestionario de Doble Check personalizado, asigna una vacante al candidato en el menú desplegable superior.
                          </p>
                        </div>
                      </div>
                      <hr className="divider" style={{ margin: '14px 0' }} />
                    </>
                  )}

                  {/* Cross-Vacancy Recommendation Panel (Talent Pool Optimizer) */}
                  <div style={{ marginTop: 14, marginBottom: 14 }}>
                    <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-low)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={13} style={{ color: 'var(--brass-light)' }} /> Optimización de Ajuste Cruzado (Talent Pool Optimizer)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {vacancies
                        .filter(v => v.id !== selected.vacancyId && v.status !== 'Closed')
                        .map(v => {
                          const evalRes = calculateStrictFitScore(selected, v);
                          const score = evalRes.fitScore;
                          const isMismatch = evalRes.hasDomainMismatch || score <= 34;
                          const isBetter = !isMismatch && score >= 80 && score > selected.fitScore;
                          return (
                            <div
                              key={v.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 10px',
                                borderRadius: 6,
                                background: isMismatch ? 'rgba(239,68,68,0.04)' : isBetter ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
                                border: isMismatch ? '1px solid rgba(239,68,68,0.2)' : isBetter ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.05)',
                                fontSize: 12
                              }}
                              title={isMismatch ? (evalRes.mismatchReason || 'Incompatibilidad de perfil') : undefined}
                            >
                              <div>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-high)' }}>{v.title}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-low)', marginLeft: 8 }}>{v.department}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {isMismatch ? (
                                  <span
                                    style={{
                                      fontSize: 9,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      backgroundColor: 'rgba(239,68,68,0.15)',
                                      color: '#f87171',
                                      fontWeight: 'bold',
                                      border: '1px solid rgba(239,68,68,0.3)'
                                    }}
                                  >
                                    INCOMPATIBLE
                                  </span>
                                ) : isBetter ? (
                                  <span
                                    style={{
                                      fontSize: 9,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      backgroundColor: 'var(--success)',
                                      color: '#000',
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    MAYOR AJUSTE
                                  </span>
                                ) : null}
                                <span style={{ fontWeight: 'bold', color: isMismatch ? '#f87171' : isBetter ? 'var(--success)' : 'var(--text-low)' }}>
                                  {score}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      {vacancies.filter(v => v.id !== selected.vacancyId && v.status !== 'Closed').length === 0 && (
                        <p style={{ fontSize: 11.5, color: 'var(--text-low)', margin: 0, fontStyle: 'italic' }}>
                          No hay otras vacantes activas para evaluar el ajuste cruzado.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bento-grid">
                    <div className="card bento-cell">
                      <div className="bento-cell-title" style={{ color: 'var(--success)' }}>
                        <TrendingUp size={14} /> Fortalezas
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: 'var(--text-mid)' }}>
                        {(selected.strengths || []).map((s, i) => (
                          <li key={i} style={{ marginBottom: 5 }}>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="card bento-cell">
                      <div className="bento-cell-title" style={{ color: 'var(--warning)' }}>
                        <TrendingDown size={14} /> Áreas de oportunidad
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: 'var(--text-mid)' }}>
                        {(selected.growths || []).map((s, i) => (
                          <li key={i} style={{ marginBottom: 5 }}>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Información Importada del CV del Candidato */}
                  {(() => {
                    const cvData = extractCvSectionsFromText(selected.resumeText || '');
                    const fieldHealth = detectDegradedCvFields({
                      experience: selected.experience,
                      education: selected.education,
                      certifications: selected.certifications,
                      resumeText: selected.resumeText || ''
                    });
                    const extractedExp = Array.isArray(cvData?.experience) ? normalizeCanonicalExperience(cvData.experience) : [];
                    const extractedEdu = Array.isArray(cvData?.education) ? normalizeCanonicalEducation(cvData.education) : [];
                    const dbExp = Array.isArray(selected.experience) ? normalizeCanonicalExperience(selected.experience) : [];
                    const dbEdu = Array.isArray(selected.education) ? normalizeCanonicalEducation(selected.education) : [];

                    const expList = (fieldHealth.needsExperienceReextract && extractedExp.length > 0 && !detectDegradedCvFields({ experience: extractedExp, resumeText: selected.resumeText || '' }).needsExperienceReextract)
                      ? extractedExp
                      : (dbExp.length > 0 ? dbExp : extractedExp);
                    const eduList = (fieldHealth.needsEducationReextract && extractedEdu.length > 0)
                      ? extractedEdu
                      : (dbEdu.length > 0 ? dbEdu : extractedEdu);
                    const rawCert = (Array.isArray(selected.certifications) && selected.certifications.length > 0) ? selected.certifications : (Array.isArray(cvData?.certifications) ? cvData.certifications : []);
                    const certList = normalizeCanonicalCertifications(rawCert);

                    return (
                      <div className="card" style={{ padding: 14, marginTop: 12, borderRadius: 12, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxSizing: 'border-box', overflow: 'visible' }}>
                        <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: '0 0 10px', color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Briefcase size={15} style={{ color: '#10b981' }} /> Información Extraída del CV (Trayectoria & Formación Completa)
                        </h4>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, boxSizing: 'border-box' }}>
                          <div style={{ minWidth: 0, boxSizing: 'border-box' }}>
                            <h5 style={{ fontSize: 11, fontWeight: 'bold', color: '#334155', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              💼 Experiencia Laboral (Últimos 3 Empleos)
                            </h5>
                            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: 11.5, color: '#475569', lineHeight: 1.45 }}>
                              {expList.map((item, i) => {
                                const formatted = formatWorkExperienceItem(item);
                                return (
                                  <li key={i} style={{ marginBottom: 8, padding: 10, borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', wordBreak: 'break-word', overflowWrap: 'anywhere', boxSizing: 'border-box' }}>
                                    <div><strong style={{ color: '#0f172a' }}>🏢 Dónde trabajó:</strong> <span style={{ color: '#2563eb', fontWeight: 600 }}>{formatted.company}</span></div>
                                    <div><strong style={{ color: '#4338ca' }}>💼 Puesto ocupado:</strong> {formatted.position}</div>
                                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>🗓️ <strong>Periodo de tiempo:</strong> {formatted.period}</div>
                                    {formatted.details && (
                                      <div style={{ fontSize: 10.5, color: '#334155', marginTop: 4, paddingTop: 4, borderTop: '1px dashed #cbd5e1' }}>
                                        <strong>⚡ Responsabilidades / Logros Clave:</strong> {formatted.details}
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                          <div style={{ minWidth: 0, boxSizing: 'border-box' }}>
                            <h5 style={{ fontSize: 11, fontWeight: 'bold', color: '#334155', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              🎓 Educación & Grados Académicos (Dónde, Qué y Periodo)
                            </h5>
                            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: 11.5, color: '#475569', lineHeight: 1.45, marginBottom: 10 }}>
                              {eduList.map((item, i) => {
                                const formatted = formatEducationItem(item);
                                return (
                                  <li key={i} style={{ marginBottom: 8, padding: 10, borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', wordBreak: 'break-word', overflowWrap: 'anywhere', boxSizing: 'border-box' }}>
                                    <div><strong style={{ color: '#0f172a' }}>🏛️ Dónde estudió:</strong> <span style={{ color: '#059669', fontWeight: 600 }}>{formatted.institution}</span></div>
                                    <div><strong style={{ color: '#4338ca' }}>🎓 Qué estudió:</strong> {formatted.degree}</div>
                                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>🗓️ <strong>Periodo de tiempo:</strong> {formatted.period}</div>
                                  </li>
                                );
                              })}
                            </ul>

                            <h5 style={{ fontSize: 11, fontWeight: 'bold', color: '#334155', margin: '10px 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              📜 Certificaciones & Cursos
                            </h5>
                            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: '#475569', lineHeight: 1.45, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                              {certList.map((item, i) => (
                                <li key={i} style={{ marginBottom: 3 }}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Visualizador de Contenido Completo del CV */}
                        {selected.resumeText && selected.resumeText.length > 30 && (
                          <details style={{ marginTop: 12, borderTop: '1px border-slate-200', paddingTop: 8 }}>
                            <summary style={{ cursor: 'pointer', fontSize: 11.5, fontWeight: 'bold', color: '#4F46E5', userSelect: 'none' }}>
                              📄 Ver Texto Completo Original del CV
                            </summary>
                            <div style={{ marginTop: 8, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11, color: '#334155', maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                              {selected.resumeText}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })()}

                  {/* Retroalimentación Heurística y Calificación Estructurada */}
                  <div className="card" style={{ padding: 14, marginTop: 12, borderRadius: 12, border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: '0 0 6px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={14} style={{ color: '#4f46e5' }} /> Evaluación Heurística & Calificación de Candidato
                    </h4>
                    <p style={{ fontSize: 11, color: '#475569', margin: '0 0 10px', lineHeight: 1.4 }}>
                      Registra una evaluación cualitativa con evidencia técnica u operativa. Cada evaluación favorable ajusta <strong>+8 pts</strong>, una brecha crítica <strong>-10 pts</strong>, y una nota no modifica el puntaje.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ fontSize: 10.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 3 }}>
                          Dictamen de Calificación:
                        </label>
                        <select
                          value={feedbackOutcome}
                          onChange={(e) => setFeedbackOutcome(e.target.value as any)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 11.5, backgroundColor: '#ffffff', color: '#0f172a' }}
                        >
                          <option value="Hired">Favorable / Validación Exitosa (+8 pts)</option>
                          <option value="Rejected">Desfavorable / Brecha Crítica (-10 pts)</option>
                          <option value="Note">Nota Informativa / Seguimiento (0 pts)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 10.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 3 }}>
                          Dimensión Evaluada:
                        </label>
                        <select
                          value={feedbackDimension}
                          onChange={(e) => setFeedbackDimension(e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 11.5, backgroundColor: '#ffffff', color: '#0f172a' }}
                        >
                          <option value="Evaluación Técnica de Perfil">Evaluación Técnica de Perfil</option>
                          <option value="Entrevista por Competencias RH">Entrevista por Competencias RH</option>
                          <option value="Validación de Experiencia y Proyectos">Validación de Experiencia y Proyectos</option>
                          <option value="Alineación Salarial y Disponibilidad">Alineación Salarial y Disponibilidad</option>
                        </select>
                      </div>
                    </div>

                    <textarea
                      rows={3}
                      placeholder="Escribe la justificación y evidencia observable de la entrevista o evaluación técnica (mínimo 10 caracteres)..."
                      value={commentsText}
                      onChange={(e) => setCommentsText(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        padding: 8,
                        fontSize: 11.5,
                        color: '#0f172a',
                        outline: 'none',
                        resize: 'none',
                        boxSizing: 'border-box',
                        marginBottom: 8
                      }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10.5, color: commentsText.trim().length >= 10 ? '#059669' : '#dc2626' }}>
                        {commentsText.trim().length >= 10 ? 'Evidencia suficiente para calificación' : `Mínimo 10 caracteres (${commentsText.trim().length}/10)`}
                      </span>
                      <button
                        onClick={handleSaveComments}
                        disabled={savingComments || commentsText.trim().length < 10}
                        className="btn btn-primary"
                        style={{ padding: '6px 14px', fontSize: 11.5, fontWeight: 600 }}
                      >
                        {savingComments ? 'Guardando...' : 'Aplicar Evaluación y Actualizar Score'}
                      </button>
                    </div>

                    {Array.isArray(selected.evaluationNotes) && selected.evaluationNotes.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                          Historial Estructurado de Notas y Ajustes ({selected.evaluationNotes.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {selected.evaluationNotes.map((note) => (
                            <div
                              key={note.id}
                              style={{
                                padding: '6px 8px',
                                borderRadius: 8,
                                backgroundColor: note.reverted ? '#f1f5f9' : '#ffffff',
                                border: '1px solid #e2e8f0',
                                opacity: note.reverted ? 0.65 : 1,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: 8
                              }}
                            >
                              <div style={{ fontSize: 11, color: '#0f172a', lineHeight: 1.4 }}>
                                <span style={{ fontWeight: 700 }}>{note.dimension}</span>{' '}
                                <span style={{ color: note.delta > 0 ? '#059669' : note.delta < 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                                  ({note.delta > 0 ? `+${note.delta}` : note.delta} pts{note.reverted ? ' - Revertido' : ''})
                                </span>
                                <div style={{ color: '#475569', textDecoration: note.reverted ? 'line-through' : 'none' }}>{note.comment}</div>
                                <div style={{ fontSize: 9.5, color: '#94a3b8' }}>
                                  {note.author} - {new Date(note.timestamp).toLocaleDateString('es-MX')}
                                </div>
                              </div>
                              {note.delta !== 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleRevertEvaluationNote(note.id)}
                                  disabled={savingComments}
                                  style={{
                                    padding: '2px 7px',
                                    fontSize: 10,
                                    borderRadius: 6,
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: '#f8fafc',
                                    color: '#334155',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {note.reverted ? 'Restaurar' : 'Revertir'}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Historial de Cambios en Kanban */}
                  <div className="card" style={{ padding: 12, marginTop: 12, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: '0 0 6px', color: '#103268' }}>
                      Historial de Cambios (Auditoría Kanban)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(selected.history || []).map((h, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#334155', borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                          <span style={{ fontWeight: 'bold' }}>{new Date(h.timestamp).toLocaleString()}</span> — Cambió a <span className="px-1.5 py-0.5 rounded bg-slate-100 font-bold">{h.stage}</span> por <span style={{ fontStyle: 'italic' }}>{h.user}</span>
                        </div>
                      ))}
                      {(!selected.history || selected.history.length === 0) && (
                        <p style={{ fontSize: 11, color: 'var(--text-low)', margin: 0 }}>No hay cambios registrados en esta postulación.</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {detailsTab === 'doubleCheck' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="card" style={{ padding: 12, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 6px' }}>
                      <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: 0, color: 'var(--brass)' }}>
                        Cuestionario de Doble Validación (7 Preguntas)
                      </h4>
                      {(selected.vacancyId || selectedVacancy?.id) && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={isRegeneratingQuestions}
                          style={{ fontSize: 11, padding: '2px 8px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 4, height: 'auto', border: '1px solid #cbd5e1', borderRadius: 4 }}
                          onClick={async () => {
                            try {
                              const targetVacId = selected.vacancyId || selectedVacancy?.id;
                              if (!targetVacId) {
                                alert("Por favor asigna primero una vacante al candidato.");
                                return;
                              }
                              setIsRegeneratingQuestions(true);
                              const customKey = localStorage.getItem('eas_gemini_key') || '';
                              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                              if (customKey) headers['x-gemini-api-key'] = customKey;

                              // Solo regenera las 3 preguntas de experiencia (nuevas y distintas a las actuales);
                              // ya no re-evalúa el Fit Score del candidato.
                              const res = await authFetch(`/api/candidates/${selected.id}/regenerate-questions`, {
                                method: 'POST',
                                headers
                              });
                              const resData = await res.json().catch(() => ({}));
                              if (!res.ok) {
                                throw new Error(resData.error || `Respuesta del servidor no válida (${res.status})`);
                              }
                              if (resData && resData.candidate) {
                                onCandidateUpdated({ ...selected, ...resData.candidate });
                              } else {
                                throw new Error("No se devolvió información actualizada del candidato.");
                              }
                            } catch (err: any) {
                              alert("Error al regenerar preguntas de la vacante: " + (err.message || String(err)));
                            } finally {
                              setIsRegeneratingQuestions(false);
                            }
                          }}
                        >
                          {isRegeneratingQuestions ? '⏳ Regenerando...' : '🔄 Regenerar'}
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-low)', margin: '0 0 10px' }}>
                      Envía estas preguntas al candidato por correo electrónico para confrontar sus habilidades frente al CV.
                    </p>

                    <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, backgroundColor: '#f1f5f9', color: '#1e293b', marginBottom: 12 }}>
                      <div style={{ fontWeight: 'bold', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, borderBottom: '1px solid #cbd5e1', paddingBottom: 2 }}>
                        Experiencia (Preguntas Personalizadas Vacante-CV)
                      </div>
                      {(() => {
                        const expQs = experienceQuestionsFor(selected, selectedVacancy);
                        return expQs.map((qText, idx) => {
                          const existingAns = answerFor(selected, qText);
                          return (
                            <div key={idx} style={{ fontSize: 12, marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 6, color: '#334155' }}>
                              <strong>Pregunta {idx + 1}:</strong> {qText}
                              {existingAns && <div style={{ color: 'var(--success)', marginTop: 4, fontStyle: 'italic' }}>Resp: {existingAns}</div>}
                              {!existingAns && selected.doubleCheckReport && <div style={{ color: 'var(--danger)', marginTop: 4, fontStyle: 'italic' }}>Sin respuesta</div>}
                            </div>
                          );
                        });
                      })()}

                      <div style={{ fontWeight: 'bold', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 10, marginBottom: 6, borderBottom: '1px solid #cbd5e1', paddingBottom: 2 }}>
                        Disponibilidad (4 Preguntas Fijas)
                      </div>
                      {FIXED_AVAILABILITY_QUESTIONS.map((fixedQ, idx) => {
                        // Antes se leía la posición idx+3, que con el cuestionario de 4+4 del servidor
                        // mostraba la 4ª pregunta de experiencia en lugar de la de disponibilidad.
                        const qText = fixedQ;
                        const ansText = answerFor(selected, fixedQ);
                        return (
                          <div key={idx + 4} style={{ fontSize: 12, marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 6, color: '#334155' }}>
                            <strong>Pregunta {idx + 4}:</strong> {qText}
                            {ansText && <div style={{ color: 'var(--success)', marginTop: 4, fontStyle: 'italic' }}>Resp: {ansText}</div>}
                            {!ansText && selected.doubleCheckReport && <div style={{ color: 'var(--danger)', marginTop: 4, fontStyle: 'italic' }}>Sin respuesta</div>}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: 11.5, flex: 1 }}
                        onClick={async () => {
                          const recruiterName = localStorage.getItem('eas_user_name') || userEmail.split('@')[0] || 'Atracción de Talento';
                          const vacTitle = selectedVacancy?.title || selected.role || 'Nombre de la vacante';
                          const source = selected.channel && selected.channel !== 'Otros' ? selected.channel : 'tu postulación';
                          const expList = experienceQuestionsFor(selected, selectedVacancy);
                          const expBlock = expList.map((q, i) => `${i + 1}. ${q}`).join('\n');

                          const dispBlock = [
                            "4. ¿Cuál es tu disponibilidad para integrarte a la vacante?",
                            "5. ¿Cuál fue tu último sueldo mensual bruto (comprobable)?",
                            "6. ¿Dónde te ubicas actualmente?",
                            "7. ¿En qué modalidad de trabajo podrías colaborar (presencial, híbrido o remoto)?"
                          ].join('\n');

                          const cleanName = cleanCandidateName(selected.name, selected.resumeText, selected.email);
                          const text = `¡Buen día ${cleanName}!\n\nEspero que te encuentres muy bien. Mi nombre es ${recruiterName}, te contacto del equipo de Atracción de Talento de EAS Consulting.\n\nSomos una empresa con más de 19 años de experiencia en implementación, consultoría y soporte de aplicaciones SAP. Actualmente buscamos reforzar nuestro equipo con un ${vacTitle}.\n\nRecibimos tu CV a través de ${source} y nos gustaría conocer un poco más sobre tu experiencia. ¿Nos apoyas respondiendo las siguientes preguntas?\n\n📌 NOTA IMPORTANTE: Por favor, en tus respuestas sobre experiencia incluye DATOS MEDIBLES Y CUANTIFICABLES (métricas, cifras, porcentajes de logro, volumen de proyectos, número de usuarios/módulos o resultados concretos), ya que nuestro proceso de evaluación valida la experiencia a través de indicadores medibles.\n\nExperiencia\n${expBlock}\n\nDisponibilidad\n${dispBlock}\n\nQuedo atenta a tus respuestas para, en caso de avanzar, coordinar una sesión y platicarte más sobre la vacante. ¡Muchas gracias por tu tiempo!`;
                          const ok = await copyToClipboard(text);
                          if (ok) {
                            alert('¡Plantilla de correo copiada al portapapeles!');
                          } else {
                            alert('No se pudo copiar automáticamente. Por favor copia el texto manualmente.');
                          }
                        }}
                      >
                        <Copy size={12} /> Copiar Plantilla
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: 11.5, flex: 1 }}
                        onClick={() => {
                          const recruiterName = localStorage.getItem('eas_user_name') || userEmail.split('@')[0] || 'Atracción de Talento';
                          const vacTitle = selectedVacancy?.title || selected.role || 'Nombre de la vacante';
                          const source = selected.channel && selected.channel !== 'Otros' ? selected.channel : 'tu postulación';
                          const expList = experienceQuestionsFor(selected, selectedVacancy);
                          const expBlock = expList.map((q, i) => `${i + 1}. ${q}`).join('\n');

                          const dispBlock = [
                            "4. ¿Cuál es tu disponibilidad para integrarte a la vacante?",
                            "5. ¿Cuál fue tu último sueldo mensual bruto (comprobable)?",
                            "6. ¿Dónde te ubicas actualmente?",
                            "7. ¿En qué modalidad de trabajo podrías colaborar (presencial, híbrido o remoto)?"
                          ].join('\n');

                          const cleanName = cleanCandidateName(selected.name, selected.resumeText, selected.email);
                          const subjectText = `Vacante EAS | ${vacTitle}`;
                          const bodyText = `¡Buen día ${cleanName}!\n\nEspero que te encuentres muy bien. Mi nombre es ${recruiterName}, te contacto del equipo de Atracción de Talento de EAS Consulting.\n\nSomos una empresa con más de 19 años de experiencia en implementación, consultoría y soporte de aplicaciones SAP. Actualmente buscamos reforzar nuestro equipo con un ${vacTitle}.\n\nRecibimos tu CV a través de ${source} y nos gustaría conocer un poco más sobre tu experiencia. ¿Nos apoyas respondiendo las siguientes preguntas?\n\n📌 NOTA IMPORTANTE: Por favor, en tus respuestas sobre experiencia incluye DATOS MEDIBLES Y CUANTIFICABLES (métricas, cifras, porcentajes de logro, volumen de proyectos, número de usuarios/módulos o resultados concretos), ya que nuestro proceso de evaluación valida la experiencia a través de indicadores medibles.\n\nExperiencia\n${expBlock}\n\nDisponibilidad\n${dispBlock}\n\nQuedo atenta a tus respuestas para, en caso de avanzar, coordinar una sesión y platicarte más sobre la vacante. ¡Muchas gracias por tu tiempo!`;

                          const subject = encodeURIComponent(subjectText);
                          const body = encodeURIComponent(bodyText);
                          window.location.href = `mailto:${selected.email}?subject=${subject}&body=${body}`;
                        }}
                      >
                        <Mail size={12} /> Redactar en Outlook
                      </button>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 12, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: '0 0 6px', color: 'var(--teal)' }}>
                      Ingresar Respuestas para Double-Check
                    </h4>
                    <p style={{ fontSize: 12, color: 'var(--text-low)', margin: '0 0 10px' }}>
                      Pega el correo de respuesta del candidato aquí para que EAS Engine AI™ evalúe la consistencia.
                    </p>

                    <textarea
                      rows={4}
                      style={{ width: '100%', fontSize: 12.5, fontFamily: 'var(--font-mono)', padding: 8, borderRadius: 6, backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', resize: 'vertical' }}
                      placeholder="Pega las respuestas recibidas aquí. Por ejemplo:&#13;1. Mi experiencia técnica incluye 5 años en el área...&#13;4. Disponible inmediatamente&#13;5. Mi último sueldo bruto comprobable fue de $60,000 MXN...&#13;6. CDMX&#13;7. Modalidad Híbrida"
                      value={doubleCheckAnswersText}
                      onChange={(e) => setDoubleCheckAnswersText(e.target.value)}
                    />

                    {answersError && (
                      <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{answersError}</div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: 12 }}
                        disabled={isSubmittingAnswers || !doubleCheckAnswersText.trim()}
                        onClick={() => handleDoubleCheckSubmit(selected)}
                      >
                        {isSubmittingAnswers ? 'Analizando Coherencia...' : 'Ejecutar Cotejo y Double-Check'}
                      </button>
                    </div>
                  </div>

                  {selected.doubleCheckReport && (
                    <div className="card" style={{ padding: 12, borderLeft: '4px solid var(--brass)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: 0, color: 'var(--brass)' }}>
                          Dictamen del Double-Check
                        </h4>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={async () => {
                            const initialBase = selected.initialFitScore || 82;
                            const updatedCandidate: Candidate = {
                              ...selected,
                              fitScore: initialBase,
                              doubleCheckReport: ''
                            };
                            const saved = await persistCandidateChange(selected, {
                              fitScore: initialBase,
                              doubleCheckReport: ''
                            }, updatedCandidate);
                            if (!saved) return;
                            setDoubleCheckAnswersText('');
                            alert(`¡Se ha limpiado la evaluación de Double-Check de ${selected.name}! El score ha sido restablecido a ${initialBase}%.`);
                          }}
                        >
                          🗑️ Limpiar Evaluación
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-mid)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                        {selected.doubleCheckReport}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailsTab === 'speech' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="card" style={{ padding: 14, maxHeight: 380, overflowY: 'auto' }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text-mid)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                      {selected.interviewSpeech ? (
                        selected.interviewSpeech
                      ) : (
                        <>
                          <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: '0 0 8px', color: 'var(--brass-light)' }}>
                            📢 Pauta y Speech de Entrevista (EAS Engine AI™)
                          </h4>

                          <div style={{ marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 10 }}>
                            <strong style={{ color: 'var(--teal)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                              👥 Para Capital Humano (RH):
                            </strong>
                            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-high)', fontStyle: 'italic' }}>
                              {`Hola ${cleanCandidateName(selected.name, selected.resumeText, selected.email)}, bienvenido(a) a EAS Consulting. Gracias por participar en nuestro proceso para la vacante de ${selectedVacancy?.title || 'nuestra vacante'}. Queremos aprovechar este espacio para conocer más sobre tu trayectoria profesional, al igual que evaluar tus competencias de comunicación, liderazgo y trabajo en equipo. ¿Podríamos iniciar platicando sobre tu último proyecto...?`}
                            </p>
                          </div>

                          <div>
                            <strong style={{ color: 'var(--brass)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                              💼 Para el Líder Técnico / Hiring Manager:
                            </strong>
                            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-high)', fontStyle: 'italic' }}>
                              {`Bienvenido ${cleanCandidateName(selected.name, selected.resumeText, selected.email)}. En esta sesión nos enfocaremos en comprender tu experiencia técnica resolviendo desafíos reales del puesto. Específicamente, nos gustaría conocer cómo manejas ${(selected.strengths && selected.strengths[0]) || 'los proyectos técnicos bajo presión'} y tu experiencia con las tecnologías requeridas. Cuéntanos sobre una situación técnica compleja...`}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 20, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={feedbackBusy}
                  onClick={() => handleFeedback(selected, 'Hired')}
                >
                  Marcar contratado
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={feedbackBusy}
                  onClick={() => handleFeedback(selected, 'Rejected')}
                >
                  Marcar rechazado
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: 'var(--brass)', borderColor: 'var(--brass)' }}
                  onClick={() => handleExportCv(selected)}
                  title="Imprimir o guardar como PDF"
                >
                  Exportar PDF
                </button>
                {['ADMIN', 'RECRUITER'].includes(activeRole.toUpperCase()) && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setEditingCandidate(selected)}
                    >
                      Editar
                    </button>
                    {activeRole.toUpperCase() === 'ADMIN' && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ color: '#ff4d4d', borderColor: '#ff4d4d' }}
                        onClick={async () => {
                          if (window.confirm(`¿Estás seguro de que deseas eliminar al candidato ${selected.name}?`)) {
                            try {
                              if (onCandidateDeleted) {
                                onCandidateDeleted(selected.id);
                              }
                              setSelectedId(null);
                            } catch (err) {
                              alert("Error al eliminar candidato: " + err);
                            }
                          }
                        }}
                      >
                        Eliminar
                      </button>
                    )}
                  </>
                )}
              </div>
              <button type="button" className="btn btn-primary" onClick={() => setInviteFor(selected)}>
                <Send size={15} /> Enviar invitación
              </button>
            </div>
          </div>
        </div>
      )}

      {inviteFor && (
        <InviteModal
          candidate={inviteFor}
          vacancy={vacancies.find((v) => v.id === inviteFor.vacancyId)}
          onClose={() => setInviteFor(null)}
        />
      )}

      {showForm && (
        <AnalyzeCandidateForm
          vacancies={vacancies}
          initialBulkMode={initialBulkMode}
          defaultVacancyId={formTargetVacancyId || (selectedVacancyFilter !== 'all' && selectedVacancyFilter !== 'unassigned' ? selectedVacancyFilter : undefined)}
          onClose={() => {
            setShowForm(false);
            setFormTargetVacancyId(undefined);
          }}
          onCreated={(c) => {
            onCandidateCreated(c);
            setShowForm(false);
            setFormTargetVacancyId(undefined);
          }}
        />
      )}

      {editingCandidate && (
        <AnalyzeCandidateForm
          vacancies={vacancies}
          candidateToEdit={editingCandidate}
          onClose={() => setEditingCandidate(null)}
          onCreated={(c) => {
            onCandidateUpdated(c);
            setEditingCandidate(null);
          }}
        />
      )}
    </div>
  );
}

interface AnalyzeCandidateFormProps {
  vacancies: Vacancy[];
  initialBulkMode?: boolean;
  defaultVacancyId?: string;
  onClose: () => void;
  onCreated: (candidate: Candidate) => void;
  candidateToEdit?: Candidate | null;
}

function AnalyzeCandidateForm({ vacancies, initialBulkMode, defaultVacancyId, onClose, onCreated, candidateToEdit }: AnalyzeCandidateFormProps) {
  const [name, setName] = useState(candidateToEdit ? candidateToEdit.name : '');
  const [email, setEmail] = useState(candidateToEdit ? candidateToEdit.email : '');
  const [phone, setPhone] = useState(candidateToEdit ? candidateToEdit.phone : '');
  const [channel, setChannel] = useState(candidateToEdit ? candidateToEdit.channel : 'EAS Consulting DB');
  const [vacancyId, setVacancyId] = useState(candidateToEdit ? (candidateToEdit.vacancyId || 'unassigned') : (defaultVacancyId || 'unassigned'));
  const [resumeText, setResumeText] = useState(candidateToEdit ? candidateToEdit.resumeText : '');
  const [expectedSalary, setExpectedSalary] = useState(candidateToEdit ? candidateToEdit.expectedSalary ?? 30000 : 30000);
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>(candidateToEdit ? candidateToEdit.englishLevel ?? 'Medio' : 'Medio');
  const [certifications, setCertifications] = useState<string[]>(Array.isArray(candidateToEdit?.certifications) ? candidateToEdit.certifications : []);
  const [experience, setExperience] = useState<string[]>(Array.isArray(candidateToEdit?.experience) ? candidateToEdit.experience : []);
  const [education, setEducation] = useState<string[]>(Array.isArray(candidateToEdit?.education) ? candidateToEdit.education : []);
  const [userGuidanceLevel, setUserGuidanceLevel] = useState<string>(candidateToEdit?.detectedGuidanceLevel ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cvRejection, setCvRejection] = useState<string | null>(null);
  const [isBulkMode, setIsBulkMode] = useState(initialBulkMode || false);
  const [bulkProgressText, setBulkProgressText] = useState('');
  // Respuesta de /api/parse-cv. El servidor valida de forma determinista que el archivo sea un CV
  // (tipo real + estructura). Si lo rechaza (422) se informa y NO se llena el formulario; tampoco se
  // recurre al parser local del navegador, que procesaba cualquier archivo sin validar.
  const readParseCvResponse = async (parseRes: Response, fileName: string) => {
    const body = await parseRes.json().catch(() => ({}));
    if (parseRes.ok) return body;
    const reasons: string[] = Array.isArray(body.reasons) ? body.reasons : [];
    const msg = parseRes.status === 422
      ? `"${fileName}" no se procesó: ${body.error || 'no parece ser un CV'}${reasons.length ? `\n• ${reasons.join('\n• ')}` : ''}`
      : `No se pudo procesar "${fileName}" (${body.error || `HTTP ${parseRes.status}`}).`;
    throw new Error(msg);
  };

  const [bulkQueue, setBulkQueue] = useState<{ filename: string; status: 'pending' | 'parsing' | 'evaluating' | 'done' | 'error'; detail?: string }[]>([]);

  const parseFileLocallyInBrowser = async (file: File) => {
    let fileText = '';
    try {
      fileText = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.onerror = () => resolve('');
        reader.readAsText(file);
      });
    } catch (_) { }

    const cleanNameFromFile = file.name.replace(/\.[^/.]+$/, '').replace(/^[TM_\-\s]+/, '').replace(/_/g, ' ').trim();
    const name = cleanNameFromFile || 'Candidato Postulado';
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@eas-consulting.com`;
    const phone = "+52 55 " + Math.floor(10000000 + Math.random() * 90000000);

    const parsedExp: string[] = [];
    const parsedEdu: string[] = [];
    const parsedCert: string[] = [];

    if (fileText) {
      const lines = fileText.split('\n').map(l => l.trim()).filter(Boolean);
      let sec: 'exp' | 'edu' | 'cert' | 'none' = 'none';
      for (const l of lines) {
        const lower = l.toLowerCase();
        if (lower.includes('experiencia') || lower.includes('trayectoria') || lower.includes('empleos')) { sec = 'exp'; continue; }
        if (lower.includes('educación') || lower.includes('estudios') || lower.includes('formación')) { sec = 'edu'; continue; }
        if (lower.includes('certifica') || lower.includes('cursos')) { sec = 'cert'; continue; }

        if (sec === 'exp' && parsedExp.length < 3 && l.length > 5) parsedExp.push(l);
        if (sec === 'edu' && parsedEdu.length < 3 && l.length > 5) parsedEdu.push(l);
        if (sec === 'cert' && parsedCert.length < 3 && l.length > 5) parsedCert.push(l);
      }
    }

    if (parsedExp.length === 0) parsedExp.push(`Consultor / Especialista | Empresa / Proyecto | 2022 - 2026`);
    if (parsedEdu.length === 0) parsedEdu.push(`Formación Profesional / Superior | Institución Educativa (por validar en entrevista) | Periodo de estudios`);
    if (parsedCert.length === 0) parsedCert.push(`Certificación Profesional | EAS Institute | 2024`);

    const summary = `Perfil profesional de ${name} procesado para evaluación en EAS Consulting. Archivo: ${file.name}.`;

    return {
      name,
      email,
      phone,
      suggestedChannel: 'EAS Consulting DB',
      text: fileText || summary,
      summary,
      experience: parsedExp,
      education: parsedEdu,
      certifications: parsedCert
    };
  };

  const handleFileSelect = async (files: FileList) => {
    if (files.length === 0) return;

    if (files.length > 1 || isBulkMode) {
      setIsBulkMode(true);
      setLoading(true);
      setError(null);
      const queue: { filename: string; status: 'pending' | 'parsing' | 'evaluating' | 'done' | 'error'; detail?: string }[] = Array.from(files).map(f => ({ filename: f.name, status: 'pending' }));
      setBulkQueue(queue);

      const processFileItem = async (file: File, index: number) => {
        queue[index].status = 'parsing';
        setBulkQueue([...queue]);

        let parsedInfo: any = null;
        try {
          const formData = new FormData();
          formData.append('cv', file);
          const customKey = localStorage.getItem('eas_gemini_key') || '';
          const parseHeaders: Record<string, string> = {};
          if (customKey) parseHeaders['x-gemini-api-key'] = customKey;

          const parseRes = await authFetch('/api/parse-cv', {
            method: 'POST',
            headers: parseHeaders,
            body: formData
          });
          parsedInfo = await readParseCvResponse(parseRes, file.name);
        } catch (err: any) {
          console.warn(`[Bulk Parser] ${file.name} rechazado o no procesado:`, err);
          queue[index].status = 'error';
          queue[index].detail = err?.message || String(err);
          setBulkQueue([...queue]);
          return;
        }

        queue[index].status = 'evaluating';
        setBulkQueue([...queue]);

        let analyzeResult: any = null;
        try {
          const customKey = localStorage.getItem('eas_gemini_key') || '';
          const analyzeHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
          if (customKey) analyzeHeaders['x-gemini-api-key'] = customKey;

          const analyzeRes = await authFetch('/api/analyze-candidate', {
            method: 'POST',
            headers: analyzeHeaders,
            body: JSON.stringify({
              name: parsedInfo.name,
              email: parsedInfo.email,
              phone: parsedInfo.phone,
              channel: parsedInfo.suggestedChannel || 'EAS Consulting DB',
              vacancyId: (vacancyId && vacancyId !== 'unassigned') ? vacancyId : null,
              resumeText: parsedInfo.text || parsedInfo.summary,
              expectedSalary: expectedSalary,
              englishLevel: englishLevel
            })
          });

          if (analyzeRes.ok) {
            analyzeResult = await analyzeRes.json();
          }
        } catch (err) {
          console.warn(`[Bulk Analyze Fallback] Backend evaluation failed for ${parsedInfo.name}, activating local heuristic:`, err);
        }

        const vacObj = vacancies.find(v => v.id === vacancyId);
        const tempCandidateForEval = {
          name: parsedInfo.name || file.name.replace(/\.[^/.]+$/, ""),
          resumeText: parsedInfo.text || parsedInfo.summary || "",
          summary: parsedInfo.summary || "",
          experience: parsedInfo.experience || [],
          education: parsedInfo.education || [],
          certifications: parsedInfo.certifications || []
        };
        const strictLocal = calculateStrictFitScore(tempCandidateForEval, vacObj);
        const dynamicComp = calculateCandidateCompetencies(tempCandidateForEval, vacObj);
        const analyticalSum = synthesizeAnalyticalCandidateSummary(tempCandidateForEval, vacObj);

        if (!analyzeResult) {
          analyzeResult = {
            fitScore: strictLocal.fitScore,
            competencies: dynamicComp,
            summary: analyticalSum,
            strengths: strictLocal.strengths,
            growths: strictLocal.growths,
            recommendedQuestions: [
              `¿De qué forma aplicas tus conocimientos para cubrir los requerimientos de la vacante ${vacObj?.title || 'solicitada'}?`,
              "Menciona un reto técnico complejo que resolviste exitosamente.",
              "¿Cuál es tu enfoque de trabajo en equipos multidisciplinarios?"
            ],
            suggestedTime: ""
          };
        }

        const fitVal = strictLocal.fitScore;
        const newCandidate: Candidate = {
          id: `cand-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: cleanCandidateName(parsedInfo.name || file.name.replace(/\.[^/.]+$/, "")),
          email: parsedInfo.email || "candidato@eas-consulting.com",
          phone: parsedInfo.phone || "5500000000",
          resumeText: parsedInfo.text || parsedInfo.summary || "Texto del perfil profesional.",
          stage: (vacancyId === 'unassigned' || !vacancyId) ? 'Pool' : 'Filtrado',
          competencies: dynamicComp,
          fitScore: fitVal,
          initialFitScore: fitVal,
          summary: analyticalSum,
          strengths: strictLocal.strengths,
          growths: strictLocal.growths,
          recommendedQuestions: analyzeResult.recommendedQuestions || [],
          suggestedTime: "",
          channel: parsedInfo.suggestedChannel || 'EAS Consulting DB',
          createdAt: new Date().toISOString(),
          isEncrypted: false,
          vacancyId: (vacancyId && vacancyId !== 'unassigned') ? vacancyId : undefined,
          screeningQuestions: (() => {
            const baseQs = (analyzeResult.recommendedQuestions || []).slice(0, 3).map((q: string, idx: number) => ({
              id: idx + 1,
              question: q
            }));
            const fixed = [
              "¿Cuál es la disponibilidad para integrarte a la vacante?",
              "¿Cuál es el sueldo esperado?",
              "¿Dónde se ubica geográficamente?",
              "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
            ];
            return [
              ...baseQs,
              ...fixed.map((q, idx) => ({
                id: baseQs.length + idx + 1,
                question: q
              }))
            ];
          })(),
          experience: parsedInfo.experience || [],
          education: parsedInfo.education || [],
          certifications: parsedInfo.certifications || []
        };

        // Antes: si el guardado fallaba, el candidato se agregaba igual a la pantalla (nunca a la BD).
        try {
          const saved = await api.createCandidate(newCandidate);
          onCreated({ ...newCandidate, ...(saved?.candidate || {}) });
          queue[index].status = 'done';
        } catch (saveErr) {
          console.error(`No se guardó el candidato de ${file.name}:`, saveErr);
          queue[index].status = 'error';
        }
        setBulkQueue([...queue]);
      };

      const BATCH_SIZE = 2;
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = Array.from(files).slice(i, i + BATCH_SIZE);
        setBulkProgressText(`Procesando lote ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1} - ${Math.min(i + BATCH_SIZE, files.length)} de ${files.length})...`);
        await Promise.allSettled(batch.map((file, batchIdx) => processFileItem(file, i + batchIdx)));
      }

      setLoading(false);
      setBulkProgressText("¡Carga masiva de CVs completada con éxito!");
      setTimeout(() => {
        onClose();
      }, 1500);

    } else {
      setLoading(true);
      setError(null);
      setCvRejection(null);
      try {
        const file = files[0];
        let parsedInfo: any = null;
        try {
          const formData = new FormData();
          formData.append('cv', file);
          const customKey = localStorage.getItem('eas_gemini_key') || '';
          const parseHeaders: Record<string, string> = {};
          if (customKey) parseHeaders['x-gemini-api-key'] = customKey;

          const parseRes = await authFetch('/api/parse-cv', {
            method: 'POST',
            headers: parseHeaders,
            body: formData
          });
          parsedInfo = await readParseCvResponse(parseRes, file.name);
        } catch (parseErr: any) {
          setCvRejection(parseErr?.message || String(parseErr));
          return;
        }

        setName(parsedInfo.name || '');
        setEmail(parsedInfo.email || '');
        setPhone(parsedInfo.phone || '');
        setChannel(parsedInfo.suggestedChannel || 'EAS Consulting DB');
        setResumeText(parsedInfo.text || parsedInfo.summary || '');
        setExperience(parsedInfo.experience || []);
        setEducation(parsedInfo.education || []);
        setCertifications(parsedInfo.certifications || []);
        if (parsedInfo.englishLevel) setEnglishLevel(parsedInfo.englishLevel);
        if (parsedInfo.expectedSalary) setExpectedSalary(Number(parsedInfo.expectedSalary));
      } catch (err: any) {
        console.warn("Error al procesar el CV:", err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !(resumeText || '').trim() || !vacancyId) {
      setError('Nombre, CV y vacante son obligatorios.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (candidateToEdit) {
        const updateRes = await authFetch(`/api/candidates/${candidateToEdit.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            phone,
            expectedSalary,
            englishLevel,
            vacancyId,
            experience,
            education,
            certifications,
            detectedGuidanceLevel: userGuidanceLevel || undefined
          })
        });
        // Antes: `.catch(() => null)` y nunca se revisaba el status → el formulario "guardaba"
        // aunque el servidor respondiera 500.
        const updateBody = await updateRes.json().catch(() => ({}));
        if (!updateRes.ok) {
          throw new Error(`No se guardaron los cambios: ${updateBody.message || updateBody.error || `HTTP ${updateRes.status}`}`);
        }
        const updated: Candidate = {
          ...candidateToEdit,
          name,
          email: email || "candidato@eas-consulting.com",
          phone: phone || "5500000000",
          expectedSalary,
          englishLevel,
          vacancyId,
          experience,
          education,
          certifications,
          detectedGuidanceLevel: userGuidanceLevel || candidateToEdit.detectedGuidanceLevel,
          ...(updateBody.candidate || {})
        };
        onCreated(updated);
        recordAuditLog('CAMBIO_CANDIDATO', 'Candidatos', 'SUCCESS', `Actualización de perfil e información del candidato ${name}.`);
        onClose();
        return;
      }

      let analyzeResult: any = null;
      try {
        const customKey = localStorage.getItem('eas_gemini_key') || '';
        const analyzeHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (customKey) analyzeHeaders['x-gemini-api-key'] = customKey;

        const res = await authFetch('/api/analyze-candidate', {
          method: 'POST',
          headers: analyzeHeaders,
          body: JSON.stringify({
            name,
            email,
            phone,
            channel,
            vacancyId: (vacancyId && vacancyId !== 'unassigned') ? vacancyId : null,
            resumeText,
            expectedSalary,
            englishLevel
          })
        });

        if (res.ok) {
          analyzeResult = await res.json();
        }
      } catch (err) {
        console.warn("[Submit Fallback] Backend analyze failed, using local evaluator:", err);
      }

      const vacObj = vacancies.find(v => v.id === vacancyId);
      const tempCand = {
        name: cleanCandidateName(name),
        resumeText: resumeText || "",
        summary: "",
        experience,
        education,
        certifications
      };
      const strictLocal = calculateStrictFitScore(tempCand, vacObj);
      const dynamicComp = calculateCandidateCompetencies(tempCand, vacObj);
      const analyticalSum = synthesizeAnalyticalCandidateSummary(tempCand, vacObj);

      if (!analyzeResult) {
        analyzeResult = {
          fitScore: strictLocal.fitScore,
          competencies: dynamicComp,
          summary: analyticalSum,
          strengths: strictLocal.strengths,
          growths: strictLocal.growths,
          recommendedQuestions: [
            `¿Cómo demuestras de forma práctica tus habilidades para cubrir el puesto de ${vacObj?.title || 'consultor'}?`,
            "Describe un reto técnico complejo en tu trayectoria previa.",
            "¿Cuál es tu estrategia de colaboración en proyectos bajo presión?"
          ],
          suggestedTime: ""
        };
      }

      const fitVal = strictLocal.fitScore;
      const fallbackEmail = name.trim() ? `${cleanCandidateName(name).toLowerCase().replace(/[^a-z0-9\.]/g, '')}@eas-consulting.com` : `candidato-${Date.now()}@eas-consulting.com`;
      const newCandidate: Candidate = {
        id: `cand-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: cleanCandidateName(name),
        email: email.trim() || fallbackEmail,
        phone: phone || "5500000000",
        resumeText: resumeText || "Texto del perfil profesional.",
        stage: (vacancyId === 'unassigned' || !vacancyId) ? 'Pool' : 'Filtrado',
        competencies: dynamicComp,
        fitScore: fitVal,
        initialFitScore: fitVal,
        summary: analyticalSum,
        strengths: strictLocal.strengths,
        growths: strictLocal.growths,
        recommendedQuestions: analyzeResult.recommendedQuestions || [],
        suggestedTime: "",
        channel: channel as any,
        createdAt: new Date().toISOString(),
        isEncrypted: false,
        vacancyId: (vacancyId && vacancyId !== 'unassigned') ? vacancyId : undefined,
        screeningQuestions: (() => {
          const baseQs = (analyzeResult.recommendedQuestions || []).slice(0, 3).map((q: string, idx: number) => ({
            id: idx + 1,
            question: q
          }));
          const fixed = [
            "¿Cuál es la disponibilidad para integrarse a la vacante?",
            "¿Cuál es el sueldo esperado?",
            "¿Dónde se ubica geográficamente?",
            "¿En qué modalidad de trabajo prefiere colaborar (presencial, híbrido o remoto)?"
          ];
          return [
            ...baseQs,
            ...fixed.map((q, idx) => ({
              id: baseQs.length + idx + 1,
              question: q
            }))
          ];
        })(),
        experience,
        education,
        certifications,
        detectedGuidanceLevel: userGuidanceLevel || undefined
      };

      // Si falla, el error llega al catch de abajo y se muestra en el formulario (antes se ocultaba).
      const savedRes = await api.createCandidate(newCandidate);
      onCreated({ ...newCandidate, ...(savedRes?.candidate || {}) });
      recordAuditLog('ALTA_CANDIDATO', 'Candidatos', 'SUCCESS', `Alta / Registro de candidato ${newCandidate.name} (${newCandidate.email}).`);
      onClose();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
        setError('No se pudo conectar con el servidor backend / servicio de IA. Asegúrate de que el servidor backend (puerto 3000) esté en ejecución.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel glass-panel" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0 }}>
            <Sparkles size={17} style={{ verticalAlign: -3, marginRight: 6, color: 'var(--brass-light)' }} />
            {candidateToEdit ? 'Editar candidato' : 'Analizar candidato con IA'}
          </h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Selección de Vacante Objetivo para Carga (Individual o Masiva) */}
        {!candidateToEdit && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="bulk-target-vacancy" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--text-medium)' }}>
              Vacante destino para los candidatos cargados:
            </label>
            <select
              id="bulk-target-vacancy"
              value={vacancyId}
              onChange={(e) => setVacancyId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                fontSize: 13
              }}
            >
              <option value="unassigned">Talent Pool General (Sin vacante asignada)</option>
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title} ({v.department || v.area || 'General'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Drag and Drop Zone */}
        {!candidateToEdit && (
          <div
            style={{
              border: '2px dashed rgba(255,255,255,0.15)',
              borderRadius: 10,
              padding: '20px 16px',
              textAlign: 'center',
              backgroundColor: 'rgba(0,0,0,0.15)',
              marginBottom: 16,
              cursor: 'pointer'
            }}
            onClick={() => document.getElementById('cv-file-picker')?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) {
                handleFileSelect(e.dataTransfer.files);
              }
            }}
          >
            <UploadCloud size={28} style={{ color: 'var(--brass)', marginBottom: 6, display: 'inline-block' }} />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 'bold' }}>Arrastra tus archivos de CV aquí (PDF, Word o TXT)</p>
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-low)' }}>Soporta carga masiva de múltiples archivos simultáneamente</p>
            <input
              id="cv-file-picker"
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) handleFileSelect(e.target.files);
              }}
            />
          </div>
        )}

        {cvRejection && (
          <div role="alert" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#991b1b', fontSize: 12.5, whiteSpace: 'pre-line', lineHeight: 1.45 }}>
            <strong>[Archivo rechazado]</strong> {cvRejection}
          </div>
        )}

        {isBulkMode ? (
          <div className="card" style={{ padding: 12, backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 'bold', margin: '0 0 8px' }}>Procesamiento Masivo</h4>
            <div style={{ fontSize: 12, color: 'var(--brass-light)', marginBottom: 10, fontWeight: 'bold' }}>
              {bulkProgressText}
            </div>
            <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 6, backgroundColor: '#000' }}>
              {bulkQueue.map((item: { filename: string; status: 'pending' | 'parsing' | 'evaluating' | 'done' | 'error'; detail?: string }, idx: number) => (
                <div key={idx} style={{ fontSize: 11.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{item.filename}</span>
                  <span style={{
                    fontWeight: 'bold',
                    color: item.status === 'done' ? 'var(--success)' : item.status === 'error' ? 'var(--danger)' : 'var(--brass)'
                  }}>
                    {item.status === 'pending' && 'En cola'}
                    {item.status === 'parsing' && 'Parseando...'}
                    {item.status === 'evaluating' && 'Evaluando IA...'}
                    {item.status === 'done' && 'Completado'}
                    {item.status === 'error' && 'Rechazado'}
                  </span>
                  {item.status === 'error' && item.detail && (
                    <div style={{ flexBasis: '100%', color: 'var(--danger)', fontSize: 11, whiteSpace: 'pre-line', marginTop: 2 }}>{item.detail}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="c-name">Nombre completo</label>
                <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="c-vacancy">Vacante objetivo</label>
                <select id="c-vacancy" value={vacancyId} onChange={(e) => setVacancyId(e.target.value)} required>
                  <option value="" disabled>
                    Selecciona una vacante
                  </option>
                  <option value="unassigned">⭐ Talent Pool (Sin vacante asignada)</option>
                  {vacancies.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="c-email">Correo</label>
                <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="c-phone">Teléfono</label>
                <input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="c-channel">Canal de origen</label>
                <select id="c-channel" value={channel} onChange={(e) => setChannel(e.target.value as any)}>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="OCC">OCC</option>
                  <option value="Redes Sociales">Redes Sociales</option>
                  <option value="Glassdoor">Glassdoor</option>
                  <option value="Referido">Referido</option>
                  <option value="EAS Consulting DB">EAS Consulting DB</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="c-english">Nivel de inglés declarado</label>
                <select id="c-english" value={englishLevel} onChange={(e) => setEnglishLevel(e.target.value as EnglishLevel)}>
                  <option value="Básico">Básico</option>
                  <option value="Medio">Medio</option>
                  <option value="Avanzado">Avanzado</option>
                </select>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="c-salary">Sueldo pretendido (MXN)</label>
                <input
                  id="c-salary"
                  type="number"
                  min={0}
                  value={expectedSalary}
                  onChange={(e) => setExpectedSalary(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="c-guidance-level">Nivel Guía de Puesto (Perfil Puesto Guias)</label>
                <select id="c-guidance-level" value={userGuidanceLevel} onChange={(e) => setUserGuidanceLevel(e.target.value)}>
                  <option value="">IA Automático (Heurística de CV)</option>
                  <option value="Becario">Becario (Rango 1 - 0 a 1 año exp)</option>
                  <option value="Jr. C">Jr. C (Rango 2 - 0.5 a 1.5 años exp)</option>
                  <option value="Jr.B">Jr. B (Rango 3 - 1 a 2 años exp)</option>
                  <option value="Consultor A">Consultor A (Rango 4 - 1 a 3 años exp)</option>
                  <option value="Senior B">Senior B (Rango 5 - 3 a 5 años exp)</option>
                  <option value="Senior A">Senior A (Rango 6 - 5 a 7 años exp)</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="c-resume">Texto del CV</label>
              <textarea
                id="c-resume"
                rows={4}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Pega aquí el contenido del currículum o arrastra un archivo..."
                required
              />
            </div>

            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="c-exp">💼 Experiencia Laboral / Empleos (Un empleo por línea)</label>
              <textarea
                id="c-exp"
                rows={3}
                value={(Array.isArray(experience) ? experience : []).join('\n')}
                onChange={(e) => setExperience(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                placeholder="Ej. Consultor SAP Senior en DXC Technology (2022-2025)"
              />
            </div>

            <div className="field-row" style={{ marginTop: 10 }}>
              <div className="field">
                <label htmlFor="c-edu">🎓 Educación & Grados Académicos (Un logro por línea)</label>
                <textarea
                  id="c-edu"
                  rows={2}
                  value={(Array.isArray(education) ? education : []).join('\n')}
                  onChange={(e) => setEducation(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                  placeholder="Ej. Licenciatura / Ing. en Sistemas - UNAM"
                />
              </div>
              <div className="field">
                <label htmlFor="c-cert">📜 Certificaciones & Cursos (Certificación | Institución | Año)</label>
                <textarea
                  id="c-cert"
                  rows={2}
                  value={(Array.isArray(certifications) ? certifications : []).join('\n')}
                  onChange={(e) => setCertifications(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                  placeholder="Certificación: Scrum Master PSM I | Institución: Scrum.org | Año: 2023"
                />
              </div>
            </div>

            {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (candidateToEdit ? 'Guardando...' : 'Analizando con IA...') : (candidateToEdit ? 'Guardar Cambios' : 'Analizar con IA')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
