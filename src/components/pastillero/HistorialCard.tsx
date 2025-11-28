import { RegistroMedicamento, EstadoMedicamento } from '../../types';

interface HistorialCardProps {
  registro: RegistroMedicamento;
  viewMode: 'grid' | 'list';
}

function getEstadoColor(estado: EstadoMedicamento) {
  switch (estado) {
    case 'tomado':
      return 'bg-green-500 text-white';
    case 'rechazado':
      return 'bg-red-500 text-white';
    case 'omitido':
      return 'bg-yellow-500 text-white';
    case 'pendiente':
      return 'bg-blue-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

function getEstadoLabel(estado: EstadoMedicamento) {
  switch (estado) {
    case 'tomado':
      return 'Tomado';
    case 'rechazado':
      return 'Rechazado';
    case 'omitido':
      return 'Omitido';
    case 'pendiente':
      return 'Pendiente';
    default:
      return estado;
  }
}

function formatFecha(fecha: Date) {
  return fecha.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatHora(fecha: Date) {
  return fecha.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistorialCard({ registro, viewMode }: HistorialCardProps) {
  if (viewMode === 'grid') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
        {/* Header con fecha y estado */}
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs text-gray-500">{formatFecha(registro.fechaHoraProgramada)}</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getEstadoColor(registro.estado)}`}
          >
            {getEstadoLabel(registro.estado)}
          </span>
        </div>

        {/* Nombre del medicamento */}
        <h3 className="font-semibold text-gray-900 text-sm truncate mb-1" title={registro.medicamentoNombre}>
          {registro.medicamentoNombre}
        </h3>

        {/* Horario programado */}
        <div className="flex items-center gap-1 mb-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-lg font-bold text-blue-600">{formatHora(registro.fechaHoraProgramada)}</span>
        </div>

        {/* Info adicional */}
        {registro.fechaHoraReal && (
          <p className="text-xs text-gray-500">
            Real: {formatHora(registro.fechaHoraReal)}
          </p>
        )}

        {registro.retrasoMinutos !== undefined && registro.retrasoMinutos > 0 && (
          <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
            +{registro.retrasoMinutos} min
          </span>
        )}
      </div>
    );
  }

  // Vista lista
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex gap-3 items-start">
        {/* Fecha destacada */}
        <div className="flex-shrink-0 w-16 text-center">
          <div className="bg-gray-100 rounded-lg p-2">
            <p className="text-xs text-gray-500 uppercase">
              {registro.fechaHoraProgramada.toLocaleDateString('es-MX', { weekday: 'short' })}
            </p>
            <p className="text-xl font-bold text-gray-800">
              {registro.fechaHoraProgramada.getDate()}
            </p>
            <p className="text-xs text-gray-500">
              {registro.fechaHoraProgramada.toLocaleDateString('es-MX', { month: 'short' })}
            </p>
          </div>
        </div>

        {/* Información */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-gray-900 truncate">{registro.medicamentoNombre}</h3>
            <span
              className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${getEstadoColor(registro.estado)}`}
            >
              {getEstadoLabel(registro.estado)}
            </span>
          </div>

          {/* Horarios */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-gray-700">
                <span className="font-medium">Programado:</span> {formatHora(registro.fechaHoraProgramada)}
              </span>
            </div>

            {registro.fechaHoraReal && (
              <span className="text-gray-600">
                <span className="font-medium">Real:</span> {formatHora(registro.fechaHoraReal)}
              </span>
            )}

            {registro.retrasoMinutos !== undefined && registro.retrasoMinutos > 0 && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                +{registro.retrasoMinutos} min retraso
              </span>
            )}
          </div>

          {/* Notas */}
          {registro.notas && (
            <p className="text-sm text-gray-500 mt-2">
              <span className="font-medium text-gray-700">Notas:</span> {registro.notas}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
