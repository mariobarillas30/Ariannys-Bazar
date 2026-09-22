import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { UserRepository } from '../repositories/UserRepository';

export type ActiveTab = 'dashboard' | 'pos' | 'inventory' | 'customers' | 'cash' | 'sales' | 'users';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, role: UserRole) => Promise<void>;
  loginWithPin: (pin: string, targetUid?: string) => Promise<UserProfile>;
  switchUser: (profile: UserProfile) => void;
  logout: () => Promise<void>;
  hasRole: (allowedRoles: UserRole[]) => boolean;
  canAccessTab: (tab: ActiveTab) => boolean;
  getDefaultTabForRole: (role: UserRole) => ActiveTab;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sembrar usuarios iniciales con sus PINs en Firestore
  useEffect(() => {
    UserRepository.ensureDefaultUsersSeeded().catch(err => console.error(err));
  }, []);

  // Escuchar cambios de autenticación en Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          // Intentar obtener el perfil guardado en Firestore
          let profile = await UserRepository.getUserProfile(firebaseUser.uid);
          
          if (!profile) {
            // Si el perfil no existe, creamos uno por defecto.
            const defaultRole: UserRole = 'admin';
            
            profile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || 'usuario@sistema.com',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuario',
              role: defaultRole,
              pin: '1234',
              photoURL: firebaseUser.photoURL || undefined,
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            
            await UserRepository.saveUserProfile(profile);
          }
          
          setUserProfile(profile);
        } catch (err) {
          console.error('Error al cargar perfil de Firestore:', err);
        }
      } else {
        // Verificar si hay una sesión guardada en localStorage
        const savedCustomProfile = localStorage.getItem('ariannys_active_profile');
        if (savedCustomProfile) {
          try {
            setUserProfile(JSON.parse(savedCustomProfile));
          } catch {
            setUserProfile(null);
          }
        } else {
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const role: UserRole = userProfile?.role || 'admin';

  // Iniciar sesión con Google
  const loginWithGoogle = async () => {
    localStorage.removeItem('ariannys_demo_role');
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      let profile = await UserRepository.getUserProfile(result.user.uid);
      if (!profile) {
        profile = {
          uid: result.user.uid,
          email: result.user.email || '',
          displayName: result.user.displayName || 'Usuario Google',
          role: 'admin',
          photoURL: result.user.photoURL || undefined,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await UserRepository.saveUserProfile(profile);
      }
      setUserProfile(profile);
    }
  };

  // Iniciar sesión con Correo y Contraseña
  const loginWithEmail = async (email: string, pass: string) => {
    localStorage.removeItem('ariannys_demo_role');
    const result = await signInWithEmailAndPassword(auth, email, pass);
    if (result.user) {
      const profile = await UserRepository.getUserProfile(result.user.uid);
      if (profile) setUserProfile(profile);
    }
  };

  // Registro de nuevo usuario con rol explícito
  const registerWithEmail = async (email: string, pass: string, name: string, selectedRole: UserRole) => {
    localStorage.removeItem('ariannys_demo_role');
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    if (result.user) {
      await updateProfile(result.user, { displayName: name });
      const newProfile: UserProfile = {
        uid: result.user.uid,
        email: result.user.email || email,
        displayName: name,
        role: selectedRole,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await UserRepository.saveUserProfile(newProfile);
      setUserProfile(newProfile);
    }
  };

  // Iniciar sesión directamente con PIN numérico de la base de datos central (4 a 6 dígitos)
  const loginWithPin = async (pin: string, targetUid?: string): Promise<UserProfile> => {
    const cleanPin = pin.trim();
    let foundUser: UserProfile | null = null;

    if (targetUid) {
      // 1. Si se seleccionó un usuario específico, verificar que su PIN coincida en Firestore
      const profile = await UserRepository.getUserProfile(targetUid);
      if (profile) {
        if (profile.pin && profile.pin === cleanPin) {
          foundUser = profile;
        } else {
          throw new Error(`El PIN de seguridad es incorrecto para ${profile.displayName || 'este usuario'}.`);
        }
      } else {
        throw new Error('Usuario no encontrado en la base de datos central.');
      }
    } else {
      // 2. Si no se especificó targetUid, buscar directamente el usuario asociado a ese PIN en Firestore
      foundUser = await UserRepository.findUserByPin(cleanPin);
      if (!foundUser) {
        throw new Error('PIN de seguridad no registrado en la base de datos central.');
      }
    }

    if (user) {
      await signOut(auth);
    }
    localStorage.setItem('ariannys_active_profile', JSON.stringify(foundUser));
    setUserProfile(foundUser);
    return foundUser;
  };

  // Cambiar de usuario / cajero activo
  const switchUser = (profile: UserProfile) => {
    localStorage.setItem('ariannys_active_profile', JSON.stringify(profile));
    setUserProfile(profile);
  };

  // Cerrar sesión
  const logout = async () => {
    localStorage.removeItem('ariannys_active_profile');
    setUserProfile(null);
    if (user) {
      await signOut(auth);
    }
  };

  // Verificación de Permisos RBAC
  const hasRole = (allowedRoles: UserRole[]): boolean => {
    return allowedRoles.includes(role);
  };

  const getDefaultTabForRole = (currentRole: UserRole): ActiveTab => {
    switch (currentRole) {
      case 'cashier':
        return 'pos';
      case 'inventory':
        return 'inventory';
      case 'admin':
      default:
        return 'dashboard';
    }
  };

  const canAccessTab = (tab: ActiveTab): boolean => {
    if (role === 'admin') return true;
    if (role === 'cashier') {
      return tab === 'pos';
    }
    if (role === 'inventory') {
      return tab === 'inventory';
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      role,
      loading,
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      loginWithPin,
      switchUser,
      logout,
      hasRole,
      canAccessTab,
      getDefaultTabForRole
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}
