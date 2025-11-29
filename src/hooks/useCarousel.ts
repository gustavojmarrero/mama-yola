import { useState, useRef, useCallback, useEffect } from 'react';
import { useSwipeGesture } from './useSwipeGesture';

interface UseCarouselOptions<T> {
  items: T[];
  initialIndex?: number;
  loop?: boolean;
  onChange?: (index: number, item: T) => void;
  enableSwipe?: boolean;
  swipeThreshold?: number;
}

interface UseCarouselReturn<T> {
  currentIndex: number;
  currentItem: T | undefined;
  goTo: (index: number) => void;
  goNext: () => void;
  goPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  totalItems: number;
  containerRef: React.RefObject<HTMLDivElement>;
  direction: 'left' | 'right' | null;
}

/**
 * Hook para manejar la lógica de un carrusel con soporte de swipe y loop infinito.
 */
export function useCarousel<T>({
  items,
  initialIndex = 0,
  loop = true,
  onChange,
  enableSwipe = true,
  swipeThreshold = 50,
}: UseCarouselOptions<T>): UseCarouselReturn<T> {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resetear dirección después de la animación
  useEffect(() => {
    if (direction) {
      const timer = setTimeout(() => setDirection(null), 300);
      return () => clearTimeout(timer);
    }
  }, [direction]);

  // Resetear índice si items cambian y el índice actual es inválido
  useEffect(() => {
    if (currentIndex >= items.length && items.length > 0) {
      setCurrentIndex(0);
    }
  }, [items.length, currentIndex]);

  const goTo = useCallback((index: number) => {
    if (items.length === 0) return;

    let newIndex = index;
    let newDirection: 'left' | 'right' = index > currentIndex ? 'left' : 'right';

    if (loop) {
      // Loop infinito
      if (index < 0) {
        newIndex = items.length - 1;
        newDirection = 'right';
      } else if (index >= items.length) {
        newIndex = 0;
        newDirection = 'left';
      }
    } else {
      // Sin loop - limitar a rango válido
      newIndex = Math.max(0, Math.min(items.length - 1, index));
      if (newIndex === currentIndex) return;
    }

    setDirection(newDirection);
    setCurrentIndex(newIndex);
    onChange?.(newIndex, items[newIndex]);
  }, [items, loop, onChange, currentIndex]);

  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  // Integrar swipe
  useSwipeGesture(containerRef, {
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
    threshold: swipeThreshold,
    enabled: enableSwipe && items.length > 1,
  });

  return {
    currentIndex,
    currentItem: items[currentIndex],
    goTo,
    goNext,
    goPrev,
    isFirst: currentIndex === 0,
    isLast: currentIndex === items.length - 1,
    totalItems: items.length,
    containerRef,
    direction,
  };
}

export default useCarousel;
