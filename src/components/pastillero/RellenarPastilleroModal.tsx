import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ItemInventario } from '../../types';

interface ItemConDosis extends ItemInventario {
  dosisDelDia: number;
  diasEstimados: number;
}

// Formatear números para mostrar fracciones comunes o redondear
function formatearNumero(num: number): string {
  // Si es entero, mostrar sin decimales
  if (Number.isInteger(num)) return num.toString();

  // Fracciones comunes
  const fracciones: [number, string][] = [
    [0.25, '¼'],
    [0.5, '½'],
    [0.75, '¾'],
    [1/7, '1/7'],
    [2/7, '2/7'],
    [3/7, '3/7'],
    [1.5, '1½'],
    [2.5, '2½'],
    [3.5, '3½'],
  ];

  for (const [valor, simbolo] of fracciones) {
    if (Math.abs(num - valor) < 0.001) return simbolo;
  }

  // Si no es fracción conocida, redondear a 1 decimal
  return num.toFixed(1);
}

interface RellenarPastilleroModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ItemConDosis[];
  onConfirmar: (items: Array<{ itemId: string; cantidad: number }>) => Promise<void>;
}

export default function RellenarPastilleroModal({
  isOpen,
  onClose,
  items,
  onConfirmar,
}: RellenarPastilleroModalProps) {
  const [confirmado, setConfirmado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  // Calcular rango de la semana
  const hoy = new Date();
  const inicioSemana = startOfWeek(hoy, { weekStartsOn: 1 }); // Lunes
  const finSemana = endOfWeek(hoy, { weekStartsOn: 1 }); // Domingo

  // Calcular cantidades necesarias para la semana
  const itemsConCalculo = useMemo(() => {
    return items.map((item) => {
      const dosisDelDia = item.dosisDelDia || 1;
      const necesarioSemana = dosisDelDia * 7;
      const disponibleTransito = item.cantidadTransito || 0;
      const faltante = Math.max(0, necesarioSemana - disponibleTransito);
      const aPasar = Math.min(disponibleTransito, necesarioSemana);

      // Si no hay cantidad configurada, usar la calculada
      const cantidadFinal = cantidades[item.id] ?? aPasar;

      return {
        ...item,
        necesarioSemana,
        disponibleTransito,
        faltante,
        aPasar,
        cantidadFinal,
      };
    });
  }, [items, cantidades]);

  // Items con stock insuficiente
  const itemsConFaltante = itemsConCalculo.filter((item) => item.faltante > 0);

  const handleCantidadChange = (itemId: string, cantidad: number) => {
    setCantidades((prev) => ({
      ...prev,
      [itemId]: cantidad,
    }));
  };

  const handleConfirmar = async () => {
    if (!confirmado) return;

    setLoading(true);
    try {
      const itemsAPasar = itemsConCalculo
        .filter((item) => item.cantidadFinal > 0)
        .map((item) => ({
          itemId: item.id,
          cantidad: item.cantidadFinal,
        }));

      await onConfirmar(itemsAPasar);
      onClose();
    } catch (error) {
      console.error('Error al confirmar carga:', error);
      alert('Error al registrar la carga del pastillero');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">💊 Rellenar Pastillero Semanal</h2>
              <p className="text-sm text-gray-500 mt-1">
                Semana: {format(inicioSemana, "d 'de' MMMM", { locale: es })} -{' '}
                {format(finSemana, "d 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {/* Alerta de faltantes */}
          {itemsConFaltante.length > 0 && (
            <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <h4 className="font-medium text-orange-800 flex items-center gap-2">
                <span>⚠️</span>
                Stock insuficiente en tránsito
              </h4>
              <ul className="mt-2 space-y-1">
                {itemsConFaltante.map((item) => (
                  <li key={item.id} className="text-sm text-orange-700">
                    • {item.nombre}: Faltan <strong>{formatearNumero(item.faltante)}</strong> {item.unidad} para la semana
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-orange-600">
                Solicita reposición al familiar para estos medicamentos.
              </p>
            </div>
          )}

          {/* Tabla de medicamentos */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Medicamento
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Dosis/Día
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    ×7 Días
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    En Tránsito
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    A Cargar
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {itemsConCalculo.map((item) => {
                  const suficiente = item.faltante === 0;
                  return (
                    <tr
                      key={item.id}
                      className={suficiente ? '' : 'bg-orange-50'}
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{item.nombre}</div>
                        {item.presentacion && (
                          <div className="text-xs text-gray-500">{item.presentacion}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {formatearNumero(item.dosisDelDia)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">
                        {formatearNumero(item.necesarioSemana)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-sm font-medium ${
                            suficiente ? 'text-green-600' : 'text-orange-600'
                          }`}
                        >
                          {item.disponibleTransito}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max={item.disponibleTransito}
                          value={item.cantidadFinal}
                          onChange={(e) =>
                            handleCantidadChange(item.id, parseInt(e.target.value) || 0)
                          }
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {suficiente ? (
                          <span className="text-green-600 text-sm">✓ OK</span>
                        ) : (
                          <span className="text-orange-600 text-sm">
                            Faltan {formatearNumero(item.faltante)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Checkbox de confirmación */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="mt-1 h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-blue-800">
                  Confirmo que he cargado físicamente el pastillero
                </span>
                <p className="text-xs text-blue-600 mt-1">
                  Al confirmar, se descontará el stock del inventario de tránsito y se
                  registrará el movimiento.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={!confirmado || loading}
              className={`flex-1 px-4 py-2 font-medium rounded-lg transition-colors ${
                confirmado && !loading
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Registrando...' : 'Registrar Carga'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
