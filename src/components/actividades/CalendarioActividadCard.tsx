import { format } from 'date-fns';
import { Actividad, TipoActividad, EstadoActividad } from '../../types';

interface CalendarioActividadCardProps {
  actividad: Actividad;
  onClick: () => void;
  coloresTipo: Record<TipoActividad, string>;
  coloresEstado: Record<EstadoActividad, string>;
  tiposActividad: { value: TipoActividad; label: string; icon: string }[];
  compacto?: boolean;
}

/**
 * Tarjeta de actividad para mostrar en el calendario.
 * En modo compacto (móvil) tiene padding mayor y mejor touch target.
 */
export function CalendarioActividadCard({
  actividad,
  onClick,
  coloresTipo,
  coloresEstado,
  tiposActividad,
  compacto = false
}: CalendarioActividadCardProps) {
  const tipo = tiposActividad.find(t => t.value === actividad.tipo);

  return (
    <div
      onClick={onClick}
      className={`
        mb-2 rounded border-l-4 cursor-pointer
        hover:shadow-md active:scale-[0.98] transition-all
        touch-feedback
        ${coloresTipo[actividad.tipo]}
        ${compacto ? 'p-3' : 'p-2'}
      `}
    >
      <div className="flex items-center gap-1.5">
        <span className={compacto ? 'text-lg' : 'text-base'}>{tipo?.icon}</span>
        <span className={`font-medium truncate ${compacto ? 'text-base' : 'text-sm'}`}>
          {actividad.nombre}
        </span>
      </div>
      <div className={`opacity-75 mt-0.5 ${compacto ? 'text-sm' : 'text-xs'}`}>
        {actividad.fechaInicio && format(actividad.fechaInicio, 'HH:mm')} ({actividad.duracion}min)
      </div>
    </div>
  );
}

export default CalendarioActividadCard;
