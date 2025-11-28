import { ItemInventario } from '../../types';

interface TransitoStatusCardProps {
  item: ItemInventario & {
    dosisDelDia: number;
    diasEstimados: number;
  };
  onSolicitar?: () => void;
}

export default function TransitoStatusCard({ item, onSolicitar }: TransitoStatusCardProps) {
  const cantidadTransito = item.cantidadTransito || 0;
  const nivelMinimo = item.nivelMinimoTransito || 7;
  const esBajo = cantidadTransito <= nivelMinimo;
  const esCritico = cantidadTransito === 0;

  const getEstadoColor = () => {
    if (esCritico) return 'border-red-300 bg-red-50';
    if (esBajo) return 'border-orange-300 bg-orange-50';
    return 'border-green-300 bg-green-50';
  };

  const getEstadoTexto = () => {
    if (esCritico) return { texto: 'Sin stock', color: 'text-red-700', icono: '🔴' };
    if (esBajo) return { texto: 'Stock bajo', color: 'text-orange-700', icono: '🟡' };
    return { texto: 'OK', color: 'text-green-700', icono: '🟢' };
  };

  const estado = getEstadoTexto();

  return (
    <div className={`rounded-lg border-2 p-4 ${getEstadoColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span>{estado.icono}</span>
            <h4 className="font-medium text-gray-900 text-sm">{item.nombre}</h4>
          </div>

          {item.presentacion && (
            <p className="text-xs text-gray-500 mb-2">{item.presentacion}</p>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">En tránsito:</span>
              <span className={`ml-1 font-semibold ${esBajo ? 'text-orange-700' : 'text-blue-700'}`}>
                {cantidadTransito} {item.unidad}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Mínimo:</span>
              <span className="ml-1 font-medium text-gray-700">
                {nivelMinimo} {item.unidad}
              </span>
            </div>
          </div>

          <div className="mt-2 text-xs">
            <span className="text-gray-500">Días estimados:</span>
            <span className={`ml-1 font-semibold ${item.diasEstimados <= 3 ? 'text-red-600' : item.diasEstimados <= 7 ? 'text-orange-600' : 'text-green-600'}`}>
              {item.diasEstimados === 999 ? '—' : `~${item.diasEstimados} días`}
            </span>
            {item.dosisDelDia > 0 && (
              <span className="text-gray-400 ml-1">({item.dosisDelDia} dosis/día)</span>
            )}
          </div>
        </div>

        {esBajo && onSolicitar && (
          <button
            onClick={onSolicitar}
            className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded transition-colors"
            title="Solicitar reposición"
          >
            Pedir
          </button>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="mt-3">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              esCritico ? 'bg-red-500' : esBajo ? 'bg-orange-500' : 'bg-green-500'
            }`}
            style={{
              width: `${Math.min(100, (cantidadTransito / Math.max(nivelMinimo * 2, 1)) * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
