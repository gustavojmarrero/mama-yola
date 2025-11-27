import { useRef } from 'react';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Actividad, TipoActividad, EstadoActividad } from '../../types';
import { useCalendarioView } from '../../hooks/useCalendarioView';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { CalendarioActividadCard } from './CalendarioActividadCard';

interface CalendarioActividadesProps {
  actividades: Actividad[];
  onActividadClick: (actividad: Actividad) => void;
  onAgregarClick: (fecha: Date) => void;
  puedeAgregar: boolean;
  coloresTipo: Record<TipoActividad, string>;
  coloresEstado: Record<EstadoActividad, string>;
  tiposActividad: { value: TipoActividad; label: string; icon: string }[];
}

/**
 * Componente de calendario adaptativo para actividades.
 *
 * Vistas según viewport:
 * - Móvil (<640px): 1 día con swipe
 * - Tablet (640-1023px): 3 días
 * - Desktop (≥1024px): semana completa
 */
export default function CalendarioActividades({
  actividades,
  onActividadClick,
  onAgregarClick,
  puedeAgregar,
  coloresTipo,
  coloresEstado,
  tiposActividad
}: CalendarioActividadesProps) {
  const calendarioRef = useRef<HTMLDivElement>(null);

  const {
    vista,
    fechaCentral,
    diasVisibles,
    irAnterior,
    irSiguiente,
    irAHoy,
    animacion,
    isAnimating
  } = useCalendarioView();

  // Habilitar swipe solo en móvil y tablet
  useSwipeGesture(calendarioRef, {
    onSwipeLeft: irSiguiente,
    onSwipeRight: irAnterior,
    enabled: vista !== 'semana',
    threshold: 50
  });

  function actividadesDelDia(fecha: Date): Actividad[] {
    return actividades.filter(a => a.fechaInicio && isSameDay(a.fechaInicio, fecha));
  }

  // Clases de animación
  const animacionClase = animacion === 'entrada-derecha'
    ? 'animate-slide-in-right'
    : animacion === 'entrada-izquierda'
      ? 'animate-slide-in-left'
      : '';

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* ========== NAVEGACIÓN MÓVIL (< 640px) ========== */}
      <div className="flex sm:hidden justify-between items-center px-4 py-3 border-b bg-gradient-to-r from-lavender-50 to-white">
        <button
          onClick={irAnterior}
          disabled={isAnimating}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center
                     hover:bg-lavender-100 rounded-lg disabled:opacity-50
                     active:scale-95 transition-transform touch-feedback"
          aria-label="Día anterior"
        >
          <span className="text-lavender-700 font-medium">←</span>
        </button>
        <div className="text-center">
          <div className="font-semibold text-warm-800 capitalize">
            {format(fechaCentral, "EEEE d", { locale: es })}
          </div>
          <div className="text-xs text-warm-500">
            {format(fechaCentral, "MMMM yyyy", { locale: es })}
          </div>
          <button
            onClick={irAHoy}
            className="text-xs text-lavender-600 hover:text-lavender-700 hover:underline mt-0.5"
          >
            Ir a hoy
          </button>
        </div>
        <button
          onClick={irSiguiente}
          disabled={isAnimating}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center
                     hover:bg-lavender-100 rounded-lg disabled:opacity-50
                     active:scale-95 transition-transform touch-feedback"
          aria-label="Día siguiente"
        >
          <span className="text-lavender-700 font-medium">→</span>
        </button>
      </div>

      {/* ========== NAVEGACIÓN TABLET (640px - 1023px) ========== */}
      <div className="hidden sm:flex lg:hidden justify-between items-center px-4 py-3 border-b bg-gradient-to-r from-lavender-50 to-white">
        <button
          onClick={irAnterior}
          disabled={isAnimating}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center
                     hover:bg-lavender-100 rounded-lg disabled:opacity-50
                     active:scale-95 transition-transform"
          aria-label="Día anterior"
        >
          <span className="text-lavender-700 font-medium">← Anterior</span>
        </button>
        <div className="flex gap-6 items-center">
          {diasVisibles.map((dia, idx) => {
            const esHoy = isSameDay(dia, new Date());
            const esCentral = idx === 1;
            return (
              <div
                key={idx}
                className={`text-center px-3 py-1 rounded-lg transition-colors
                  ${esCentral ? 'bg-lavender-100' : ''}
                  ${esHoy ? 'ring-2 ring-lavender-400' : ''}
                `}
              >
                <div className={`text-xs uppercase ${esCentral ? 'text-lavender-700 font-semibold' : 'text-warm-500'}`}>
                  {format(dia, 'EEE', { locale: es })}
                </div>
                <div className={`text-lg ${esCentral ? 'font-bold text-lavender-800' : 'text-warm-600'}`}>
                  {format(dia, 'd')}
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={irSiguiente}
          disabled={isAnimating}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center
                     hover:bg-lavender-100 rounded-lg disabled:opacity-50
                     active:scale-95 transition-transform"
          aria-label="Día siguiente"
        >
          <span className="text-lavender-700 font-medium">Siguiente →</span>
        </button>
      </div>

      {/* ========== NAVEGACIÓN DESKTOP (≥ 1024px) ========== */}
      <div className="hidden lg:flex items-center justify-between p-4 border-b bg-gradient-to-r from-lavender-50 to-white">
        <button
          onClick={irAnterior}
          className="p-2 hover:bg-lavender-100 rounded-lg transition-colors"
        >
          ← Anterior
        </button>
        <div className="text-center">
          <h2 className="font-semibold text-warm-800">
            {format(diasVisibles[0], "d 'de' MMMM", { locale: es })} - {format(diasVisibles[diasVisibles.length - 1], "d 'de' MMMM yyyy", { locale: es })}
          </h2>
          <button
            onClick={irAHoy}
            className="text-sm text-lavender-600 hover:text-lavender-700 hover:underline"
          >
            Ir a hoy
          </button>
        </div>
        <button
          onClick={irSiguiente}
          className="p-2 hover:bg-lavender-100 rounded-lg transition-colors"
        >
          Siguiente →
        </button>
      </div>

      {/* ========== HEADERS DE DÍAS (solo tablet y desktop) ========== */}
      <div className={`hidden sm:grid sm:grid-cols-3 lg:grid-cols-7 border-b ${animacionClase}`}>
        {diasVisibles.map((dia, idx) => {
          const esHoy = isSameDay(dia, new Date());
          return (
            <div
              key={idx}
              className={`p-3 text-center border-r last:border-r-0 ${esHoy ? 'bg-lavender-50' : ''}`}
            >
              <div className="text-sm text-warm-500">{format(dia, 'EEE', { locale: es })}</div>
              <div className={`text-lg font-semibold ${esHoy ? 'text-lavender-600' : 'text-warm-800'}`}>
                {format(dia, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========== CONTENIDO DEL CALENDARIO ========== */}
      <div
        ref={calendarioRef}
        className={`
          grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7
          min-h-[350px] sm:min-h-[350px] lg:min-h-[400px]
          ${animacionClase}
        `}
      >
        {diasVisibles.map((dia, idx) => {
          const actsDia = actividadesDelDia(dia);
          const esHoy = isSameDay(dia, new Date());

          return (
            <div
              key={idx}
              className={`
                border-r last:border-r-0 p-3 sm:p-2
                ${esHoy ? 'bg-lavender-50/30' : ''}
              `}
            >
              {/* Mostrar fecha completa en vista móvil */}
              {vista === 'dia' && (
                <div className={`text-center mb-4 pb-3 border-b ${esHoy ? 'border-lavender-200' : 'border-warm-200'}`}>
                  <div className={`text-3xl font-bold ${esHoy ? 'text-lavender-600' : 'text-warm-800'}`}>
                    {format(dia, 'd')}
                  </div>
                  <div className="text-warm-500 capitalize">
                    {format(dia, "MMMM yyyy", { locale: es })}
                  </div>
                  {esHoy && (
                    <span className="inline-block mt-2 text-xs bg-lavender-500 text-white px-2 py-0.5 rounded-full">
                      Hoy
                    </span>
                  )}
                </div>
              )}

              {actsDia.length === 0 && (
                <p className="text-warm-400 text-sm text-center py-4">
                  Sin actividades
                </p>
              )}

              {actsDia.map(act => (
                <CalendarioActividadCard
                  key={act.id}
                  actividad={act}
                  onClick={() => onActividadClick(act)}
                  coloresTipo={coloresTipo}
                  coloresEstado={coloresEstado}
                  tiposActividad={tiposActividad}
                  compacto={vista === 'dia'}
                />
              ))}

              {puedeAgregar && (
                <button
                  onClick={() => onAgregarClick(dia)}
                  className={`
                    w-full mt-2 text-warm-400 hover:text-lavender-600
                    hover:bg-lavender-50 rounded border border-dashed border-warm-300
                    hover:border-lavender-400 transition-colors
                    active:scale-[0.98] touch-feedback
                    ${vista === 'dia' ? 'p-3 text-sm' : 'p-2 text-xs'}
                  `}
                >
                  + Agregar
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Indicador de swipe - solo móvil */}
      {vista !== 'semana' && (
        <div className="sm:hidden flex justify-center gap-1 py-2 border-t bg-warm-50">
          <span className="text-xs text-warm-400">← Desliza para navegar →</span>
        </div>
      )}
    </div>
  );
}
