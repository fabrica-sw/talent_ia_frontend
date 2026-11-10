/**
 * Copia texto al portapapeles de forma universal y robusta.
 * Soporta tanto entornos seguros (HTTPS / localhost con navigator.clipboard)
 * como entornos HTTP sin certificado (ej: http://easconsulting.fortiddns.com:3000)
 * utilizando el fallback con document.execCommand('copy').
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Intentar API moderna navigator.clipboard (solo funciona en contextos seguros: HTTPS o localhost)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText falló, intentando método de respaldo:', err);
    }
  }

  // 2. Método de respaldo para entornos HTTP no seguros
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (successful) return true;
  } catch (fallbackErr) {
    console.error('[Clipboard] Error en método de respaldo de copia:', fallbackErr);
  }

  return false;
}
