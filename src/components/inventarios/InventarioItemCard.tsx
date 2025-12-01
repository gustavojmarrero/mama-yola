import { ItemInventario, CategoriaInventario, TipoMovimiento } from '../../types';

interface InventarioItemCardProps {
  item: ItemInventario;
  puedeEditar: boolean;
  puedeVerMaestro: boolean;
  categorias: { value: CategoriaInventario; label: string; icon: string }[];
  onMovimiento: (
    item: ItemInventario,
    tipo: TipoMovimiento,
    destino?: 'transito' | 'operativo',
    origen?: 'maestro' | 'transito'
  ) => void;
  onEditar: (item: ItemInventario) => void;
  onReportarDiferencia?: (item: ItemInventario) => void;
  getEstadoItem: (item: ItemInventario) => 'critico' | 'bajo' | 'ok';
  getEstadoColor: (estado: string) => string;
  getEstadoLabel: (estado: string) => string;
  calcularDiasRestantes: (item: ItemInventario) => number;
  itemPorAgotarse: (item: ItemInventario) => boolean;
}

export default function InventarioItemCard({
  item,
  puedeEditar,
  puedeVerMaestro,
  categorias,
  onMovimiento,
  onEditar,
  onReportarDiferencia,
  getEstadoItem,
  getEstadoColor,
  getEstadoLabel,
  calcularDiasRestantes,
  itemPorAgotarse,
}: InventarioItemCardProps) {
  const estado = getEstadoItem(item);
  const catInfo = categorias.find((c) => c.value === item.categoria);
  const porAgotarse = itemPorAgotarse(item);

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm ${
        porAgotarse ? 'border-orange-300 bg-orange-50/50' : 'border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl flex-shrink-0">{catInfo?.icon}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {item.nombre}
                {item.tieneVidaUtil && item.vidaUtilDias && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded-full">
                    {item.vidaUtilDias}d
                  </span>
                )}
              </h3>
              {item.presentacion && (
                <p className="text-sm text-gray-500 truncate">{item.presentacion}</p>
              )}
            </div>
          </div>
          <span
            className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium border ${getEstadoColor(
              estado
            )}`}
          >
            {getEstadoLabel(estado)}
          </span>
        </div>
      </div>

      {/* Cantidades */}
      <div className="p-4">
        <div className={`grid ${
          puedeVerMaestro
            ? (item.vinculadoPastillero ? 'grid-cols-3' : 'grid-cols-2')
            : (item.vinculadoPastillero ? 'grid-cols-2' : 'grid-cols-1')
        } gap-3 text-center`}>
          {/* Maestro - Solo visible para no-cuidadores */}
          {puedeVerMaestro && (
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-500 mb-1">🏪 Maestro</div>
              <div className="text-lg font-bold text-gray-900">
                {item.cantidadMaestro}
              </div>
              <div className="text-[10px] text-gray-400">
                mín: {item.nivelMinimoMaestro}
              </div>
            </div>
          )}

          {/* Tránsito (solo si vinculado a pastillero) */}
          {item.vinculadoPastillero && (
            <div className="bg-blue-50 rounded-lg p-2">
              <div className="text-xs text-gray-500 mb-1">📦 Tránsito</div>
              <div
                className={`text-lg font-bold ${
                  (item.cantidadTransito || 0) <= (item.nivelMinimoTransito || 0)
                    ? 'text-orange-600'
                    : 'text-blue-600'
                }`}
              >
                {item.cantidadTransito || 0}
              </div>
              <div className="text-[10px] text-gray-400">
                mín: {item.nivelMinimoTransito || 7}
              </div>
            </div>
          )}

          {/* Operativo */}
          <div className="bg-purple-50 rounded-lg p-2">
            <div className="text-xs text-gray-500 mb-1">💊 Operativo</div>
            {item.tieneVidaUtil ? (
              <>
                <div
                  className={`text-lg font-bold ${
                    porAgotarse ? 'text-orange-600' : 'text-purple-600'
                  }`}
                >
                  {Math.round(item.cantidadOperativo)}%
                </div>
                {/* Barra de progreso */}
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      porAgotarse ? 'bg-orange-500' : 'bg-purple-600'
                    }`}
                    style={{ width: `${Math.min(100, item.cantidadOperativo)}%` }}
                  />
                </div>
                {item.fechaInicioConsumo ? (
                  <div
                    className={`text-[10px] mt-1 ${
                      porAgotarse ? 'text-orange-600 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {calcularDiasRestantes(item)}d restantes
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-400 italic mt-1">
                    Sin iniciar
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-gray-900">
                  {item.cantidadOperativo}
                </div>
                <div className="text-[10px] text-gray-400">
                  mín: {item.nivelMinimoOperativo}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Acciones */}
      {puedeEditar && (
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {/* Entrada - Solo si puede ver maestro */}
            {puedeVerMaestro && (
              <button
                onClick={() => onMovimiento(item, 'entrada')}
                className="flex-1 min-w-[60px] px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 text-sm font-medium rounded-lg transition-colors"
                title="Entrada (Compra al Maestro)"
              >
                ➕ Entrada
              </button>
            )}

            {item.vinculadoPastillero ? (
              <>
                {/* M→T - Solo si puede ver maestro */}
                {puedeVerMaestro && (
                  <button
                    onClick={() => onMovimiento(item, 'transferencia', 'transito', 'maestro')}
                    className="flex-1 min-w-[60px] px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium rounded-lg transition-colors"
                    title="Maestro → Tránsito"
                  >
                    M→T
                  </button>
                )}
                {/* T→O - Visible para todos */}
                <button
                  onClick={() => onMovimiento(item, 'transferencia', 'operativo', 'transito')}
                  className="flex-1 min-w-[60px] px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-medium rounded-lg transition-colors"
                  title="Tránsito → Operativo"
                >
                  T→O
                </button>
              </>
            ) : (
              /* Transferir M→O - Solo si puede ver maestro */
              puedeVerMaestro && (
                <button
                  onClick={() => onMovimiento(item, 'transferencia', 'operativo', 'maestro')}
                  className="flex-1 min-w-[60px] px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium rounded-lg transition-colors"
                  title="Maestro → Operativo"
                >
                  ↔️ Transferir
                </button>
              )
            )}

            <button
              onClick={() => onMovimiento(item, 'salida')}
              className="flex-1 min-w-[60px] px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
              title="Salida (Consumo)"
            >
              ➖ Salida
            </button>

            <button
              onClick={() => onEditar(item)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              title="Editar"
            >
              ✏️
            </button>
          </div>
        </div>
      )}

      {/* Solo lectura */}
      {!puedeEditar && (
        <div className="px-4 pb-4 flex items-center justify-between">
          <span className="text-gray-400 text-xs italic">Solo lectura</span>
          {onReportarDiferencia && (
            <button
              onClick={() => onReportarDiferencia(item)}
              className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-medium rounded-lg transition-colors"
              title="Reportar diferencia de inventario"
            >
              Reportar diferencia
            </button>
          )}
        </div>
      )}

      {/* Botón reportar diferencia para usuarios con permisos de edición */}
      {puedeEditar && onReportarDiferencia && (
        <div className="px-4 pb-4 pt-0">
          <button
            onClick={() => onReportarDiferencia(item)}
            className="w-full px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium rounded-lg transition-colors border border-amber-200"
            title="Reportar diferencia de inventario"
          >
            Reportar diferencia
          </button>
        </div>
      )}
    </div>
  );
}
