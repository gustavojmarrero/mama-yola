import {
  InstanciaActividad,
  TIPOS_ACTIVIDAD_CONFIG,
  ESTADOS_INSTANCIA_CONFIG,
  getNombreInstancia,
  getDuracionInstancia,
  getHoraFinalizacion,
} from '../../types/actividades';

interface InstanciaActividadCardProps {
  instancia: InstanciaActividad;
  onClick?: () => void;
  compact?: boolean;
  showActions?: boolean;
  onCompletar?: () => void;
  onOmitir?: () => void;
  onEditar?: () => void;
  puedeEditar?: boolean;
}

export default function InstanciaActividadCard({
  instancia,
  onClick,
  compact = false,
  showActions = false,
  onCompletar,
  onOmitir,
  onEditar,
  puedeEditar = false,
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

  // Estilos - todas las actividades se ven igual (neutras)
  // Solo los slots completados tienen estilo diferente para mostrar que ya se registró
  const getCardStyles = () => {
    // Slots completados - mostrar que ya se registró
    if (instancia.modalidad === 'slot_abierto' && instancia.estado === 'completada') {
      return 'bg-green-50 border border-green-200';
    }
    // Todas las demás actividades - estilo neutro uniforme
    return 'bg-white border border-gray-200';
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
    const isSlot = instancia.modalidad === 'slot_abierto';
    const isSlotPendiente = isSlot && instancia.estado === 'pendiente';
    return (
      <div
        onClick={onClick}
        className={`
          p-2 rounded-lg transition-all
          ${isSlotPendiente && onClick ? 'cursor-pointer hover:shadow-md' : ''}
          ${getCardStyles()}
        `}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{tipoConfig.icon}</span>
          <span className="text-xs font-medium truncate flex-1">{nombre}</span>
          <span className="text-xs text-gray-500">{instancia.horaPreferida}</span>
          {/* Solo mostrar check para slots ya registrados */}
          {isSlot && instancia.estado === 'completada' && (
            <span className="text-green-600">✓</span>
          )}
          {/* Botón editar para familiares/supervisores */}
          {puedeEditar && onEditar && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditar();
              }}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Editar programación"
            >
              <svg className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
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
              <span className="font-medium text-gray-600">
                {instancia.horaPreferida} - {getHoraFinalizacion(instancia.horaPreferida, duracion)}
              </span>
              {ubicacion && (
                <>
                  <span>•</span>
                  <span>{ubicacion}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tipo de actividad y botón editar */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 px-2 py-1">
            {tipoConfig.label}
          </span>
          {puedeEditar && onEditar && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditar();
              }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="Editar programación"
            >
              <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
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

      {/* Botones de acción - SOLO para slots, las definidas son solo informativas */}
      {showActions && instancia.modalidad === 'slot_abierto' && instancia.estado === 'pendiente' && (
        <div className="mt-3 pt-3 border-t border-purple-200 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCompletar?.();
            }}
            className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            Registrar actividad realizada
          </button>
        </div>
      )}
    </div>
  );
}
