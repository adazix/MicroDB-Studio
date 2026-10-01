// ============================================================================
// MICRODB STUDIO - CUSTOM CHECKBOX COMPONENT (MODERNO & ESTILIZADO)
// ============================================================================

import React from 'react';
import { Check } from 'lucide-react';

export interface CustomCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  variant?: 'emerald' | 'sky' | 'violet';
  disabled?: boolean;
  className?: string;
  title?: string;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({
  checked,
  onChange,
  label,
  variant = 'emerald',
  disabled = false,
  className = '',
  title
}) => {
  const variantStyles = {
    emerald: {
      checked: 'bg-emerald-500 border-emerald-400 text-white shadow-sm shadow-emerald-500/25',
      hover: 'hover:border-emerald-500/60',
      focusRing: 'focus-visible:ring-emerald-500/40'
    },
    sky: {
      checked: 'bg-sky-500 border-sky-400 text-white shadow-sm shadow-sky-500/25',
      hover: 'hover:border-sky-500/60',
      focusRing: 'focus-visible:ring-sky-500/40'
    },
    violet: {
      checked: 'bg-violet-600 border-violet-400 text-white shadow-sm shadow-violet-500/25',
      hover: 'hover:border-violet-500/60',
      focusRing: 'focus-visible:ring-violet-500/40'
    }
  }[variant];

  return (
    <label
      title={title}
      className={`inline-flex items-center space-x-2 select-none cursor-pointer transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${className}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) onChange(!checked);
        }}
        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 shrink-0 focus:outline-none focus-visible:ring-2 ${
          checked
            ? variantStyles.checked
            : `bg-[#0d1117] border-[#30363d] ${variantStyles.hover} hover:bg-[#161b22]`
        } ${variantStyles.focusRing}`}
      >
        {checked && <Check className="w-3 h-3 stroke-[3] animate-in zoom-in-75 duration-100" />}
      </button>

      {label && (
        <span
          onClick={(e) => {
            e.preventDefault();
            if (!disabled) onChange(!checked);
          }}
          className="text-xs text-slate-300 hover:text-slate-100 transition-colors font-medium flex items-center"
        >
          {label}
        </span>
      )}
    </label>
  );
};
