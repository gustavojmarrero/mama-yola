import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ProcesoDelDia, EstadoProceso } from '../../types';
import { formatearDiferenciaTiempo } from '../../utils/procesosDelDia';
import { format } from 'date-fns';

interface ProcesoCardProps {
  proceso: ProcesoDelDia;
  horaActual: Date;
}

// Estilos por estado
const ESTILOS_ESTADO: Record<
  EstadoProceso,
  { bg: string; border: string; badge: string; badgeText: string }
> = {
  vencido: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    badge: 'bg-red-100 text-red-700',
    badgeText: 'Vencido',
  },
  activo: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    badge: 'bg-blue-100 text-blue-700',
    badgeText: 'Activo',
  },
  proximo: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    badge: 'bg-amber-100 text-amber-700',
    badgeText: 'Próximo',
  },
  pendiente: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-600',
    badgeText: 'Pendiente',
  },
  completado: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    badge: 'bg-green-100 text-green-700',
    badgeText: 'Completado',
  },
};

// Iconos de estado
const ICONOS_ESTADO: Record<EstadoProceso, string> = {
  vencido: '❗',
  activo: '🔵',
  proximo: '⏳',
  pendiente: '⏸️',
  completado: '✓',
};

export default function ProcesoCard({ proceso, horaActual }: ProcesoCardProps) {
  const estilos = ESTILOS_ESTADO[proceso.estado];
  const iconoEstado = ICONOS_ESTADO[proceso.estado];

  // Calcular diferencia de tiempo
  const diffMinutos = Math.round(
    (proceso.horaDate.getTime() - horaActual.getTime()) / (1000 * 60)
  );
  const textoTiempo = proceso.estado === 'completado' && proceso.horaCompletado
    ? `Completado ${format(proceso.horaCompletado, 'HH:mm')}`
    : formatearDiferenciaTiempo(diffMinutos);

  return (
    <div
      className={`${estilos.bg} border ${estilos.border} rounded-lg p-3 transition-all hover:shadow-sm`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Hora */}
          <div className="flex flex-col items-center flex-shrink-0 w-12">
            <span className="text-xs text-gray-500">{iconoEstado}</span>
            <span className="text-sm font-bold text-gray-700">
              {proceso.horaProgramada}
            </span>
          </div>

          {/* Icono del proceso */}
          <span className="text-2xl flex-shrink-0">{proceso.icono}</span>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-gray-900 truncate uppercase text-sm">
              {proceso.nombre}
            </h4>
            {proceso.detalle && (
              <p className="text-sm text-gray-600 truncate">{proceso.detalle}</p>
            )}
            <p className="text-xs text-gray-500 mt-0.5">{textoTiempo}</p>
          </div>
        </div>

        {/* Badge de estado */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${estilos.badge}`}>
            {estilos.badgeText}
          </span>
          {proceso.estado !== 'completado' && (
            <Link
              to={proceso.enlace}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Ir →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProcesoGrupoProps {
  titulo: string;
  procesos: ProcesoDelDia[];
  horaActual: Date;
  colapsable?: boolean;
  colapsadoDefault?: boolean;
}

export function ProcesoGrupo({
  titulo,
  procesos,
  horaActual,
  colapsable = false,
  colapsadoDefault = false,
}: ProcesoGrupoProps) {
  const [colapsado, setColapsado] = useState(colapsadoDefault);

  if (procesos.length === 0) return null;

  return (
    <div className="mb-4">
      <div
        className={`flex items-center gap-2 mb-2 ${colapsable ? 'cursor-pointer' : ''}`}
        onClick={() => colapsable && setColapsado(!colapsado)}
      >
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {titulo} ({procesos.length})
        </h4>
        {colapsable && (
          <span className="text-gray-400 text-xs">
            {colapsado ? '▶' : '▼'}
          </span>
        )}
      </div>
      {!colapsado && (
        <div className="space-y-2">
          {procesos.map((proceso) => (
            <ProcesoCard key={proceso.id} proceso={proceso} horaActual={horaActual} />
          ))}
        </div>
      )}
    </div>
  );
}
