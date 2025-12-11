import { SolicitudMaterial, EstadoSolicitudMaterial, UrgenciaMaterial, Rol } from '../../types';

interface SolicitudMaterialCardProps {
  solicitud: SolicitudMaterial;
  usuarioRol: Rol;
  usuarioId: string;
  onVerDetalle: (solicitud: SolicitudMaterial) => void;
  onAprobar?: (solicitud: SolicitudMaterial) => void;
  onRechazar?: (solicitud: SolicitudMaterial) => void;
  onMarcarComprada?: (solicitud: SolicitudMaterial) => void;
  onMarcarEntregada?: (solicitud: SolicitudMaterial) => void;
  onCancelar?: (solicitud: SolicitudMaterial) => void;
}

// Configuración de estados
const ESTADO_CONFIG: Record<EstadoSolicitudMaterial, { label: string; color: string; icon: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '⏳' },
  aprobada: { label: 'Aprobada', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '✓' },
  rechazada: { label: 'Rechazada', color: 'bg-red-100 text-red-800 border-red-200', icon: '✗' },
  comprada: { label: 'Comprada', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: '🛍️' },
  entregada: { label: 'Entregada', color: 'bg-green-100 text-green-800 border-green-200', icon: '✓✓' },
};

// Configuración de urgencia
const URGENCIA_CONFIG: Record<UrgenciaMaterial, { label: string; color: string; icon: string }> = {
  baja: { label: 'Baja', color: 'text-gray-500', icon: '🔵' },
  normal: { label: 'Normal', color: 'text-blue-600', icon: '🟢' },
  alta: { label: 'Alta', color: 'text-orange-600', icon: '🟠' },
  urgente: { label: 'Urgente', color: 'text-red-600', icon: '🔴' },
};

export default function SolicitudMaterialCard({
  solicitud,
  usuarioRol,
  usuarioId,
  onVerDetalle,
  onAprobar,
  onRechazar,
  onMarcarComprada,
  onMarcarEntregada,
  onCancelar,
}: SolicitudMaterialCardProps) {
  const estadoConfig = ESTADO_CONFIG[solicitud.estado];
  const urgenciaConfig = URGENCIA_CONFIG[solicitud.urgencia];

  const puedeAprobar = (usuarioRol === 'familiar' || usuarioRol === 'supervisor') && solicitud.estado === 'pendiente';
  const puedeMarcarComprada = (usuarioRol === 'familiar' || usuarioRol === 'supervisor') && solicitud.estado === 'aprobada';
  const puedeMarcarEntregada = (usuarioRol === 'familiar' || usuarioRol === 'supervisor') && solicitud.estado === 'comprada';
  const puedeCancelar = solicitud.estado === 'pendiente' && solicitud.solicitadoPor === usuarioId;
  const esUrgente = solicitud.urgencia === 'urgente' || solicitud.urgencia === 'alta';

  // Formatear fecha
  const formatFecha = (fecha: Date) => {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow ${
        esUrgente && solicitud.estado === 'pendiente' ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl flex-shrink-0">🛒</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">
                  {solicitud.items.length} {solicitud.items.length === 1 ? 'item' : 'items'}
                </h3>
                <span className={`text-sm ${urgenciaConfig.color}`}>
                  {urgenciaConfig.icon} {urgenciaConfig.label}
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate">
                Por: {solicitud.solicitadoPorNombre}
              </p>
            </div>
          </div>
          <span
            className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium border ${estadoConfig.color}`}
          >
            {estadoConfig.icon} {estadoConfig.label}
          </span>
        </div>
      </div>

      {/* Items Preview */}
      <div className="p-4">
        <div className="space-y-1.5">
          {solicitud.items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 truncate flex-1">
                {item.origenItem === 'nuevo' && (
                  <span className="text-purple-600 mr-1">✨</span>
                )}
                {item.nombre}
              </span>
              <span className="text-gray-500 ml-2 flex-shrink-0">
                {item.cantidad} {item.unidad}
              </span>
            </div>
          ))}
          {solicitud.items.length > 3 && (
            <div className="text-xs text-gray-400 italic">
              +{solicitud.items.length - 3} items más...
            </div>
          )}
        </div>

        {/* Motivo si existe */}
        {solicitud.motivoGeneral && (
          <div className="mt-3 p-2 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 line-clamp-2">
              💬 {solicitud.motivoGeneral}
            </p>
          </div>
        )}

        {/* Fecha necesaria si existe */}
        {solicitud.fechaNecesaria && (
          <div className="mt-2 text-xs text-gray-500">
            📅 Necesario para: {formatFecha(solicitud.fechaNecesaria)}
          </div>
        )}

        {/* Info de estado */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Creada: {formatFecha(solicitud.creadoEn)}</span>
            {solicitud.costoTotal && (
              <span className="font-medium text-green-600">
                ${solicitud.costoTotal.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onVerDetalle(solicitud)}
            className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            Ver detalle
          </button>

          {puedeAprobar && onAprobar && (
            <button
              onClick={() => onAprobar(solicitud)}
              className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 text-sm font-medium rounded-lg transition-colors"
            >
              Aprobar
            </button>
          )}

          {puedeAprobar && onRechazar && (
            <button
              onClick={() => onRechazar(solicitud)}
              className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
            >
              Rechazar
            </button>
          )}

          {puedeMarcarComprada && onMarcarComprada && (
            <button
              onClick={() => onMarcarComprada(solicitud)}
              className="px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-medium rounded-lg transition-colors"
            >
              Marcar comprada
            </button>
          )}

          {puedeMarcarEntregada && onMarcarEntregada && (
            <button
              onClick={() => onMarcarEntregada(solicitud)}
              className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 text-sm font-medium rounded-lg transition-colors"
            >
              Marcar entregada
            </button>
          )}

          {puedeCancelar && onCancelar && (
            <button
              onClick={() => onCancelar(solicitud)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
