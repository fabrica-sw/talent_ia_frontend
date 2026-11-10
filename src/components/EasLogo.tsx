import React from 'react';
import logoUrl from '../eas_logo.png';

interface EasLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showText?: boolean;
}

export const EasLogo: React.FC<EasLogoProps> = ({
  className = 'h-10',
  showText = true,
}) => {
  const logoSrc = logoUrl || '/eas_logo.png';

  if (!showText) {
    // Recorte de precisión para mostrar únicamente el isotipo circular cuando el sidebar está colapsado
    return (
      <div 
        className="overflow-hidden relative flex items-center justify-start shrink-0 rounded-full" 
        style={{ width: '44px', height: '44px' }}
      >
        <img 
          src={logoSrc} 
          onError={(e) => { e.currentTarget.src = '/eas_logo.png'; }}
          alt="EAS Logo Isotipo" 
          className="absolute max-w-none" 
          style={{ 
            height: '44px', 
            left: '0px',
            top: '0px'
          }} 
        />
      </div>
    );
  }

  // Logotipo institucional completo (isotipo + texto)
  return (
    <div className={`flex items-center shrink-0 ${className}`}>
      <img 
        src={logoSrc} 
        onError={(e) => { e.currentTarget.src = '/eas_logo.png'; }}
        alt="EAS Consulting Logotipo" 
        className="h-full w-auto object-contain" 
        style={{ maxHeight: '44px' }}
      />
    </div>
  );
};
export default EasLogo;
