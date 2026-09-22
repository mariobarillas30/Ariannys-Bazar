import React from 'react';
import { useSync } from '../context/SyncContext';
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

export function SyncStatusBadge() {
  const { status } = useSync();

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300">
      {status.isOnline ? (
        status.hasPendingWrites ? (
          <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
        )
      ) : (
        <WifiOff className="w-3 h-3 text-rose-400" />
      )}

      <span>
        {status.isOnline
          ? status.hasPendingWrites
            ? 'Guardando...'
            : 'En línea'
          : 'Desconectado'}
      </span>
    </div>
  );
}

export function Toast() {
  const { toastMessage, clearToast } = useSync();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-3.5 py-2.5 rounded-md shadow-lg border border-slate-700 max-w-md bg-slate-800 text-slate-100 text-xs font-medium">
      {toastMessage.type === 'success' && (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      )}
      {toastMessage.type === 'error' && (
        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
      )}
      {toastMessage.type === 'info' && (
        <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
      )}

      <div className="flex-1">
        {toastMessage.text}
      </div>

      <button
        onClick={clearToast}
        className="text-slate-400 hover:text-white text-xs font-semibold px-1.5 py-0.5 rounded hover:bg-slate-700"
      >
        ✕
      </button>
    </div>
  );
}
