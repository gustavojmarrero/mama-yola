import { useEffect, RefObject } from 'react';

interface SwipeConfig {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
  enabled?: boolean;
}

/**
 * Hook para detectar gestos de swipe horizontales en dispositivos táctiles.
 *
 * @param ref - Referencia al elemento DOM que escuchará los eventos táctiles
 * @param config - Configuración del swipe
 * @param config.onSwipeLeft - Callback cuando se detecta swipe hacia la izquierda
 * @param config.onSwipeRight - Callback cuando se detecta swipe hacia la derecha
 * @param config.threshold - Distancia mínima en píxeles para considerar un swipe (default: 50)
 * @param config.enabled - Si el swipe está habilitado (default: true)
 */
export function useSwipeGesture(
  ref: RefObject<HTMLElement>,
  config: SwipeConfig
): void {
  const { onSwipeLeft, onSwipeRight, threshold = 50, enabled = true } = config;

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;

    function handleTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }

    function handleTouchEnd(e: TouchEvent) {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();

      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const deltaTime = endTime - startTime;

      // Solo considerar swipe si:
      // 1. El movimiento horizontal es mayor que el vertical (evitar conflicto con scroll)
      // 2. La distancia supera el threshold
      // 3. El gesto se completó en menos de 500ms (evitar drags lentos)
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
      const exceedsThreshold = Math.abs(deltaX) > threshold;
      const isFastEnough = deltaTime < 500;

      if (isHorizontalSwipe && exceedsThreshold && isFastEnough) {
        if (deltaX > 0) {
          onSwipeRight();
        } else {
          onSwipeLeft();
        }
      }
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, onSwipeLeft, onSwipeRight, threshold, enabled]);
}

export default useSwipeGesture;
