import { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Componente Skeleton para mostrar placeholders mientras cargan los datos.
 * Mejora el LCP mostrando contenido inmediatamente.
 */
export default function Skeleton({
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200';

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: ''
  };

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg'
  };

  const defaultHeight = variant === 'text' ? '1em' : height;

  return (
    <div
      className={`${baseClasses} ${animationClasses[animation]} ${variantClasses[variant]} ${className}`}
      style={{
        width: width ?? '100%',
        height: defaultHeight,
        ...style
      }}
      {...props}
    />
  );
}

// Skeleton para tarjetas de actividad
export function SkeletonActividadCard() {
  return (
    <div className="p-3 rounded-lg border-l-4 border-gray-300 bg-gray-50 mb-2">
      <div className="flex items-center gap-2">
        <Skeleton variant="circular" width={24} height={24} />
        <div className="flex-1">
          <Skeleton variant="text" width="70%" height={16} className="mb-1" />
          <Skeleton variant="text" width="40%" height={12} />
        </div>
      </div>
    </div>
  );
}

// Skeleton para estadísticas
// Muestra contenido con placeholder real
export function SkeletonStats() {
  return (
    <div className="flex-shrink-0 w-[130px] sm:w-auto bg-white rounded-lg shadow p-3 sm:p-4 text-center">
      <div className="text-2xl sm:text-3xl font-bold text-gray-300 animate-pulse">--</div>
      <div className="text-xs sm:text-sm text-gray-400">Cargando...</div>
    </div>
  );
}

// Skeleton para el calendario completo
// IMPORTANTE: Este componente muestra texto real para mejorar el LCP
export function SkeletonCalendario() {
  const hoy = new Date();
  const dia = hoy.getDate();
  const mes = hoy.toLocaleDateString('es', { month: 'long' });
  const año = hoy.getFullYear();
  const diaSemana = hoy.toLocaleDateString('es', { weekday: 'long' });

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header de navegación con contenido real */}
      <div className="flex justify-between items-center px-4 py-3 border-b bg-gradient-to-r from-lavender-50 to-white">
        <button className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-lavender-100 rounded-lg opacity-50">
          <span className="text-lavender-700 font-medium">←</span>
        </button>
        <div className="text-center">
          <div className="font-semibold text-warm-800 capitalize">{diaSemana} {dia}</div>
          <div className="text-xs text-warm-500">{mes} {año}</div>
          <span className="text-xs text-lavender-600">Cargando...</span>
        </div>
        <button className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-lavender-100 rounded-lg opacity-50">
          <span className="text-lavender-700 font-medium">→</span>
        </button>
      </div>

      {/* Contenido del calendario - Vista móvil (1 día) */}
      <div className="p-4 min-h-[350px]">
        {/* Fecha grande con contenido real */}
        <div className="text-center mb-4 pb-3 border-b border-lavender-200">
          <div className="text-3xl font-bold text-lavender-600">{dia}</div>
          <div className="text-warm-500 capitalize">{mes} {año}</div>
          <span className="inline-block mt-2 text-xs bg-lavender-500 text-white px-2 py-0.5 rounded-full">
            Hoy
          </span>
        </div>

        {/* Mensaje de carga */}
        <div className="text-center py-8">
          <div className="animate-pulse text-warm-400 text-sm">
            Cargando actividades...
          </div>
        </div>

        {/* Actividades placeholder */}
        <SkeletonActividadCard />
        <SkeletonActividadCard />
      </div>

      {/* Indicador de swipe */}
      <div className="sm:hidden flex justify-center py-2 border-t bg-warm-50">
        <span className="text-xs text-warm-400">← Desliza para navegar →</span>
      </div>
    </div>
  );
}

// Skeleton para resumen de actividades de hoy
// IMPORTANTE: Muestra contenido real para mejorar el LCP
export function SkeletonResumenHoy() {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h3 className="font-semibold text-gray-900 mb-3">📌 Actividades de Hoy</h3>
      <div className="flex flex-wrap gap-3">
        <div className="animate-pulse text-gray-400 text-sm py-2">
          Cargando actividades del día...
        </div>
      </div>
    </div>
  );
}
