import { useState } from 'react';
import { X, Copy, Check, MessageCircle, Mail } from 'lucide-react';
import type { Candidate, Vacancy } from '../types';

import { copyToClipboard } from '../utils/clipboardUtils';

interface InviteModalProps {
  candidate: Candidate;
  vacancy: Vacancy | undefined;
  onClose: () => void;
}

function buildSchedulingLink(candidate: Candidate): string {
  const base = window.location.origin;
  const params = new URLSearchParams({ candidate: candidate.id, role: candidate.vacancyId || '' });
  return `${base}/agendar?${params.toString()}`;
}

function CopyableBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      setCopied(false);
    }
  }

  return (
    <div className="template-box">
      {text}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button type="button" className="btn btn-secondary" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copiado' : 'Copiar plantilla'}
        </button>
      </div>
    </div>
  );
}

export default function InviteModal({ candidate, vacancy, onClose }: InviteModalProps) {
  const schedulingLink = buildSchedulingLink(candidate);
  const firstName = candidate.name.split(' ')[0];

  const whatsappTemplate = `Hola ${firstName}, ¡gracias por tu interés en EAS Consulting! 👋

Nos encantaría conocerte mejor para la posición de *${vacancy?.title || 'la vacante'}*. Tu perfil destacó en nuestro proceso de análisis inicial.

Nos pondremos en contacto contigo próximamente por este medio para coordinar tu fecha y hora de entrevista y dar continuidad a tu proceso. ¡Mucho éxito!`;

  const emailSubject = `EAS Consulting — Siguiente paso en tu proceso: ${vacancy?.title || 'la vacante'}`;
  const emailTemplate = `Estimado(a) ${candidate.name},

Gracias por participar en nuestro proceso de selección para la posición de ${vacancy?.title || 'la vacante'}${
    vacancy ? ` en el departamento de ${vacancy.department}` : ''
  }.

Hemos revisado tu perfil y nos gustaría dar continuidad a tu proceso. Nos pondremos en contacto contigo próximamente para coordinar y agendar la fecha y hora de nuestra sesión de entrevista.

Quedamos atentos a cualquier duda.

Saludos cordiales,
Equipo de Talento — EAS Consulting`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0 }}>Enviar invitación</h2>
            <p style={{ fontSize: 13, color: 'var(--text-mid)', margin: '4px 0 0' }}>{candidate.name}</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <MessageCircle size={15} color="var(--teal)" />
          <strong style={{ fontSize: 13 }}>WhatsApp</strong>
        </div>
        <CopyableBlock text={whatsappTemplate} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 10px' }}>
          <Mail size={15} color="var(--brass-light)" />
          <strong style={{ fontSize: 13 }}>Correo electrónico</strong>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-low)', margin: '0 0 6px' }}>Asunto: {emailSubject}</p>
        <CopyableBlock text={emailTemplate} />

        <hr className="divider" />
        <p style={{ fontSize: 11.5, color: 'var(--text-low)' }}>
          El enlace de auto-agendamiento se genera dinámicamente por candidato y precarga su ficha en el panel de Agenda al ser
          seleccionado.
        </p>
      </div>
    </div>
  );
}
