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
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache()
  }, databaseId);
} catch (error) {
  // Manejo de inicialización previa en el entorno de ejecución
  console.warn('Firestore ya fue inicializado o se utiliza configuración de contingencia:', error);
  db = initializeFirestore(app, {
    localCache: memoryLocalCache()
  });
}

// Instancia del servicio de Autenticación de Firebase
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, db, auth, googleProvider, onSnapshotsInSync, enableNetwork, disableNetwork };
