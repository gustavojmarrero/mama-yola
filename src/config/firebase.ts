import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

// Configuración de Firebase
// IMPORTANTE: Estos valores deben venir de las variables de entorno
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Servicios de Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Función para crear usuarios sin afectar la sesión actual
// Usa una app secundaria temporal para evitar el auto-login
export async function createUserWithoutSignIn(email: string, password: string) {
  // Crear app secundaria
  const secondaryApp = initializeApp(firebaseConfig, 'secondary');
  const secondaryAuth = getAuth(secondaryApp);

  try {
    // Crear usuario en la app secundaria
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = userCredential.user.uid;

    // Cerrar sesión en la app secundaria y eliminarla
    await secondaryAuth.signOut();
    await deleteApp(secondaryApp);

    return uid;
  } catch (error) {
    // Limpiar la app secundaria en caso de error
    await deleteApp(secondaryApp);
    throw error;
  }
}

// Messaging (solo si está soportado en el navegador)
export const messaging = (async () => {
  const supported = await isSupported();
  return supported ? getMessaging(app) : null;
})();

export default app;
