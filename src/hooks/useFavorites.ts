import { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import type { MenuItemId } from '../types/userPreferences';

const CACHE_KEY = 'user_favorites_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

interface CachedData {
  data: MenuItemId[];
  timestamp: number;
}

interface UseFavoritesReturn {
  favoritos: MenuItemId[];
  loading: boolean;
  error: string | null;
  isFavorite: (itemPath: string) => boolean;
  toggleFavorite: (itemPath: string) => Promise<void>;
}

export function useFavorites(): UseFavoritesReturn {
  const { currentUser, userProfile } = useAuth();
  const [favoritos, setFavoritos] = useState<MenuItemId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guardar en cache local
  const saveToCache = useCallback((data: MenuItemId[]) => {
    if (!currentUser?.uid) return;
    try {
      const cacheData: CachedData = { data, timestamp: Date.now() };
      localStorage.setItem(`${CACHE_KEY}_${currentUser.uid}`, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Error guardando cache de favoritos:', e);
    }
  }, [currentUser?.uid]);

  // Cargar desde cache local
  const loadFromCache = useCallback((): MenuItemId[] | null => {
    if (!currentUser?.uid) return null;
    try {
      const cached = localStorage.getItem(`${CACHE_KEY}_${currentUser.uid}`);
      if (cached) {
        const { data, timestamp }: CachedData = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    } catch (e) {
      console.warn('Error leyendo cache de favoritos:', e);
    }
    return null;
  }, [currentUser?.uid]);

  // Cargar favoritos desde userProfile o cache
  useEffect(() => {
    if (!currentUser?.uid) {
      setFavoritos([]);
      setLoading(false);
      return;
    }

    // Intentar cargar desde cache primero
    const cachedData = loadFromCache();
    if (cachedData) {
      setFavoritos(cachedData);
      setLoading(false);
    }

    // Si userProfile tiene favoritos, usarlos
    if (userProfile) {
      const userFavoritos = userProfile.favoritos || [];
      setFavoritos(userFavoritos);
      saveToCache(userFavoritos);
      setLoading(false);
    }
  }, [currentUser?.uid, userProfile, loadFromCache, saveToCache]);

  // Verificar si un item es favorito
  const isFavorite = useCallback((itemPath: string): boolean => {
    return favoritos.includes(itemPath);
  }, [favoritos]);

  // Toggle favorito
  const toggleFavorite = useCallback(async (itemPath: string) => {
    if (!currentUser?.uid || !userProfile?.id) return;

    const currentIsFavorite = favoritos.includes(itemPath);
    const newFavoritos = currentIsFavorite
      ? favoritos.filter(f => f !== itemPath)
      : [...favoritos, itemPath];

    // Optimistic update
    setFavoritos(newFavoritos);
    saveToCache(newFavoritos);

    // Guardar en el documento del usuario existente
    try {
      const userRef = doc(db, 'usuarios', userProfile.id);
      await updateDoc(userRef, {
        favoritos: newFavoritos,
        actualizadoEn: Timestamp.now()
      });
    } catch (err) {
      // Rollback on error
      setFavoritos(favoritos);
      saveToCache(favoritos);
      console.error('Error guardando favorito:', err);
      throw err;
    }
  }, [currentUser?.uid, userProfile?.id, favoritos, saveToCache]);

  return {
    favoritos,
    loading,
    error,
    isFavorite,
    toggleFavorite
  };
}
