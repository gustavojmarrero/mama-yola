import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { Usuario } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  // Iniciar sesión
  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  // Cerrar sesión
  async function logout() {
    await signOut(auth);
  }

  // Cargar perfil de usuario desde Firestore
  async function loadUserProfile(uid: string) {
    try {
      const userDocRef = doc(db, 'usuarios', uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        setUserProfile({ id: userDoc.id, ...userDoc.data() } as Usuario);
      } else {
        // Si no existe el perfil, crearlo automáticamente
        const user = auth.currentUser;
        if (user) {
          const nuevoUsuario: Omit<Usuario, 'id'> = {
            uid: user.uid,
            nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
            email: user.email || '',
            rol: 'familiar', // Primer usuario siempre es familiar
            activo: true,
            creadoEn: new Date(),
            actualizadoEn: new Date()
          };

          await setDoc(userDocRef, nuevoUsuario);
          setUserProfile({ id: uid, ...nuevoUsuario } as Usuario);
          console.log('✅ Perfil de usuario creado automáticamente');
        }
      }
    } catch (error) {
      console.error('Error cargando/creando perfil de usuario:', error);
    }
  }

  // Efecto para manejar cambios en el estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        await loadUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
