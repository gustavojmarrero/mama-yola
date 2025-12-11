import { useState, useEffect } from 'react';
import {
  SolicitudMaterial,
  EstadoSolicitudMaterial,
  UrgenciaMaterial,
} from '../../types';

interface DetalleSolicitudModalProps {
  isOpen: boolean;
  onClose: () => void;
  solicitud: SolicitudMaterial | null;
  modo: 'ver' | 'aprobar' | 'rechazar' | 'comprar' | 'entregar';
  puedeAprobar: boolean;
  onConfirmar: (datos: {
    accion: 'aprobar' | 'rechazar' | 'comprar' | 'entregar';
    notas?: string;
    motivoRechazo?: string;
    costoTotal?: number;
  }) => Promise<void>;
}

// Configuración de estados
const ESTADO_CONFIG: Record<EstadoSolicitudMaterial, { label: string; color: string; icon: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  aprobada: { label: 'Aprobada', color: 'bg-blue-100 text-blue-800', icon: '✓' },
  rechazada: { label: 'Rechazada', color: 'bg-red-100 text-red-800', icon: '✗' },
  comprada: { label: 'Comprada', color: 'bg-purple-100 text-purple-800', icon: '🛍️' },
  entregada: { label: 'Entregada', color: 'bg-green-100 text-green-800', icon: '✓✓' },
};

// Configuración de urgencia
const URGENCIA_CONFIG: Record<UrgenciaMaterial, { label: string; color: string; icon: string }> = {
  baja: { label: 'Baja', color: 'text-gray-500', icon: '🔵' },
  normal: { label: 'Normal', color: 'text-blue-600', icon: '🟢' },
  alta: { label: 'Alta', color: 'text-orange-600', icon: '🟠' },
  urgente: { label: 'Urgente', color: 'text-red-600', icon: '🔴' },
};

const CATEGORIA_ICONS: Record<string, string> = {
  medicamento: '💊',
  material: '🩹',
  consumible: '📦',
};

