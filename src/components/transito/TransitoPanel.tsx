import { useState } from 'react';
import TransitoStatusCard from './TransitoStatusCard';
import { ItemInventario } from '../../types';

interface ItemConDosis extends ItemInventario {
  dosisDelDia: number;
  diasEstimados: number;
}

interface TransitoPanelProps {
  items: ItemConDosis[];
  loading: boolean;
  onSolicitarReposicion: () => void;
  onRellenarPastillero: () => void;
}

export default function TransitoPanel({
  items,
  loading,
  onSolicitarReposicion,
  onRellenarPastillero,
}: TransitoPanelProps) {
  const [expandido, setExpandido] = useState(false);

  // Calcular estadísticas
  const totalItems = items.length;
  const itemsBajos = items.filter(
    (i) => (i.cantidadTransito || 0) <= (i.nivelMinimoTransito || 0)
  );
  const itemsCriticos = items.filter((i) => (i.cantidadTransito || 0) === 0);
  const itemsOk = totalItems - itemsBajos.length;

  // Porcentaje de items OK
  const porcentajeOk = totalItems > 0 ? Math.round((itemsOk / totalItems) * 100) : 100;

  // Estado general
  const getEstadoGeneral = () => {
    if (itemsCriticos.length > 0) return { color: 'bg-red-500', texto: 'Crítico', icono: '🔴' };
    if (itemsBajos.length > 0) return { color: 'bg-orange-500', texto: 'Bajo', icono: '🟡' };
    return { color: 'bg-green-500', texto: 'OK', icono: '🟢' };
  };

  const estadoGeneral = getEstadoGeneral();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow mb-4 overflow-hidden">
      {/* Header colapsable */}
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">📦</span>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Mi Tránsito</h3>
            <p className="text-xs text-gray-500">
              Stock de medicamentos disponible para cargar el pastillero
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Estado general */}
          <div className="flex items-center gap-2">
            <span>{estadoGeneral.icono}</span>
            <span className="text-sm font-medium">{porcentajeOk}% OK</span>
          </div>

          {/* Alertas */}
          {itemsBajos.length > 0 && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
              {itemsBajos.length} bajo{itemsBajos.length > 1 ? 's' : ''}
            </span>
          )}

          {/* Flecha */}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expandido ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Barra de progreso general */}
      <div className="px-4 pb-2">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${estadoGeneral.color}`}
            style={{ width: `${porcentajeOk}%` }}
          />
        </div>
      </div>

      {/* Contenido expandible */}
      {expandido && (
        <div className="border-t border-gray-100">
          {/* Botones de acción */}
          <div className="p-4 bg-gray-50 flex flex-wrap gap-2">
            <button
              onClick={onRellenarPastillero}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              💊 Rellenar Pastillero Semanal
            </button>

            {itemsBajos.length > 0 && (
              <button
                onClick={onSolicitarReposicion}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                📨 Solicitar Reposición ({itemsBajos.length})
              </button>
            )}
          </div>

          {/* Lista de items */}
          <div className="p-4">
            {items.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                No hay medicamentos vinculados al pastillero
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((item) => (
                  <TransitoStatusCard
                    key={item.id}
                    item={item}
                    onSolicitar={
                      (item.cantidadTransito || 0) <= (item.nivelMinimoTransito || 0)
                        ? onSolicitarReposicion
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Resumen */}
          {totalItems > 0 && (
            <div className="px-4 pb-4 pt-2 border-t border-gray-100">
              <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  {itemsOk} OK
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  {itemsBajos.length - itemsCriticos.length} Bajos
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  {itemsCriticos.length} Críticos
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
