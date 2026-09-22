import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  updateDoc, 
  deleteDoc,
  deleteField,
  onSnapshot, 
  query, 
  where,
  orderBy,
  Unsubscribe 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserProfile, UserRole, PinAuthResult } from '../types';

const USERS_COLLECTION = 'users';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export class UserRepository {
  /**
   * Obtiene el perfil del usuario desde Firestore por su UID.
   */
  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, USERS_COLLECTION, uid);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${USERS_COLLECTION}/${uid}`);
      return null;
    }
  }

  /**
   * Guarda o actualiza un perfil de usuario en Firestore.
   */
  static async saveUserProfile(profile: UserProfile): Promise<void> {
    const docRef = doc(db, USERS_COLLECTION, profile.uid);
    try {
      await setDoc(docRef, profile, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${USERS_COLLECTION}/${profile.uid}`);
    }
  }

  /**
   * Elimina un usuario definitivamente de la base de datos central.
   */
  static async deleteUser(uid: string): Promise<void> {
    const docRef = doc(db, USERS_COLLECTION, uid);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${USERS_COLLECTION}/${uid}`);
    }
  }

  /**
   * Cambia el rol de un usuario (exclusivo para Administradores).
   */
  static async updateUserRole(uid: string, newRole: UserRole): Promise<void> {
    const docRef = doc(db, USERS_COLLECTION, uid);
    try {
      await updateDoc(docRef, {
        role: newRole,
        updatedAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COLLECTION}/${uid}`);
    }
  }

  /**
   * Actualiza o crea el PIN de seguridad de un usuario directamente en la base de datos central (4 a 6 dígitos).
   */
  static async setUserPin(uid: string, pin: string): Promise<void> {
    const trimmed = pin.trim();
    if (!/^\d{4,6}$/.test(trimmed)) {
      throw new Error('El PIN debe contener únicamente entre 4 y 6 dígitos numéricos.');
    }

    const docRef = doc(db, USERS_COLLECTION, uid);
    try {
      await setDoc(docRef, {
        pin: trimmed,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COLLECTION}/${uid}`);
    }
  }

  /**
   * Elimina o restablece el PIN de seguridad de un usuario en la base de datos central.
   */
  static async removeUserPin(uid: string): Promise<void> {
    const docRef = doc(db, USERS_COLLECTION, uid);
    try {
      await updateDoc(docRef, {
        pin: deleteField(),
        updatedAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COLLECTION}/${uid}`);
    }
  }

  /**
   * Valida en tiempo real haciendo una consulta directa a la base de datos central si un PIN es válido.
   * Sin depender de memoria local ni estado volátil.
   */
  static async verifyPin(inputPin: string, targetUid?: string): Promise<PinAuthResult> {
    const cleanPin = inputPin.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      return {
        success: false,
        message: 'El PIN de seguridad debe contener entre 4 y 6 dígitos numéricos.'
      };
    }

    try {
      // 1. Si hay un targetUid especificado (ej. el cajero en turno), consultar su registro en la base de datos central
      if (targetUid) {
        const targetRef = doc(db, USERS_COLLECTION, targetUid);
        const targetSnap = await getDoc(targetRef);
        
        if (targetSnap.exists()) {
          const targetData = targetSnap.data() as UserProfile;
          if (targetData.pin && targetData.pin === cleanPin) {
            return {
              success: true,
              authorizedRole: targetData.role,
              authorizedUserName: targetData.displayName || 'Usuario',
              isSuperAdminOverride: false,
              message: `Autorización concedida. Usuario: ${targetData.displayName}`
            };
          }
        }
      }

      // 2. Consulta en la base de datos central si el PIN corresponde a un Administrador
      const adminQuery = query(
        collection(db, USERS_COLLECTION),
        where('role', '==', 'admin')
      );
      const adminSnaps = await getDocs(adminQuery);
      
      for (const adminDoc of adminSnaps.docs) {
        const adminData = adminDoc.data() as UserProfile;
        if (adminData.pin && adminData.pin === cleanPin) {
          return {
            success: true,
            authorizedRole: 'admin',
            authorizedUserName: adminData.displayName || 'Administrador',
            isSuperAdminOverride: true,
            message: `Autorización concedida por Administrador (${adminData.displayName || 'Admin'})`
          };
        }
      }

      // 3. Si no coincidió con el targetUid ni Admin, verificar contra cualquier usuario registrado en el servidor central
      const allUsersQuery = query(collection(db, USERS_COLLECTION));
      const allUsersSnaps = await getDocs(allUsersQuery);
      for (const userDoc of allUsersSnaps.docs) {
        const userData = userDoc.data() as UserProfile;
        if (userData.pin && userData.pin === cleanPin) {
          return {
            success: true,
            authorizedRole: userData.role,
            authorizedUserName: userData.displayName || 'Usuario',
            isSuperAdminOverride: userData.role === 'admin',
            message: `Autorización concedida. Usuario: ${userData.displayName}`
          };
        }
      }

      // Si no coincidió en el servidor central
      return {
        success: false,
        message: 'Código de seguridad incorrecto o no registrado en el servidor central.'
      };
    } catch (error) {
      console.error('Error al verificar PIN:', error);
      return {
        success: false,
        message: 'Error al conectar con el servidor central para verificar las credenciales.'
      };
    }
  }

  /**
   * Busca un usuario en Firestore por su PIN de 4-6 dígitos para inicio de sesión directo.
   */
  static async findUserByPin(pin: string): Promise<UserProfile | null> {
    const cleanPin = pin.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) return null;

    try {
      const q = query(collection(db, USERS_COLLECTION), where('pin', '==', cleanPin));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error al buscar usuario por PIN:', error);
      return null;
    }
  }

  /**
   * Asegura que los usuarios iniciales con sus PINs existan en Firestore.
   */
  static async ensureDefaultUsersSeeded(): Promise<void> {
    const defaultUsers: UserProfile[] = [
      {
        uid: 'user_admin_master',
        email: 'admin@ariannysbazar.com',
        displayName: 'Administrador Principal',
        role: 'admin',
        pin: '1234',
        createdAt: 1700000000000,
        updatedAt: Date.now()
      },
      {
        uid: 'user_cashier_arianny',
        email: 'cajero@ariannysbazar.com',
        displayName: 'Arianny (Cajero POS)',
        role: 'cashier',
        pin: '2024',
        createdAt: 1700000000000,
        updatedAt: Date.now()
      },
      {
        uid: 'user_inventory_stock',
        email: 'inventario@ariannysbazar.com',
        displayName: 'Encargado de Inventario',
        role: 'inventory',
        pin: '9999',
        createdAt: 1700000000000,
        updatedAt: Date.now()
      }
    ];

    try {
      for (const u of defaultUsers) {
        const docRef = doc(db, USERS_COLLECTION, u.uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          await setDoc(docRef, u);
        }
      }
    } catch (err) {
      console.error('Error al sembrar usuarios predeterminados:', err);
    }
  }

  /**
   * Suscripción en tiempo real a todos los usuarios del sistema (vista Admin).
   */
  static subscribeAllUsers(
    onData: (users: UserProfile[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc'));
    
    return onSnapshot(
      q,
      (snapshot) => {
        const users: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          users.push(docSnap.data() as UserProfile);
        });
        onData(users);
      },
      (error) => {
        console.error('Error al escuchar lista de usuarios:', error);
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
      }
    );
  }
}
