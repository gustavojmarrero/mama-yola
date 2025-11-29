import { ReactNode } from 'react';
import { useCarousel } from '../../hooks/useCarousel';

interface CarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  loop?: boolean;
  showArrows?: boolean;
  showDots?: boolean;
  showCounter?: boolean;
  enableSwipe?: boolean;
  swipeThreshold?: number;
  className?: string;
  ariaLabel?: string;
  onChange?: (index: number, item: T) => void;
}

// Componente de flecha de navegación
function CarouselArrow({
  direction,
  onClick,
  disabled
}: {
  direction: 'left' | 'right';
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        absolute top-1/2 -translate-y-1/2 z-10
        w-11 h-11 rounded-full
        bg-white/95 backdrop-blur-sm
        shadow-lg shadow-black/10
        border border-gray-100
        flex items-center justify-center
        transition-all duration-200 ease-out
        hover:bg-white hover:scale-110 hover:shadow-xl
        active:scale-95
        disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100
        ${direction === 'left' ? '-left-3' : '-right-3'}
      `}
      aria-label={direction === 'left' ? 'Anterior' : 'Siguiente'}
    >
      <svg
        className="w-5 h-5 text-gray-700"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
        />
      </svg>
    </button>
  );
}

// Indicadores de página (dots)
function CarouselDots({
  total,
  current,
  onSelect
}: {
  total: number;
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex justify-center items-center gap-1.5 mt-4">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={`
            h-2 rounded-full transition-all duration-300 ease-out
            ${i === current
              ? 'w-6 bg-amber-500'
              : 'w-2 bg-gray-300 hover:bg-gray-400'
            }
          `}
          aria-label={`Ir a elemento ${i + 1}`}
          aria-current={i === current ? 'true' : undefined}
        />
      ))}
    </div>
  );
}

// Componente principal
function Carousel<T>({
  items,
  renderItem,
  loop = true,
  showArrows = true,
  showDots = true,
  showCounter = true,
  enableSwipe = true,
  swipeThreshold = 50,
  className = '',
  ariaLabel = 'Carrusel',
  onChange,
}: CarouselProps<T>) {
  const {
    currentIndex,
    goTo,
    goNext,
    goPrev,
    isFirst,
    isLast,
    containerRef,
    totalItems,
    direction,
  } = useCarousel({
    items,
    loop,
    onChange,
    enableSwipe,
    swipeThreshold,
  });

  if (items.length === 0) {
    return null;
  }

  const shouldShowArrows = showArrows && totalItems > 1;
  const shouldShowDots = showDots && totalItems > 1 && totalItems <= 8;
  const shouldShowCounter = showCounter && totalItems > 1;

  return (
    <div
      className={`relative ${className}`}
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="carrusel"
    >
      {/* Contenedor principal con gestos */}
      <div
        ref={containerRef}
        className="relative overflow-hidden touch-pan-y px-6"
      >
        {/* Item actual con animación */}
        <div
          className={`
            transition-all duration-300 ease-out
            ${direction === 'left' ? 'animate-carousel-left' : ''}
            ${direction === 'right' ? 'animate-carousel-right' : ''}
          `}
          role="group"
          aria-roledescription="slide"
          aria-label={`${currentIndex + 1} de ${totalItems}`}
        >
          {renderItem(items[currentIndex], currentIndex)}
        </div>
      </div>

      {/* Flechas de navegación */}
      {shouldShowArrows && (
        <>
          <CarouselArrow
            direction="left"
            onClick={goPrev}
            disabled={!loop && isFirst}
          />
          <CarouselArrow
            direction="right"
            onClick={goNext}
            disabled={!loop && isLast}
          />
        </>
      )}

      {/* Indicadores de página (dots) */}
      {shouldShowDots && (
        <CarouselDots
          total={totalItems}
          current={currentIndex}
          onSelect={goTo}
        />
      )}

      {/* Contador de posición */}
      {shouldShowCounter && (
        <div className="text-center text-sm text-gray-500 mt-3 font-medium">
          {currentIndex + 1} de {totalItems}
        </div>
      )}

      {/* Indicador de swipe para móvil */}
      {enableSwipe && totalItems > 1 && (
        <div className="sm:hidden text-center text-xs text-gray-400 mt-2">
          Desliza para ver más
        </div>
      )}
    </div>
  );
}

export default Carousel;
export { CarouselArrow, CarouselDots };
export type { CarouselProps };
