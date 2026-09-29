import React from 'react';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'warning';
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto p-4 rounded-2xl bg-[#0b132b]/95 text-white backdrop-blur-xl shadow-[-4px_-4px_12px_rgba(255,255,255,0.1),6px_6px_20px_rgba(0,0,0,0.35)] border border-slate-700/80 flex items-start gap-3 transform transition-all duration-300 animate-slide-in"
        >
          <div className="mt-0.5 w-7 h-7 rounded-xl bg-[#00677d]/30 text-[#4cd6fb] flex items-center justify-center shrink-0 border border-[#00b4d8]/30">
            <span className="material-symbols-outlined text-[18px]">
              {toast.type === 'success' ? 'check_circle' : toast.type === 'warning' ? 'warning' : 'sensors'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-['Space_Grotesk'] text-xs font-bold text-[#4cd6fb] uppercase tracking-wider">
                {toast.title || 'POLARIS TELEMETRY NODE'}
              </span>
              <button
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
            <p className="font-['Inter'] text-xs text-slate-200 mt-0.5 leading-relaxed">
              {toast.message}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
