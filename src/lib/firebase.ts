import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore, 
  memoryLocalCache, 
  Firestore,
  onSnapshotsInSync,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Inicialización de la instancia de la aplicación Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// REQUISITO CRÍTICO: Deshabilitar explícitamente la persistencia local en disco.
// El uso de memoryLocalCache() garantiza CERO almacenamiento en disco local,
// evitando datos desactualizados (stale cache) y desincronización entre múltiples dispositivos.
// experimentalForceLongPolling: true evita fallos de WebSocket en iframes y contenedores proxy.
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true,
  }, databaseId);
} catch (error) {
  // Manejo de inicialización previa en el entorno de ejecución
  console.warn('Firestore ya fue inicializado o se utiliza configuración de contingencia:', error);
  try {
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
    });
  } catch {
    db = getApps().length ? (app as any).firestore?.() || (window as any).__firebase_db : null;
  }
}

// Instancia del servicio de Autenticación de Firebase
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

/**
 * Sanitiza recursivamente cualquier objeto eliminando llaves con valor `undefined`
 * para prevenir el error fatal de Firestore: "Unsupported field value: undefined".
 */
export function sanitizeFirestoreData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(data as Record<string, any>)) {
      if (val !== undefined) {
        sanitized[key] = sanitizeFirestoreData(val);
      }
    }
    return sanitized as T;
  }
  return data;
}

export { app, db, auth, googleProvider, onSnapshotsInSync, enableNetwork, disableNetwork };
