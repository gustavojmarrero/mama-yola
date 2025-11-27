import { useState, useEffect, useMemo, useCallback } from 'react';
import { addDays, subDays, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

export type VistaCalendario = 'dia' | 'tres-dias' | 'semana';
export type AnimacionCalendario = 'entrada-izquierda' | 'entrada-derecha' | null;

interface UseCalendarioViewReturn {
  vista: VistaCalendario;
  fechaCentral: Date;
  diasVisibles: Date[];
  irAnterior: () => void;
  irSiguiente: () => void;
  irAHoy: () => void;
  animacion: AnimacionCalendario;
  isAnimating: boolean;
}

/**
 * Hook para manejar la lógica de vistas del calendario adaptativo.
 *
 * Detecta automáticamente el viewport y ajusta la vista:
 * - Móvil (<640px): Vista de 1 día
 * - Tablet (640-1023px): Vista de 3 días
 * - Desktop (≥1024px): Vista de semana completa
 *
 * @returns Objeto con vista actual, días visibles, funciones de navegación y estado de animación
 */
export function useCalendarioView(): UseCalendarioViewReturn {
  const [fechaCentral, setFechaCentral] = useState(new Date());
  const [vista, setVista] = useState<VistaCalendario>('semana');
  const [animacion, setAnimacion] = useState<AnimacionCalendario>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Detectar viewport y ajustar vista automáticamente
  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      if (width < 640) {
        setVista('dia');
      } else if (width < 1024) {
        setVista('tres-dias');
      } else {
        setVista('semana');
      }
    }

    // Ejecutar inmediatamente
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calcular días visibles según la vista actual
  const diasVisibles = useMemo(() => {
    if (vista === 'dia') {
      return [fechaCentral];
    } else if (vista === 'tres-dias') {
      return [
        subDays(fechaCentral, 1),
        fechaCentral,
        addDays(fechaCentral, 1)
      ];
    } else {
      const inicio = startOfWeek(fechaCentral, { weekStartsOn: 1 });
      const fin = endOfWeek(fechaCentral, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: inicio, end: fin });
    }
  }, [fechaCentral, vista]);

  // Navegación con animación
  const navegarConAnimacion = useCallback((direccion: 'anterior' | 'siguiente') => {
    if (isAnimating) return;

    setIsAnimating(true);

    // Breve delay para mostrar la animación
    setTimeout(() => {
      if (vista === 'semana') {
        // En vista semana, navegar por semanas
        if (direccion === 'anterior') {
          setFechaCentral(prev => subWeeks(prev, 1));
        } else {
          setFechaCentral(prev => addWeeks(prev, 1));
        }
      } else {
        // En vista día o 3-días, navegar por días
        if (direccion === 'anterior') {
          setFechaCentral(prev => subDays(prev, 1));
        } else {
          setFechaCentral(prev => addDays(prev, 1));
        }
      }

      // Activar animación de entrada desde la dirección opuesta
      setAnimacion(direccion === 'anterior' ? 'entrada-izquierda' : 'entrada-derecha');

      setTimeout(() => {
        setIsAnimating(false);
        setAnimacion(null);
      }, 300);
    }, 50);
  }, [isAnimating, vista]);

  const irAnterior = useCallback(() => navegarConAnimacion('anterior'), [navegarConAnimacion]);
  const irSiguiente = useCallback(() => navegarConAnimacion('siguiente'), [navegarConAnimacion]);

  const irAHoy = useCallback(() => {
    setFechaCentral(new Date());
    setAnimacion('entrada-derecha');
    setTimeout(() => setAnimacion(null), 300);
  }, []);

  return {
    vista,
    fechaCentral,
    diasVisibles,
    irAnterior,
    irSiguiente,
    irAHoy,
    animacion,
    isAnimating
  };
}

export default useCalendarioView;
