import { Medicamento } from '../../types';

interface MedicamentoCardProps {
  medicamento: Medicamento;
  viewMode: 'grid' | 'list';
  onEdit: (med: Medicamento) => void;
  onToggleActive: (med: Medicamento) => void;
  diasSemanaLabels: string[];
}

export default function MedicamentoCard({
  medicamento: med,
  viewMode,
  onEdit,
  onToggleActive,
  diasSemanaLabels,
}: MedicamentoCardProps) {
  // Obtener primer horario del día para destacar
  const primerHorario = med.horarios.length > 0
    ? med.horarios.reduce((min, h) => h < min ? h : min, med.horarios[0])
    : null;

  if (viewMode === 'grid') {
    return (
      <div
        className={`bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow ${
          med.activo ? 'border-gray-200' : 'border-gray-300 bg-gray-50 opacity-75'
        }`}
      >
        {/* Foto o placeholder con badge */}
        <div className="relative aspect-[4/3] mb-2 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          {med.foto ? (
            <img
              src={med.foto}
              alt={med.nombre}
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
          {/* Badge de estado sobre la imagen */}
          <span
            className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold shadow-sm ${
              med.activo
                ? 'bg-green-500 text-white'
                : 'bg-gray-500 text-white'
            }`}
          >
            {med.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        {/* Info compacta */}
        <div className="space-y-1">
          <h3 className="font-semibold text-gray-900 text-sm truncate" title={med.nombre}>
            {med.nombre}
          </h3>

          <p className="text-sm text-gray-600">{med.dosis}</p>

          {/* Primer horario destacado */}
          {primerHorario && (
            <div className="flex items-center gap-1 text-blue-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm font-medium">{primerHorario}</span>
              {med.horarios.length > 1 && (
                <span className="text-xs text-gray-500">+{med.horarios.length - 1}</span>
              )}
            </div>
          )}

          {/* Botones compactos */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onEdit(med)}
              className="flex-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-xs font-medium"
            >
              Editar
            </button>
            <button
              onClick={() => onToggleActive(med)}
              className={`flex-1 px-2 py-1 rounded-md transition-colors text-xs font-medium ${
                med.activo
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {med.activo ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Vista lista
  return (
    <div
      className={`bg-white rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow ${
        med.activo ? 'border-gray-200' : 'border-gray-300 bg-gray-50 opacity-75'
      }`}
    >
      <div className="flex gap-3 items-center">
        {/* Foto */}
        {med.foto && (
          <div className="flex-shrink-0">
            <img
              src={med.foto}
              alt={med.nombre}
              className="w-14 h-14 object-cover rounded-lg"
            />
          </div>
        )}

        {/* Información */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 truncate">{med.nombre}</h3>
            <span
              className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                med.activo
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-400 text-white'
              }`}
            >
              {med.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {med.dosis} - {med.presentacion}
          </p>

          {/* Info en línea */}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-gray-600">
            <span>
              <span className="font-medium text-gray-700">Días:</span>{' '}
              {!med.frecuencia.diasSemana || med.frecuencia.diasSemana.length === 0
                ? 'Todos'
                : med.frecuencia.diasSemana.map((d) => diasSemanaLabels[d]).join(', ')}
            </span>
            <span>
              <span className="font-medium text-gray-700">Horarios:</span>{' '}
              {med.horarios.join(', ')}
            </span>
          </div>

          {/* Instrucciones */}
          {med.instrucciones && (
            <p className="text-sm text-gray-500 mt-1 truncate" title={med.instrucciones}>
              {med.instrucciones}
            </p>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => onEdit(med)}
            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
          >
            Editar
          </button>
          <button
            onClick={() => onToggleActive(med)}
            className={`px-3 py-1.5 rounded-md transition-colors text-sm ${
              med.activo
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {med.activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    </div>
  );
}
