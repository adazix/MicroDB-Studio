// ============================================================================
// MICRODB STUDIO - SISTEMA MODERNO DE NOTIFICACIONES TOAST Y DIÁLOGOS CUSTOM
// Elimina por completo los alerts/confirms nativos del navegador
// ============================================================================

import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  HelpCircle
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
  showConfirm: (options: ConfirmDialogOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showToast = (type: ToastType, title: string, message?: string, duration = 4000) => {
    const id = `${Date.now()}_${Math.random()}`;
    const newToast: ToastMessage = { id, type, title, message, duration };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };

  const showSuccess = (title: string, message?: string) => showToast('success', title, message);
  const showError = (title: string, message?: string) => showToast('error', title, message, 6000);
  const showWarning = (title: string, message?: string) => showToast('warning', title, message, 5000);
  const showInfo = (title: string, message?: string) => showToast('info', title, message);

  const showConfirm = (options: ConfirmDialogOptions) => {
    setConfirmDialog(options);
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;
    setConfirmLoading(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } catch (e: any) {
      showError('Error', e.message || 'Error en la operación');
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showConfirm
      }}
    >
      {children}

      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col space-y-3 pointer-events-none max-w-md w-full px-4">
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start space-x-3 animate-in slide-in-from-bottom-5 fade-in duration-200 select-none ${
                isSuccess
                  ? 'bg-[#161b22]/95 border-emerald-500/40 text-emerald-300 shadow-emerald-500/10'
                  : isError
                  ? 'bg-[#161b22]/95 border-rose-500/40 text-rose-300 shadow-rose-500/10'
                  : isWarning
                  ? 'bg-[#161b22]/95 border-amber-500/40 text-amber-300 shadow-amber-500/10'
                  : 'bg-[#161b22]/95 border-sky-500/40 text-sky-300 shadow-sky-500/10'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-sky-400" />}
              </div>

              <div className="flex-1 text-xs">
                <h4 className="font-bold text-white text-sm leading-tight">{t.title}</h4>
                {t.message && <p className="text-slate-300 mt-1 leading-relaxed font-sans">{t.message}</p>}
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#21262d] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Custom Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-3 rounded-xl border ${
                    confirmDialog.isDestructive
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                  }`}
                >
                  {confirmDialog.isDestructive ? <AlertTriangle className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">{confirmDialog.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Confirmación de acción requerida</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-[#0d1117] p-3.5 rounded-xl border border-[#30363d]">
                {confirmDialog.message}
              </p>
            </div>

            <div className="px-6 py-4 border-t border-[#30363d] bg-[#0d1117] flex justify-end space-x-3 select-none">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={confirmLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
              >
                {confirmDialog.cancelText || 'Cancelar'}
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={confirmLoading}
                className={`font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center space-x-2 ${
                  confirmDialog.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                    : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/20'
                }`}
              >
                <span>{confirmLoading ? 'Procesando...' : confirmDialog.confirmText || 'Confirmar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de un ToastProvider');
  }
  return context;
};