export default function DetalleSolicitudModal({
  isOpen,
  onClose,
  solicitud,
  modo,
  puedeAprobar,
  onConfirmar,
}: DetalleSolicitudModalProps) {
  const [loading, setLoading] = useState(false);
  const [notas, setNotas] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [costoTotal, setCostoTotal] = useState<string>('');

  // Reset form cuando cambia el modo o se abre
  useEffect(() => {
    if (isOpen) {
      setNotas('');
      setMotivoRechazo('');
      setCostoTotal('');
    }
  }, [isOpen, modo]);

  const handleConfirmar = async () => {
    if (modo === 'rechazar' && !motivoRechazo.trim()) {
      alert('Debes indicar un motivo de rechazo');
      return;
    }

    setLoading(true);
    try {
      await onConfirmar({
        accion: modo as 'aprobar' | 'rechazar' | 'comprar' | 'entregar',
        notas: notas || undefined,
        motivoRechazo: motivoRechazo || undefined,
        costoTotal: costoTotal ? parseFloat(costoTotal) : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  // Formatear fecha
  const formatFecha = (fecha: Date | undefined) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen || !solicitud) return null;

  const estadoConfig = ESTADO_CONFIG[solicitud.estado];
  const urgenciaConfig = URGENCIA_CONFIG[solicitud.urgencia];

  // Determinar título y acción según el modo
  const getTitulo = () => {
    switch (modo) {
      case 'aprobar':
        return '✓ Aprobar Solicitud';
      case 'rechazar':
        return '✗ Rechazar Solicitud';
      case 'comprar':
        return '🛍️ Marcar como Comprada';
      case 'entregar':
        return '📦 Marcar como Entregada';
      default:
        return '📋 Detalle de Solicitud';
    }
  };

  const getBotonAccion = () => {
    switch (modo) {
      case 'aprobar':
        return { texto: 'Aprobar', color: 'bg-green-600 hover:bg-green-700' };
      case 'rechazar':
        return { texto: 'Rechazar', color: 'bg-red-600 hover:bg-red-700' };
      case 'comprar':
        return { texto: 'Confirmar Compra', color: 'bg-purple-600 hover:bg-purple-700' };
      case 'entregar':
        return { texto: 'Confirmar Entrega', color: 'bg-green-600 hover:bg-green-700' };
      default:
        return null;
    }
  };

  const botonAccion = getBotonAccion();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{getTitulo()}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl p-2"
            >
              ×
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Info general */}
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${estadoConfig.color}`}>
              {estadoConfig.icon} {estadoConfig.label}
            </span>
            <span className={`text-sm ${urgenciaConfig.color}`}>
              {urgenciaConfig.icon} {urgenciaConfig.label}
            </span>
          </div>

          {/* Solicitante */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Solicitado por:</span>
                <div className="font-medium text-gray-900">{solicitud.solicitadoPorNombre}</div>
              </div>
              <div>
                <span className="text-gray-500">Fecha:</span>
                <div className="font-medium text-gray-900">{formatFecha(solicitud.creadoEn)}</div>
              </div>
              {solicitud.fechaNecesaria && (
                <div className="col-span-2">
                  <span className="text-gray-500">Fecha necesaria:</span>
                  <div className="font-medium text-orange-600">{formatFecha(solicitud.fechaNecesaria)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Lista de items */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">
              Items solicitados ({solicitud.items.length})
            </h3>
            <div className="space-y-2">
              {solicitud.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{CATEGORIA_ICONS[item.categoria] || '📦'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{item.nombre}</span>
                        {item.origenItem === 'nuevo' && (
                          <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                            ✨ Nuevo
                          </span>
                        )}
                      </div>
                      {item.motivo && (
                        <div className="text-xs text-gray-500">{item.motivo}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      {item.cantidad} {item.unidad}
                    </div>
                    {item.cantidadActualInventario !== undefined && (
                      <div className="text-xs text-gray-500">
                        Stock actual: {item.cantidadActualInventario}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Motivo general */}
          {solicitud.motivoGeneral && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Motivo</h3>
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                {solicitud.motivoGeneral}
              </div>
            </div>
          )}

          {/* Timeline de estados */}
          {(solicitud.revisadoPor || solicitud.compradoPor || solicitud.entregadoPor) && (
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Historial</h3>
              <div className="space-y-3 text-sm">
                {solicitud.revisadoPor && (
                  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                    <span className="text-blue-600">✓</span>
                    <div>
                      <div className="font-medium text-blue-800">
                        {solicitud.estado === 'rechazada' ? 'Rechazada' : 'Aprobada'} por{' '}
                        {solicitud.revisadoPorNombre}
                      </div>
                      <div className="text-blue-600 text-xs">{formatFecha(solicitud.revisadoEn)}</div>
                      {solicitud.motivoRechazo && (
                        <div className="mt-1 text-red-600">Motivo: {solicitud.motivoRechazo}</div>
                      )}
                    </div>
                  </div>
                )}
                {solicitud.compradoPor && (
                  <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                    <span className="text-purple-600">🛍️</span>
                    <div>
                      <div className="font-medium text-purple-800">
                        Comprada por {solicitud.compradoPorNombre}
                      </div>
                      <div className="text-purple-600 text-xs">{formatFecha(solicitud.compradoEn)}</div>
                      {solicitud.costoTotal && (
                        <div className="mt-1 text-purple-700 font-medium">
                          Costo: ${solicitud.costoTotal.toLocaleString()}
                        </div>
                      )}
                      {solicitud.notasCompra && (
                        <div className="mt-1 text-purple-600">{solicitud.notasCompra}</div>
                      )}
                    </div>
                  </div>
                )}
                {solicitud.entregadoPor && (
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                    <span className="text-green-600">✓✓</span>
                    <div>
                      <div className="font-medium text-green-800">
                        Entregada por {solicitud.entregadoPorNombre}
                      </div>
                      <div className="text-green-600 text-xs">{formatFecha(solicitud.entregadoEn)}</div>
                      {solicitud.notasEntrega && (
                        <div className="mt-1 text-green-600">{solicitud.notasEntrega}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formulario según el modo */}
          {modo === 'rechazar' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de rechazo *
              </label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Indica el motivo del rechazo..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                required
              />
            </div>
          )}

          {modo === 'comprar' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Costo total (opcional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoTotal}
                    onChange={(e) => setCostoTotal(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas de compra (opcional)
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ej: Comprado en Farmacia del Ahorro..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>
            </div>
          )}

          {(modo === 'aprobar' || modo === 'entregar') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas (opcional)
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder={
                  modo === 'aprobar'
                    ? 'Comentarios sobre la aprobación...'
                    : 'Notas sobre la entrega...'
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lavender-500 text-sm"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 sm:p-6">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              {modo === 'ver' ? 'Cerrar' : 'Cancelar'}
            </button>
            {botonAccion && puedeAprobar && (
              <button
                onClick={handleConfirmar}
                disabled={loading || (modo === 'rechazar' && !motivoRechazo.trim())}
                className={`flex-1 px-4 py-3 text-white font-medium rounded-lg transition-colors ${
                  loading || (modo === 'rechazar' && !motivoRechazo.trim())
                    ? 'bg-gray-400 cursor-not-allowed'
                    : botonAccion.color
                }`}
              >
                {loading ? 'Procesando...' : botonAccion.texto}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
