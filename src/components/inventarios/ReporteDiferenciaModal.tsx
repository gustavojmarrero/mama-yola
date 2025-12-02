import { useState, useMemo } from 'react';
import { ItemInventario, TipoInventarioAfectado, Rol } from '../../types';

interface ReporteDiferenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemInventario;
  tiposPermitidos: TipoInventarioAfectado[];
  onEnviar: (
    tipoInventario: TipoInventarioAfectado,
    cantidadReal: number,
    motivo: string
  ) => Promise<void>;
}

const LABELS_TIPO: Record<TipoInventarioAfectado, string> = {
  maestro: 'Inventario Maestro',
  transito: 'Inventario en Tránsito',
  operativo: 'Inventario Operativo',
};

export default function ReporteDiferenciaModal({
  isOpen,
  onClose,
  item,
  tiposPermitidos,
  onEnviar,
}: ReporteDiferenciaModalProps) {
  const [loading, setLoading] = useState(false);
  const [tipoInventario, setTipoInventario] = useState<TipoInventarioAfectado>(
    tiposPermitidos[0] || 'operativo'
  );
  const [cantidadReal, setCantidadReal] = useState<number | ''>('');
  const [motivo, setMotivo] = useState('');

  // Cantidad registrada según el tipo seleccionado
  const cantidadRegistrada = useMemo(() => {
    if (tipoInventario === 'maestro') return item.cantidadMaestro || 0;
    if (tipoInventario === 'transito') return item.cantidadTransito || 0;
    return item.cantidadOperativo || 0;
  }, [item, tipoInventario]);

  // Diferencia calculada
  const diferencia = useMemo(() => {
    if (cantidadReal === '') return 0;
    return cantidadReal - cantidadRegistrada;
  }, [cantidadReal, cantidadRegistrada]);

  const handleEnviar = async () => {
    if (cantidadReal === '' || cantidadReal < 0) {
      alert('Ingresa una cantidad válida');
      return;
    }

    if (!motivo.trim()) {
      alert('Debes indicar el motivo de la diferencia');
      return;
    }

    if (cantidadReal === cantidadRegistrada) {
      alert('La cantidad real es igual a la registrada. No hay diferencia que reportar.');
      return;
    }

    setLoading(true);
    try {
      await onEnviar(tipoInventario, cantidadReal, motivo.trim());
      onClose();
    } catch (error) {
      console.error('Error al enviar reporte:', error);
      alert('Error al enviar el reporte de diferencia');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTipoInventario(tiposPermitidos[0] || 'operativo');
    setCantidadReal('');
    setMotivo('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Reportar Diferencia
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {item.nombre}
                {item.presentacion && ` (${item.presentacion})`}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-6">
          {/* Selector de tipo de inventario */}
          {tiposPermitidos.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de inventario
              </label>
              <div className="space-y-2">
                {tiposPermitidos.map((tipo) => (
                  <label
                    key={tipo}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="tipoInventario"
                      value={tipo}
                      checked={tipoInventario === tipo}
                      onChange={() => setTipoInventario(tipo)}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {LABELS_TIPO[tipo]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Cantidad registrada */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Cantidad según sistema:
              </span>
              <span className="font-semibold text-gray-900">
                {cantidadRegistrada} {item.unidad}
              </span>
            </div>
          </div>

          {/* Cantidad real */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad real encontrada
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1"
                value={cantidadReal}
                onChange={(e) =>
                  setCantidadReal(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="Ingresa la cantidad"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-500">{item.unidad}</span>
            </div>
          </div>

          {/* Diferencia calculada */}
          {cantidadReal !== '' && diferencia !== 0 && (
            <div
              className={`rounded-lg p-4 ${
                diferencia > 0
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`text-sm ${
                    diferencia > 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  Diferencia:
                </span>
                <span
                  className={`font-bold ${
                    diferencia > 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {diferencia > 0 ? '+' : ''}
                  {diferencia} {item.unidad}
                </span>
              </div>
              <p
                className={`text-xs mt-1 ${
                  diferencia > 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {diferencia > 0
                  ? 'Hay más stock del registrado'
                  : 'Hay menos stock del registrado'}
              </p>
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo de la diferencia <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Al contar físicamente encontré menos unidades..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
          <div className="flex gap-4">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleEnviar}
              disabled={
                loading ||
                cantidadReal === '' ||
                !motivo.trim() ||
                cantidadReal === cantidadRegistrada
              }
              className={`flex-1 px-4 py-2 font-medium rounded-lg transition-colors ${
                !loading &&
                cantidadReal !== '' &&
                motivo.trim() &&
                cantidadReal !== cantidadRegistrada
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Enviando...' : 'Enviar Reporte'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
