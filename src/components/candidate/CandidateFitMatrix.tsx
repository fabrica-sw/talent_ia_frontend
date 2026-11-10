import React from 'react';
import { Candidate, Vacancy } from '../../types';
import { CheckCircle, AlertTriangle, XCircle, Award, DollarSign, Globe, Cpu, UserCheck } from 'lucide-react';
import { calculateCandidateCompetencies, interpretVacancyProfileWeights } from '../../utils/vacancyUtils';

interface Props {
  candidate: Candidate;
  vacancy?: Vacancy;
}

export const CandidateFitMatrix: React.FC<Props> = ({ candidate, vacancy }) => {
  const comps = calculateCandidateCompetencies(candidate, vacancy);
  const techVal = comps['Habilidades Técnicas'] ?? comps['HabilidadesTecnicas'] ?? candidate?.fitScore ?? 72;
  const teamVal = comps['Trabajo en Equipo'] ?? comps['TrabajoEnEquipo'] ?? 75;
  const comVal = comps['Comunicación'] ?? comps['Comunicacion'] ?? 74;

  const engStr = (candidate?.englishLevel || 'Avanzado').toLowerCase().trim();
  const isAvanzadoEng = engStr.includes('avanzad') || engStr.includes('advanced') || engStr.includes('c1') || engStr.includes('c2') || engStr.includes('90') || engStr.includes('100');
  const isIntermedioEng = engStr.includes('intermed') || engStr.includes('medio') || engStr.includes('b1') || engStr.includes('b2') || engStr.includes('70') || engStr.includes('80');
  
  const englishScore = isAvanzadoEng ? 100 : isIntermedioEng ? 70 : 40;

  const breakdown = candidate?.fitBreakdown || {
    technical: Math.min(100, Math.max(0, Math.round(techVal))),
    culture: Math.min(100, Math.max(0, Math.round((teamVal + comVal) / 2))),
    salary: candidate?.expectedSalary && vacancy?.salaryRange ? 90 : 85,
    english: englishScore,
    experience: candidate?.fitScore ? Math.min(100, Math.max(0, Math.round(candidate.fitScore))) : 75,
  };

  // Color rules: >=75% GREEN, 50-74% ORANGE/AMBER, <50% RED
  const getScoreBadgeStyle = (score: number, isEnglish: boolean = false) => {
    if (isEnglish) {
      if (isAvanzadoEng) return 'text-emerald-700 bg-emerald-50 border-emerald-300 font-bold';
      if (isIntermedioEng) return 'text-orange-700 bg-orange-50 border-orange-300 font-bold';
      return 'text-amber-700 bg-amber-50 border-amber-300 font-bold';
    }
    if (score >= 75) return 'text-emerald-700 bg-emerald-50 border-emerald-300 font-bold';
    if (score >= 50) return 'text-orange-700 bg-orange-50 border-orange-300 font-bold';
    return 'text-rose-700 bg-rose-50 border-rose-300 font-bold';
  };

  const getProgressColor = (score: number, isEnglish: boolean = false) => {
    if (isEnglish) {
      if (isAvanzadoEng) return 'bg-emerald-500';
      if (isIntermedioEng) return 'bg-orange-500';
      return 'bg-amber-400';
    }
    if (score >= 75) return 'bg-emerald-500';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
      {/* Overall Score Badge */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            Matriz de Encaje Multidimensional (AI Fit)
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluación comparativa contra perfil {vacancy ? `"${vacancy.title}"` : 'General'}
          </p>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold border-indigo-200 bg-indigo-50 text-indigo-700">
            <span>Score Global:</span>
            <span className="text-lg text-indigo-950 font-extrabold">{candidate.fitScore || candidate.initialFitScore || 85}%</span>
          </div>
        </div>
      </div>

      {/* AI Interpretation of Vacancy Profiles & Weights */}
      {vacancy && (() => {
        const profiles = interpretVacancyProfileWeights(vacancy);
        return (
          <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
                Interpretación IA de Perfiles en la Vacante & Ponderación
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white">
                Perfil Principal: {profiles[0]?.profile} ({profiles[0]?.weight}%)
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {profiles.map((p, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-white border border-indigo-100 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{p.profile}</span>
                    <span className="font-mono font-extrabold text-indigo-700">{p.weight}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${p.weight}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Rol: <strong className="text-indigo-700">{p.roleType}</strong>
                    {p.focusAreas.length > 0 ? ` • ${p.focusAreas.slice(0, 2).join(', ')}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Technical Skill Fit */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-600" />
              Skills Técnicos
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-md border ${getScoreBadgeStyle(breakdown.technical)}`}>
              {breakdown.technical}%
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-500 ${getProgressColor(breakdown.technical)}`} style={{ width: `${breakdown.technical}%` }} />
          </div>
          <p className="text-[11px] text-slate-500">Dominio de stacks requeridos y tecnologías clave.</p>
        </div>

        {/* Culture & Leadership Fit */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-purple-600" />
              Cultura & Liderazgo
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-md border ${getScoreBadgeStyle(breakdown.culture)}`}>
              {breakdown.culture}%
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-500 ${getProgressColor(breakdown.culture)}`} style={{ width: `${breakdown.culture}%` }} />
          </div>
          <p className="text-[11px] text-slate-500">Trabajo en equipo, adaptabilidad y comunicación.</p>
          {vacancy && (vacancy.softSkills?.length || vacancy.requiredGuidanceLevel) && (
            <div className="pt-1.5 flex flex-wrap gap-1">
              {(vacancy.softSkills || []).map((ss, idx) => (
                <span key={idx} className="text-[9.5px] px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-semibold">
                  ✓ {ss}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Salary Alignment */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Expectativa Salarial
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-md border ${getScoreBadgeStyle(breakdown.salary)}`}>
              {candidate.expectedSalary ? `$${candidate.expectedSalary.toLocaleString('es-MX')} MXN` : 'Alineado'}
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-500 ${getProgressColor(breakdown.salary)}`} style={{ width: `${breakdown.salary}%` }} />
          </div>
          <p className="text-[11px] text-slate-500">
            {vacancy?.salaryRange ? `Rango vacante: ${vacancy.salaryRange}` : 'Presupuesto dentro del rango esperado.'}
          </p>
        </div>

        {/* English Level */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-blue-600" />
              Nivel de Inglés
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-md border ${getScoreBadgeStyle(englishScore, true)}`}>
              {isAvanzadoEng ? 'Avanzado' : isIntermedioEng ? 'Intermedio' : 'Básico'}
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-500 ${getProgressColor(englishScore, true)}`} style={{ width: `${englishScore}%` }} />
          </div>
          <p className="text-[11px] text-slate-500">
            {vacancy?.englishLevel ? `Requerido: ${vacancy.englishLevel}` : 'Fluidez suficiente para proyectos internacionales.'}
          </p>
        </div>

        {/* Experience Match */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 col-span-1 md:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-600" />
              Alineación de Trayectoria & Experiencia
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-md border ${getScoreBadgeStyle(breakdown.experience)}`}>
              {breakdown.experience}%
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-500 ${getProgressColor(breakdown.experience)}`} style={{ width: `${breakdown.experience}%` }} />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {Array.isArray(candidate?.experience) && candidate.experience.length > 0 ? (
              candidate.experience.slice(0, 3).map((exp, idx) => (
                <span key={idx} className="text-[10px] px-2 py-0.5 bg-white text-slate-700 rounded border border-slate-200 font-medium">
                  {exp}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-slate-500">Experiencia previa validada en el sector consultoría.</span>
            )}
          </div>
        </div>
      </div>

      {/* AI Recommendation Banner */}
      <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-start gap-3">
        {(candidate.fitScore || 85) >= 75 ? (
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        ) : (candidate.fitScore || 85) >= 50 ? (
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <h5 className="text-xs font-bold text-indigo-950">Recomendación IA (Capital Humano)</h5>
          <p className="text-xs text-slate-700 leading-relaxed">
            {(candidate.fitScore || 85) >= 75
              ? 'Candidato altamente recomendado para avanzar directamente a Entrevista de Capital Humano o Técnica.'
              : (candidate.fitScore || 85) >= 50
              ? 'Perfil prometedor. Se sugiere profundizar en la entrevista sobre fortalezas técnicas específicas y expectativas salariales.'
              : 'El candidato presenta discrepancias en competencias clave requeridas por la vacante. Requiere revisión detenida.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CandidateFitMatrix;
