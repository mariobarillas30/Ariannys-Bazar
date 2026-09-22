import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, onSnapshotsInSync } from '../lib/firebase';
import { SyncStatus } from '../types';

interface SyncContextType {
  status: SyncStatus;
  notifyPendingWrite: (isPending: boolean) => void;
  incrementListener: () => () => void;
  lastError: string | null;
  setLastError: (err: string | null) => void;
  showSuccessToast: (msg: string) => void;
  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;
  clearToast: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [activeListenersCount, setActiveListenersCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Monitor del estado de conectividad a Internet del navegador
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showSuccessToast('Conexión con Firestore restablecida');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setToastMessage({ text: 'Sin conexión a Internet. Operaciones bloqueadas.', type: 'error' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor del evento de sincronización en tiempo real de Firestore
  useEffect(() => {
    const unsubscribe = onSnapshotsInSync(db, dbInSync);
    function dbInSync() {
      setLastSyncTime(Date.now());
    }
    return () => unsubscribe();
  }, []);

  const showSuccessToast = (text: string) => {
    setToastMessage({ text, type: 'success' });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const clearToast = () => setToastMessage(null);

  const notifyPendingWrite = (isPending: boolean) => {
    setHasPendingWrites(isPending);
    if (!isPending) {
      setLastSyncTime(Date.now());
    }
  };

  const incrementListener = () => {
    setActiveListenersCount((c) => c + 1);
    return () => {
      setActiveListenersCount((c) => Math.max(0, c - 1));
    };
  };

  return (
    <SyncContext.Provider
      value={{
        status: {
          isOnline,
          hasPendingWrites,
          lastSyncTime,
          latencyMs: 38,
          activeListenersCount,
          serverDirectMode: true,
        },
        notifyPendingWrite,
        incrementListener,
        lastError,
        setLastError,
        showSuccessToast,
        toastMessage,
        clearToast,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
