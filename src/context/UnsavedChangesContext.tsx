import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface UnsavedChangesContextType {
  isDirty: boolean;
  setGlobalDirty: (dirty: boolean) => void;
  confirmAndNavigate: (path: string, navigate: (path: string) => void) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);

  const setGlobalDirty = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  const confirmAndNavigate = useCallback((path: string, navigate: (path: string) => void) => {
    if (isDirty) {
      if (window.confirm('Hay cambios sin guardar. ¿Deseas continuar sin guardar?')) {
        setIsDirty(false);
        navigate(path);
      }
    } else {
      navigate(path);
    }
  }, [isDirty]);

  return (
    <UnsavedChangesContext.Provider value={{
      isDirty,
      setGlobalDirty,
      confirmAndNavigate
    }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChangesContext() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChangesContext debe usarse dentro de UnsavedChangesProvider');
  }
  return context;
}
