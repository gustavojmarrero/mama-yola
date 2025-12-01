import { useState } from 'react';
import { ReporteDiferencia } from '../../types';

interface ResolucionReporteModalProps {
  isOpen: boolean;
  onClose: () => void;
  reporte: ReporteDiferencia;
  onAprobar: (notas: string, ajustarInventario: boolean) => Promise<void>;
  onRechazar: (notas: string) => Promise<void>;
}

const LABELS_TIPO: Record<string, string> = {
  maestro: 'Maestro',
  transito: 'Tránsito',
  operativo: 'Operativo',
};

export default function ResolucionReporteModal({
  isOpen,
  onClose,
  reporte,
  onAprobar,
  onRechazar,
}: ResolucionReporteModalProps) {
  const [loading, setLoading] = useState(false);
  const [notas, setNotas] = useState('');
  const [ajustarInventario, setAjustarInventario] = useState(true);
  const [accion, setAccion] = useState<'aprobar' | 'rechazar' | null>(null);

  const handleAprobar = async () => {
    setLoading(true);
    setAccion('aprobar');
    try {
      await onAprobar(notas.trim(), ajustarInventario);
      onClose();
    } catch (error) {
      console.error('Error al aprobar:', error);
      alert('Error al aprobar el reporte');
    } finally {
      setLoading(false);
      setAccion(null);
    }
  };

  const handleRechazar = async () => {
    if (!notas.trim()) {
      alert('Debes indicar el motivo del rechazo');
      return;
    }

    setLoading(true);
    setAccion('rechazar');
    try {
      await onRechazar(notas.trim());
      onClose();
    } catch (error) {
      console.error('Error al rechazar:', error);
      alert('Error al rechazar el reporte');
    } finally {
      setLoading(false);
      setAccion(null);
    }
  };

  if (!isOpen) return null;

  const fechaReporte = reporte.creadoEn instanceof Date
    ? reporte.creadoEn.toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Resolver Reporte
              </h2>
              <p className="text-sm text-gray-500 mt-1">{reporte.itemNombre}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-6">
          {/* Info del reporte */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Reportado por:</span>
              <span className="font-medium text-gray-900">
                {reporte.reportadoPorNombre}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Fecha:</span>
              <span className="font-medium text-gray-900">{fechaReporte}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Inventario:</span>
              <span className="font-medium text-gray-900">
                {LABELS_TIPO[reporte.tipoInventario]}
              </span>
            </div>
          </div>

          {/* Diferencia */}
          <div
            className={`rounded-lg p-4 ${
              reporte.diferencia > 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Sistema</p>
                <p className="font-bold text-gray-900">
                  {reporte.cantidadRegistrada}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Real</p>
                <p className="font-bold text-gray-900">{reporte.cantidadReal}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Diferencia</p>
                <p
                  className={`font-bold ${
                    reporte.diferencia > 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {reporte.diferencia > 0 ? '+' : ''}
                  {reporte.diferencia}
                </p>
              </div>
            </div>
          </div>

          {/* Motivo del reporte */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo reportado
            </label>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">{reporte.motivo}</p>
            </div>
          </div>

          {/* Checkbox ajustar inventario */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={ajustarInventario}
                onChange={(e) => setAjustarInventario(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-blue-900">
                  Ajustar inventario automáticamente
                </span>
                <p className="text-xs text-blue-700 mt-1">
                  Al aprobar, el sistema actualizará la cantidad a{' '}
                  {reporte.cantidadReal} unidades
                </p>
              </div>
            </label>
          </div>

          {/* Notas de resolución */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas de resolución
              <span className="text-gray-400 font-normal">
                {' '}
                (obligatorio para rechazar)
              </span>
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Verificado físicamente, procede el ajuste..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleRechazar}
              disabled={loading}
              className={`flex-1 px-4 py-2 font-medium rounded-lg transition-colors ${
                loading && accion === 'rechazar'
                  ? 'bg-gray-300 text-gray-500'
                  : 'bg-red-100 hover:bg-red-200 text-red-700'
              }`}
            >
              {loading && accion === 'rechazar' ? 'Rechazando...' : 'Rechazar'}
            </button>
            <button
              onClick={handleAprobar}
              disabled={loading}
              className={`flex-1 px-4 py-2 font-medium rounded-lg transition-colors ${
                loading && accion === 'aprobar'
                  ? 'bg-gray-300 text-gray-500'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {loading && accion === 'aprobar' ? 'Aprobando...' : 'Aprobar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
