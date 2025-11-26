import { useState, useEffect, useCallback, useRef } from 'react';
import { useUnsavedChangesContext } from '../context/UnsavedChangesContext';

interface UseUnsavedChangesReturn {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  markAsSaved: () => void;
  confirmNavigation: (callback: () => void) => void;
  setOriginalData: <T>(data: T) => void;
  checkChanges: <T>(currentData: T) => boolean;
}

export function useUnsavedChanges(): UseUnsavedChangesReturn {
  const { setGlobalDirty } = useUnsavedChangesContext();
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);
  const originalDataRef = useRef<string>('');

  // Sincronizar estado local con global
  const setIsDirty = useCallback((dirty: boolean) => {
    setIsDirtyLocal(dirty);
    setGlobalDirty(dirty);
  }, [setGlobalDirty]);

  // Alias para mantener compatibilidad
  const isDirty = isDirtyLocal;

  // Prevenir cierre de pestaña
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'Hay cambios sin guardar. ¿Seguro que deseas salir?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Guardar datos originales para comparación
  const setOriginalData = useCallback(<T,>(data: T) => {
    originalDataRef.current = JSON.stringify(data);
    setIsDirtyLocal(false);
    setGlobalDirty(false);
  }, [setGlobalDirty]);

  // Verificar si hay cambios comparando con datos originales
  const checkChanges = useCallback(<T,>(currentData: T): boolean => {
    const hasChanges = JSON.stringify(currentData) !== originalDataRef.current;
    setIsDirtyLocal(hasChanges);
    setGlobalDirty(hasChanges);
    return hasChanges;
  }, [setGlobalDirty]);

  // Marcar como guardado
  const markAsSaved = useCallback(() => {
    setIsDirtyLocal(false);
    setGlobalDirty(false);
  }, [setGlobalDirty]);

  // Confirmar antes de navegar
  const confirmNavigation = useCallback((callback: () => void) => {
    if (isDirtyLocal) {
      if (window.confirm('Hay cambios sin guardar. ¿Deseas continuar sin guardar?')) {
        setIsDirtyLocal(false);
        setGlobalDirty(false);
        callback();
      }
    } else {
      callback();
    }
  }, [isDirtyLocal, setGlobalDirty]);

  return {
    isDirty,
    setIsDirty,
    markAsSaved,
    confirmNavigation,
    setOriginalData,
    checkChanges
  };
}
