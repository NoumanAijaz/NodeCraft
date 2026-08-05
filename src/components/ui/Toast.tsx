import { useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

const toastConfig = {
  success: {
    icon: CheckCircle2,
    colors: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    iconColor: 'text-green-500 dark:text-green-400',
  },
  error: {
    icon: XCircle,
    colors: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    iconColor: 'text-red-500 dark:text-red-400',
  },
  info: {
    icon: Info,
    colors: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    iconColor: 'text-blue-500 dark:text-blue-400',
  },
  warning: {
    icon: AlertTriangle,
    colors: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
    iconColor: 'text-yellow-500 dark:text-yellow-400',
  },
};

export function Toast({ message, type, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const config = toastConfig[type];
  const Icon = config.icon;

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`
        pointer-events-auto
        flex items-center gap-3 px-4 py-3 rounded-lucid border shadow-lucid-md animate-toast-in
        ${config.colors}
        ${isExiting ? 'animate-toast-out' : ''}
        min-w-[300px] max-w-[400px]
      `}
      role="alert"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconColor}`} />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={handleClose}
        className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}