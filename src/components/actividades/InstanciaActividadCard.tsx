import {
  InstanciaActividad,
  TIPOS_ACTIVIDAD_CONFIG,
  ESTADOS_INSTANCIA_CONFIG,
  getNombreInstancia,
  getDuracionInstancia,
} from '../../types/actividades';

interface InstanciaActividadCardProps {
  instancia: InstanciaActividad;
  onClick?: () => void;
  compact?: boolean;
  showActions?: boolean;
  onCompletar?: () => void;
  onOmitir?: () => void;
}

export default function InstanciaActividadCard({
  instancia,
  onClick,
  compact = false,
  showActions = false,
  onCompletar,
  onOmitir,
}: InstanciaActividadCardProps) {
  const tipoConfig = TIPOS_ACTIVIDAD_CONFIG[instancia.tipo];
  const estadoConfig = ESTADOS_INSTANCIA_CONFIG[instancia.estado];
  const nombre = getNombreInstancia(instancia);
  const duracion = getDuracionInstancia(instancia);

  // Determinar si la hora ya pasó (para mostrar como vencida)
  const ahora = new Date();
  const fechaInstancia = new Date(instancia.fecha);
  const [hora, minuto] = instancia.horaPreferida.split(':').map(Number);
  fechaInstancia.setHours(hora, minuto, 0, 0);
  const estaVencida = instancia.estado === 'pendiente' && fechaInstancia < ahora;

  // Estilos según modalidad y estado
  const getCardStyles = () => {
    if (instancia.estado === 'completada') {
      return 'bg-green-50 border-l-4 border-green-400';
    }
    if (instancia.estado === 'omitida' || instancia.estado === 'cancelada') {
      return 'bg-red-50 border-l-4 border-red-400';
    }
    if (estaVencida) {
      return 'bg-red-50 border-l-4 border-red-400';
    }
    if (instancia.modalidad === 'slot_abierto') {
      return 'bg-gray-50 border-2 border-dashed border-gray-300';
    }
    // Actividad definida pendiente
    return 'bg-amber-50 border-l-4 border-amber-400';
  };

  // Ubicación a mostrar
  const ubicacion =
    instancia.actividadDefinida?.ubicacion ||
    instancia.actividadElegida?.ubicacion;

  // Nivel de energía
  const nivelEnergia =
    instancia.actividadDefinida?.nivelEnergia ||
    instancia.actividadElegida?.nivelEnergia;

  const energiaEmoji: Record<string, string> = {
    bajo: '🔋',
    medio: '⚡',
    alto: '🔥',
  };

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`
          p-2 rounded-lg cursor-pointer transition-all hover:shadow-md
          ${getCardStyles()}
        `}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{tipoConfig.icon}</span>
          <span className="text-xs font-medium truncate flex-1">{nombre}</span>
          <span className="text-xs text-gray-500">{instancia.horaPreferida}</span>
          {instancia.estado === 'completada' && (
            <span className="text-green-600">✓</span>
          )}
          {instancia.modalidad === 'slot_abierto' && instancia.estado === 'pendiente' && (
            <span className="text-gray-400">?</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-xl transition-all
        ${getCardStyles()}
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{tipoConfig.icon}</span>
          <div>
            <h4 className="font-semibold text-gray-800">{nombre}</h4>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{instancia.horaPreferida}</span>
              <span>•</span>
              <span>{duracion} min</span>
              {ubicacion && (
                <>
                  <span>•</span>
                  <span>{ubicacion}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Badge de estado */}
        <div
          className={`
            px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1
            ${estadoConfig.bgColor} ${estadoConfig.color}
          `}
        >
          <span>{estadoConfig.icon}</span>
          <span>{estadoConfig.label}</span>
        </div>
      </div>

      {/* Indicador de slot abierto */}
      {instancia.modalidad === 'slot_abierto' && instancia.estado === 'pendiente' && (
        <div className="mb-2 p-2 bg-white/50 rounded-lg border border-dashed border-gray-300">
          <p className="text-xs text-gray-600 italic">
            Elige una actividad {tipoConfig.label.toLowerCase()} al completar
          </p>
        </div>
      )}

      {/* Descripción si existe */}
      {instancia.actividadDefinida?.descripcion && (
        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
          {instancia.actividadDefinida.descripcion}
        </p>
      )}

      {/* Materiales si existen */}
      {instancia.actividadDefinida?.materialesNecesarios &&
        instancia.actividadDefinida.materialesNecesarios.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {instancia.actividadDefinida.materialesNecesarios.slice(0, 3).map((mat, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-white/60 rounded text-xs text-gray-600"
              >
                {mat}
              </span>
            ))}
            {instancia.actividadDefinida.materialesNecesarios.length > 3 && (
              <span className="px-2 py-0.5 text-xs text-gray-500">
                +{instancia.actividadDefinida.materialesNecesarios.length - 3}
              </span>
            )}
          </div>
        )}

      {/* Nivel de energía */}
      {nivelEnergia && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <span>{energiaEmoji[nivelEnergia]}</span>
          <span>Energía {nivelEnergia}</span>
        </div>
      )}

      {/* Info de ejecución si está completada */}
      {instancia.ejecucion && (
        <div className="mt-2 pt-2 border-t border-green-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              Completado por {instancia.ejecucion.completadaPorNombre}
            </span>
            <span className="text-gray-500">
              {instancia.ejecucion.duracionReal} min reales
            </span>
          </div>
          {instancia.ejecucion.participacion && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
              <span>Participación:</span>
              <span className="font-medium capitalize">
                {instancia.ejecucion.participacion}
              </span>
              {instancia.ejecucion.estadoAnimo && (
                <>
                  <span>•</span>
                  <span>{instancia.ejecucion.estadoAnimo}</span>
                </>
              )}
            </div>
          )}
          {instancia.ejecucion.notas && (
            <p className="mt-1 text-xs text-gray-600 italic line-clamp-2">
              {instancia.ejecucion.notas}
            </p>
          )}
        </div>
      )}

      {/* Info de omisión */}
      {instancia.omision && (
        <div className="mt-2 pt-2 border-t border-red-200">
          <p className="text-xs text-red-600">
            <span className="font-medium">Omitida:</span> {instancia.omision.motivo}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Por {instancia.omision.omitidaPorNombre}
          </p>
        </div>
      )}

      {/* Botones de acción */}
      {showActions && instancia.estado === 'pendiente' && (
        <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCompletar?.();
            }}
            className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            {instancia.modalidad === 'slot_abierto' ? 'Elegir y Completar' : 'Completar'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOmitir?.();
            }}
            className="py-2 px-4 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
          >
            Omitir
          </button>
        </div>
      )}
    </div>
  );
}
