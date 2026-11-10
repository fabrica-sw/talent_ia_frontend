import React, { useState, useEffect } from 'react';
import { api, authFetch } from '../api';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  UploadCloud, 
  CheckCircle, 
  ChevronRight, 
  FileText, 
  ArrowLeft, 
  Loader2,
  AlertTriangle,
  Clock,
  Compass,
  MapPin,
  DollarSign
} from 'lucide-react';
import { Vacancy } from '../types';
import EasLogo from './EasLogo';

interface CareersPortalProps {
  vacancies: Vacancy[];
  onApplicationComplete: (newCandidate: any) => void;
}

export default function CareersPortal({ vacancies: vacanciesProp, onApplicationComplete }: CareersPortalProps) {
  // El portal es público: carga las vacantes del endpoint público (la API interna exige login).
  const [vacancies, setVacancies] = useState<Vacancy[]>(vacanciesProp);
  useEffect(() => {
    api.getPublicVacancies()
      .then(res => setVacancies(res.vacancies || []))
      .catch(err => console.error('No se pudieron cargar las vacantes públicas:', err));
  }, []);
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsingError, setParsingError] = useState<string | null>(null);
  
  // Applicant details from CV parsing
  const [candidateData, setCandidateData] = useState<{
    name: string;
    email: string;
    phone: string;
    role: string;
    resumeText: string;
    screeningQuestions: { id: number; question: string; answer?: string }[];
  } | null>(null);

  const [currentStep, setCurrentStep] = useState<'list' | 'upload' | 'questions' | 'success'>('list');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const handleSelectJob = (job: Vacancy) => {
    setSelectedVacancy(job);
    setCurrentStep('upload');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.txt')) {
        setCvFile(file);
      } else {
        setParsingError('Solo se admiten archivos .pdf, .docx o .txt');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCvFile(e.target.files[0]);
    }
  };

  const handleUploadCV = async () => {
    if (!cvFile || !selectedVacancy) return;

    setIsParsing(true);
    setParsingError(null);

    const formData = new FormData();
    formData.append('cv', cvFile);
    formData.append('vacancyTitle', selectedVacancy.title);
    formData.append('vacancyRequirements', JSON.stringify(selectedVacancy.requirements));

    try {
      const response = await authFetch('/api/candidates/apply', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        // 422 = el servidor determinó que el archivo no es un CV (o no tiene texto legible)
        const reasons: string[] = Array.isArray(data.reasons) ? data.reasons : [];
        throw new Error(`${data.error || 'No se pudo procesar el archivo.'}${reasons.length ? '\n• ' + reasons.join('\n• ') : ''}`);
      }

      setCandidateData({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        role: data.role || selectedVacancy.title,
        resumeText: data.resumeText || '',
        screeningQuestions: data.screeningQuestions || []
      });
      setCurrentStep('questions');
    } catch (err) {
      console.error(err);
      setParsingError((err as Error)?.message || 'Ocurrió un error leyendo tu currículum. Por favor intenta de nuevo.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAnswerChange = (questionId: number, val: string) => {
    if (!candidateData) return;
    const updatedQs = candidateData.screeningQuestions.map(q => 
      q.id === questionId ? { ...q, answer: val } : q
    );
    setCandidateData({
      ...candidateData,
      screeningQuestions: updatedQs
    });
  };

  const handleSubmitApplication = async () => {
    if (!candidateData || !selectedVacancy) return;

    // Validate that all questions are answered
    const unanswered = candidateData.screeningQuestions.some(q => !q.answer || !q.answer.trim());
    if (unanswered) {
      alert('Por favor responde todas las preguntas del cuestionario de screening.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authFetch('/api/candidates/submit-screening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: candidateData.name,
          email: candidateData.email,
          phone: candidateData.phone,
          role: candidateData.role,
          resumeText: candidateData.resumeText,
          vacancy: selectedVacancy,
          answers: candidateData.screeningQuestions
        })
      });

      if (!response.ok) {
        throw new Error('Fallo al enviar el screening.');
      }

      const finalCheck = await response.json();

      const newCandidate = {
        id: 'cand_' + Math.floor(Math.random() * 1000000),
        name: candidateData.name,
        email: candidateData.email,
        phone: candidateData.phone,
        resumeText: candidateData.resumeText,
        stage: 'screening', // Se coloca en la fase "Cribado por IA" directamente
        fitScore: finalCheck.fitScore,
        competencies: finalCheck.competencies,
        summary: finalCheck.summary,
        strengths: finalCheck.strengths,
        growths: finalCheck.growths,
        recommendedQuestions: finalCheck.recommendedQuestions || [],
        suggestedTime: "",
        doubleCheckReport: finalCheck.doubleCheckReport,
        interviewSpeech: finalCheck.interviewSpeech,
        screeningQuestions: candidateData.screeningQuestions,
        channel: 'Otros' as const,
        createdAt: new Date().toISOString(),
        isEncrypted: false,
        vacancyId: selectedVacancy.id
      };

      // Antes: la postulación solo se agregaba al estado del navegador del POSTULANTE y nunca
      // llegaba a la base de datos del reclutador. Ahora se registra en el servidor.
      await api.submitPublicApplication({
        name: newCandidate.name,
        email: newCandidate.email,
        phone: newCandidate.phone,
        resumeText: newCandidate.resumeText,
        vacancyId: selectedVacancy.id,
        fitScore: newCandidate.fitScore,
        competencies: newCandidate.competencies,
        summary: newCandidate.summary,
        strengths: newCandidate.strengths,
        growths: newCandidate.growths,
        doubleCheckReport: newCandidate.doubleCheckReport,
        screeningQuestions: newCandidate.screeningQuestions
      });

      onApplicationComplete(newCandidate);
      setCurrentStep('success');
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al procesar tu cuestionario. Por favor intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeJobs = vacancies.filter(v => v.status === 'Open' || v.status === 'Activa');

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased">
      {/* Careers Header */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-8 py-5 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <EasLogo className="w-8 h-8 text-rose-500" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-none">EAS Consulting Group</h1>
            <span className="text-xs text-rose-500 font-semibold uppercase tracking-wider">Portal de Oportunidades</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="h-4 w-4 text-rose-500" />
          <span>Postulaciones en línea 24/7</span>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {currentStep === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div className="text-center space-y-3 max-w-xl mx-auto">
                <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400">
                  <Compass className="h-8 w-8" />
                </div>
                <h2 className="text-3xl font-black text-white">Únete a Nuestro Equipo</h2>
                <p className="text-slate-400 text-sm">
                  Explora las posiciones activas en EAS Consulting. Sube tu currículum, realiza nuestro filtro impulsado por Inteligencia Artificial y acelera tu proceso de contratación.
                </p>
              </div>

              <div className="grid gap-4">
                {activeJobs.length === 0 ? (
                  <div className="text-center py-12 border border-slate-800 bg-slate-950/40 rounded-2xl text-slate-400">
                    <Briefcase className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                    <p className="text-sm font-semibold">No hay posiciones vacantes publicadas en este momento.</p>
                  </div>
                ) : (
                  activeJobs.map(job => (
                    <div 
                      key={job.id}
                      onClick={() => handleSelectJob(job)}
                      className="group p-6 bg-slate-950/60 border border-slate-800 hover:border-rose-500/60 rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-rose-950/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-rose-500/15 text-rose-400">
                            {job.department}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <MapPin className="h-3 w-3 text-slate-500" />
                            {job.location} ({job.modalidad || 'Presencial'})
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-white group-hover:text-rose-400 transition-colors">
                          {job.title}
                        </h3>
                        <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                          {job.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 self-end md:self-auto text-rose-400 group-hover:translate-x-1.5 transition-transform duration-300 font-bold text-xs bg-slate-900 border border-slate-800 group-hover:bg-rose-500 group-hover:text-white group-hover:border-rose-500 px-4 py-2.5 rounded-xl shrink-0">
                        Postularse
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {currentStep === 'upload' && selectedVacancy && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 max-w-xl mx-auto w-full"
            >
              <button 
                onClick={() => setCurrentStep('list')}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver a vacantes
              </button>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div>
                  <span className="text-[10px] text-rose-400 uppercase tracking-widest font-black">Postulación para:</span>
                  <h3 className="text-xl font-extrabold text-white">{selectedVacancy.title}</h3>
                  <p className="text-slate-400 text-xs mt-1">{selectedVacancy.department} • {selectedVacancy.location}</p>
                </div>

                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                    dragOver 
                      ? 'border-rose-500 bg-rose-500/10' 
                      : cvFile 
                        ? 'border-emerald-500/60 bg-emerald-500/5' 
                        : 'border-slate-800 hover:border-rose-500/40 bg-slate-900/30'
                  }`}
                >
                  <input 
                    type="file" 
                    id="cvInput" 
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                  <label htmlFor="cvInput" className="cursor-pointer space-y-3 block">
                    <div className={`inline-flex p-3 rounded-full ${cvFile ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      <UploadCloud className="h-8 w-8" />
                    </div>
                    {cvFile ? (
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-emerald-400">¡Currículum cargado correctamente!</p>
                        <p className="text-xs text-slate-300 font-mono">{cvFile.name}</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">Haz clic para subir o arrastra tu CV aquí</p>
                        <p className="text-xs text-slate-500">Soporta formatos PDF, DOCX o TXT (Máx. 10MB)</p>
                      </div>
                    )}
                  </label>
                </div>

                {parsingError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span style={{ whiteSpace: 'pre-line' }}>{parsingError}</span>
                  </div>
                )}

                <button
                  onClick={handleUploadCV}
                  disabled={!cvFile || isParsing}
                  className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-sm transition-all duration-300 flex justify-center items-center gap-2 shadow-lg shadow-rose-950/10"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analizando CV con EAS AI...
                    </>
                  ) : (
                    'Siguiente: Cuestionario de Screening'
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 'questions' && candidateData && selectedVacancy && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 max-w-xl mx-auto w-full"
            >
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div>
                  <span className="text-[10px] text-rose-400 uppercase tracking-widest font-black">Cuestionario IA de Validación</span>
                  <h3 className="text-xl font-extrabold text-white">Hola, {candidateData.name}</h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Nuestro motor de inteligencia artificial ha analizado tu CV y ha preparado 3 preguntas específicas basadas en tu perfil para el puesto de **{selectedVacancy.title}**.
                  </p>
                </div>

                <div className="space-y-4">
                  {candidateData.screeningQuestions.map((q, idx) => (
                    <div key={q.id} className="space-y-2">
                      <label className="text-xs font-bold text-slate-200 block">
                        {idx + 1}. {q.question}
                      </label>
                      <textarea
                        rows={3}
                        value={q.answer || ''}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        placeholder="Escribe tu respuesta con la mayor claridad posible..."
                        className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/40 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 transition-all outline-none resize-none"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSubmitApplication}
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-sm transition-all duration-300 flex justify-center items-center gap-2 shadow-lg shadow-rose-950/10"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando Doble Validación...
                    </>
                  ) : (
                    'Finalizar Postulación'
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 max-w-md mx-auto py-12"
            >
              <div className="inline-flex p-4 rounded-full bg-emerald-500/10 text-emerald-400">
                <CheckCircle className="h-16 w-16" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white">¡Postulación Enviada con Éxito!</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Gracias por postularte en EAS Consulting Group. Nuestro motor de Inteligencia Artificial ha evaluado tu perfil y ha guardado tu ficha de evaluación en nuestro pipeline.
                </p>
                <p className="text-slate-400 text-xs">
                  Si tu perfil es compatible, uno de nuestros consultores se pondrá en contacto contigo muy pronto.
                </p>
              </div>
              <button
                onClick={() => {
                  setCvFile(null);
                  setCandidateData(null);
                  setSelectedVacancy(null);
                  setCurrentStep('list');
                }}
                className="px-6 py-2.5 rounded-xl border border-slate-800 hover:border-rose-500/50 hover:bg-rose-500/5 text-slate-300 hover:text-white text-xs font-bold transition-all"
              >
                Volver a la bolsa de trabajo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* Footer */}
      <footer className="py-6 border-t border-slate-800 text-center text-[10px] text-slate-600">
        © 2026 EAS Consulting Group • Todos los derechos reservados bajo la Ley Federal de Protección de Datos Personales (LFPDPPP).
      </footer>
    </div>
  );
}
