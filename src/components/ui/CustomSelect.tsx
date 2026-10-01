// ============================================================================
// MICRODB STUDIO - CUSTOM SELECT COMPONENT (MODERNO, ELEGANTE Y FLOTANTE)
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  variant?: 'emerald' | 'sky' | 'violet' | 'default';
  size?: 'sm' | 'md';
  disabled?: boolean;
  dropUp?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className = '',
  variant = 'default',
  size = 'md',
  disabled = false,
  dropUp = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    dropUp: boolean;
  }>({ top: 0, left: 0, width: 0, dropUp: false });

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption =
    options.find((opt) => opt.value === value) ||
    options.find((opt) => opt.value.toLowerCase() === (value || '').toLowerCase()) ||
    (value ? { value, label: value } : undefined);

  // Calcular y actualizar coordenadas de posicionamiento flotante
  const updateCoords = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // Si el elemento fue scrolleado fuera de la pantalla, cerramos el select
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldDropUp = dropUp || (spaceBelow < 220 && spaceAbove > spaceBelow);

    const width = Math.max(rect.width, 180);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }

    setCoords({
      top: shouldDropUp ? rect.top - 6 : rect.bottom + 6,
      left,
      width,
      dropUp: shouldDropUp
    });
  };

  // Actualizar posición en resize o scroll
  useEffect(() => {
    if (!isOpen) return;

    updateCoords();

    const handleScrollOrResize = () => {
      updateCoords();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, dropUp]);

  // Cerrar al hacer clic fuera del componente (tanto del trigger como del menú en portal)
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Estilos según la variante activa
  const variantStyles = {
    emerald: {
      borderFocus: 'border-emerald-500/80 shadow-emerald-500/20',
      activeItem: 'bg-emerald-500/15 text-emerald-300 font-semibold',
      hoverItem: 'hover:bg-emerald-500/10 hover:text-emerald-200',
      checkIcon: 'text-emerald-400',
      triggerHover: 'hover:border-emerald-500/50'
    },
    sky: {
      borderFocus: 'border-sky-500/80 shadow-sky-500/20',
      activeItem: 'bg-sky-500/15 text-sky-300 font-semibold',
      hoverItem: 'hover:bg-sky-500/10 hover:text-sky-200',
      checkIcon: 'text-sky-400',
      triggerHover: 'hover:border-sky-500/50'
    },
    violet: {
      borderFocus: 'border-violet-500/80 shadow-violet-500/20',
      activeItem: 'bg-violet-500/15 text-violet-300 font-semibold',
      hoverItem: 'hover:bg-violet-500/10 hover:text-violet-200',
      checkIcon: 'text-violet-400',
      triggerHover: 'hover:border-violet-500/50'
    },
    default: {
      borderFocus: 'border-sky-500/80 shadow-sky-500/20',
      activeItem: 'bg-sky-500/15 text-sky-300 font-semibold',
      hoverItem: 'hover:bg-[#21262d] hover:text-white',
      checkIcon: 'text-sky-400',
      triggerHover: 'hover:border-slate-500'
    }
  }[variant];

  const sizeStyles = {
    sm: 'py-1 px-2.5 text-xs',
    md: 'py-1.5 px-3 text-xs'
  }[size];

  return (
    <div ref={containerRef} className={`relative inline-block select-none ${className}`}>
      {/* Botón Trigger Principal */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between space-x-2 bg-[#161b22] border rounded-xl text-left font-mono transition-all duration-150 cursor-pointer ${
          isOpen
            ? `${variantStyles.borderFocus} shadow-md`
            : `border-[#30363d] ${variantStyles.triggerHover} hover:bg-[#1c2128]`
        } ${sizeStyles} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center space-x-2 truncate flex-1">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate text-slate-100 font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0 pl-1">
          {selectedOption?.badge && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0d1117] text-slate-400 border border-[#30363d]">
              {selectedOption.badge}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-white' : ''
            }`}
          />
        </div>
      </button>

      {/* Menú Desplegable Flotante renderizado vía React Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              minWidth: `${coords.width}px`,
              maxWidth: '380px',
              zIndex: 9999,
              transform: coords.dropUp ? 'translateY(-100%)' : 'none'
            }}
            className="bg-[#161b22]/98 backdrop-blur-md border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 select-none"
          >
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 custom-dropdown-scrollbar">
              {options.length === 0 ? (
                <div className="px-3 py-2 text-center text-xs text-slate-500">
                  No hay opciones disponibles
                </div>
            ) : (
              options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <div
                    key={option.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono cursor-pointer transition-colors ${
                      isSelected
                        ? variantStyles.activeItem
                        : `text-slate-300 ${variantStyles.hoverItem}`
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate mr-2">
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <div className="truncate">
                        <div className="truncate">{option.label}</div>
                        {option.description && (
                          <div className="text-[10px] text-slate-500 font-sans truncate">
                            {option.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0 pl-1">
                      {option.badge && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0d1117] text-slate-400 border border-[#30363d]">
                          {option.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className={`w-3.5 h-3.5 shrink-0 ${variantStyles.checkIcon}`} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
