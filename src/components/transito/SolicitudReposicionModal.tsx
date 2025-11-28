import { useState, useMemo } from 'react';
import { ItemInventario, ItemSolicitudReposicion, UrgenciaSolicitud } from '../../types';

interface ItemConDosis extends ItemInventario {
  dosisDelDia: number;
  diasEstimados: number;
}

interface SolicitudReposicionModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ItemConDosis[];
  onEnviar: (
    items: ItemSolicitudReposicion[],
    notas: string,
    urgencia: UrgenciaSolicitud
  ) => Promise<void>;
}

export default function SolicitudReposicionModal({
  isOpen,
  onClose,
  items,
  onEnviar,
}: SolicitudReposicionModalProps) {
  const [loading, setLoading] = useState(false);
  const [notas, setNotas] = useState('');
  const [urgencia, setUrgencia] = useState<UrgenciaSolicitud>('normal');
  const [cantidadesSolicitadas, setCantidadesSolicitadas] = useState<Record<string, number>>({});
  const [itemsSeleccionados, setItemsSeleccionados] = useState<Set<string>>(new Set());

  // Filtrar items con stock bajo
  const itemsBajos = useMemo(() => {
    return items.filter(
      (item) => (item.cantidadTransito || 0) <= (item.nivelMinimoTransito || 0)
    );
  }, [items]);

  // Inicializar selección y cantidades
  useMemo(() => {
    const seleccionados = new Set<string>();
    const cantidades: Record<string, number> = {};

    itemsBajos.forEach((item) => {
      seleccionados.add(item.id);
      // Sugerir cantidad para 2 semanas
      const dosisDelDia = item.dosisDelDia || 1;
      const cantidadSugerida = dosisDelDia * 14; // 2 semanas
      cantidades[item.id] = cantidadSugerida;
    });

    setItemsSeleccionados(seleccionados);
    setCantidadesSolicitadas(cantidades);
  }, [itemsBajos]);

  const toggleItem = (itemId: string) => {
    setItemsSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(itemId)) {
        nuevo.delete(itemId);
      } else {
        nuevo.add(itemId);
      }
      return nuevo;
    });
  };

  const handleCantidadChange = (itemId: string, cantidad: number) => {
    setCantidadesSolicitadas((prev) => ({
      ...prev,
      [itemId]: cantidad,
    }));
  };

  const handleEnviar = async () => {
    if (itemsSeleccionados.size === 0) {
      alert('Selecciona al menos un medicamento');
      return;
    }

    setLoading(true);
    try {
      const itemsSolicitud: ItemSolicitudReposicion[] = Array.from(itemsSeleccionados)
        .map((itemId) => {
          const item = items.find((i) => i.id === itemId);
          if (!item) return null;

          return {
            itemId,
            itemNombre: item.nombre,
            cantidadSolicitada: cantidadesSolicitadas[itemId] || 0,
            cantidadActualTransito: item.cantidadTransito || 0,
          };
        })
        .filter((item): item is ItemSolicitudReposicion => item !== null);

      await onEnviar(itemsSolicitud, notas, urgencia);
      onClose();
    } catch (error) {
      console.error('Error al enviar solicitud:', error);
      alert('Error al enviar la solicitud de reposición');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">📨 Solicitar Reposición</h2>
              <p className="text-sm text-gray-500 mt-1">
                Envía una solicitud al familiar para reabastecer el tránsito
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
          {/* Urgencia */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nivel de urgencia
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="urgencia"
                  value="normal"
                  checked={urgencia === 'normal'}
                  onChange={() => setUrgencia('normal')}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">🟢 Normal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="urgencia"
                  value="urgente"
                  checked={urgencia === 'urgente'}
                  onChange={() => setUrgencia('urgente')}
                  className="h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                />
                <span className="text-sm text-orange-700">🔴 Urgente</span>
              </label>
            </div>
          </div>

          {/* Lista de items */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Medicamentos a solicitar
            </label>

            {itemsBajos.length === 0 ? (
              <p className="text-center text-gray-500 py-4 bg-gray-50 rounded-lg">
                No hay medicamentos con stock bajo en tránsito
              </p>
            ) : (
              <div className="space-y-3">
                {itemsBajos.map((item) => {
                  const seleccionado = itemsSeleccionados.has(item.id);
                  const cantidad = cantidadesSolicitadas[item.id] || 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border-2 ${
                        seleccionado
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={seleccionado}
                          onChange={() => toggleItem(item.id)}
                          className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />

                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-medium text-gray-900">{item.nombre}</span>
                              {item.presentacion && (
                                <span className="text-xs text-gray-500 ml-2">
                                  ({item.presentacion})
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-orange-600">
                              En tránsito: {item.cantidadTransito || 0}
                            </span>
                          </div>

                          {seleccionado && (
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-600">Cantidad:</label>
                              <input
                                type="number"
                                min="1"
                                value={cantidad}
                                onChange={(e) =>
                                  handleCantidadChange(item.id, parseInt(e.target.value) || 0)
                                }
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-500">{item.unidad}</span>
                              <span className="text-xs text-gray-400 ml-2">
                                (sugerido: {item.dosisDelDia * 14} para 2 semanas)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas adicionales (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Necesito estos medicamentos para el lunes..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
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
              onClick={handleEnviar}
              disabled={itemsSeleccionados.size === 0 || loading}
              className={`flex-1 px-4 py-2 font-medium rounded-lg transition-colors ${
                itemsSeleccionados.size > 0 && !loading
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Enviando...' : `Enviar Solicitud (${itemsSeleccionados.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
