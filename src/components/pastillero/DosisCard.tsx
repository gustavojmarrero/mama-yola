import { DosisDelDia, EstadoMedicamento } from '../../types';

interface DosisCardProps {
  dosis: DosisDelDia;
  viewMode: 'grid' | 'list';
  onRegistrar: (dosis: DosisDelDia) => void;
  compact?: boolean; // Modo compacto para usar dentro de grupos
}

function getEstadoColor(estado?: EstadoMedicamento) {
  if (!estado || estado === 'pendiente') return 'bg-blue-500 text-white';
  switch (estado) {
    case 'tomado':
      return 'bg-green-500 text-white';
    case 'rechazado':
      return 'bg-red-500 text-white';
    case 'omitido':
      return 'bg-yellow-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

function getEstadoLabel(estado?: EstadoMedicamento) {
  if (!estado || estado === 'pendiente') return 'Pendiente';
  switch (estado) {
    case 'tomado':
      return 'Tomado';
    case 'rechazado':
      return 'Rechazado';
    case 'omitido':
      return 'Omitido';
    default:
      return estado;
  }
}

export default function DosisCard({ dosis, viewMode, onRegistrar, compact = false }: DosisCardProps) {
  const estado = dosis.registro?.estado || 'pendiente';
  const esPendiente = !dosis.registro;

  // Modo compacto para usar dentro de grupos de horario
  if (compact) {
    return (
      <div className="px-4 py-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          {/* Foto pequeña o icono */}
          {dosis.medicamento.foto ? (
            <img
              src={dosis.medicamento.foto}
              alt={dosis.medicamento.nombre}
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
          )}

          {/* Info del medicamento */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900 truncate">{dosis.medicamento.nombre}</h4>
              <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${getEstadoColor(estado)}`}>
                {getEstadoLabel(estado)}
              </span>
            </div>
            <p className="text-sm text-gray-500">{dosis.medicamento.dosis}</p>
          </div>

          {/* Botón registrar individual */}
          {esPendiente && (
            <button
              onClick={() => onRegistrar(dosis)}
              className="flex-shrink-0 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
            >
              Registrar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
        {/* Foto o placeholder con badge */}
        <div className="relative aspect-[4/3] mb-2 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          {dosis.medicamento.foto ? (
            <img
              src={dosis.medicamento.foto}
              alt={dosis.medicamento.nombre}
              className="w-full h-full object-cover"
            />
          ) : (
            <svg
              className="w-10 h-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
          )}
          {/* Badge de estado */}
          <span
            className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold shadow-sm ${getEstadoColor(estado)}`}
          >
            {getEstadoLabel(estado)}
          </span>
        </div>

        {/* Info compacta */}
        <div className="space-y-1">
          <h3 className="font-semibold text-gray-900 text-sm truncate" title={dosis.medicamento.nombre}>
            {dosis.medicamento.nombre}
          </h3>

          <p className="text-sm text-gray-600">{dosis.medicamento.dosis}</p>

          {/* Horario destacado */}
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-lg font-bold text-blue-600">{dosis.horario}</span>
          </div>

          {/* Botón registrar */}
          {esPendiente && (
            <button
              onClick={() => onRegistrar(dosis)}
              className="w-full mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Registrar
            </button>
          )}
        </div>
      </div>
    );
  }

  // Vista lista
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex gap-3 items-start">
        {/* Foto */}
        {dosis.medicamento.foto && (
          <div className="flex-shrink-0">
            <img
              src={dosis.medicamento.foto}
              alt={dosis.medicamento.nombre}
              className="w-16 h-16 object-cover rounded-lg"
            />
          </div>
        )}

        {/* Información */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-gray-900 truncate">{dosis.medicamento.nombre}</h3>
            <span
              className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${getEstadoColor(estado)}`}
            >
              {getEstadoLabel(estado)}
            </span>
          </div>

          <p className="text-sm text-gray-600">
            {dosis.medicamento.dosis} - {dosis.medicamento.presentacion}
          </p>

          {/* Horario y retraso */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-xl font-bold text-blue-600">{dosis.horario}</span>
            </div>
          </div>

          {/* Instrucciones */}
          {dosis.medicamento.instrucciones && (
            <p className="text-sm text-gray-500 mt-1" title={dosis.medicamento.instrucciones}>
              <span className="font-medium text-gray-700">Instrucciones:</span> {dosis.medicamento.instrucciones}
            </p>
          )}

          {/* Info del registro si existe */}
          {dosis.registro && (
            <div className="mt-2 p-2 bg-gray-50 rounded-lg text-sm">
              {dosis.registro.fechaHoraReal && (
                <p className="text-gray-600">
                  <span className="font-medium">Hora real:</span>{' '}
                  {dosis.registro.fechaHoraReal.toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              {dosis.registro.notas && (
                <p className="text-gray-600">
                  <span className="font-medium">Notas:</span> {dosis.registro.notas}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Botón registrar */}
        {esPendiente && (
          <div className="flex-shrink-0">
            <button
              onClick={() => onRegistrar(dosis)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Registrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
