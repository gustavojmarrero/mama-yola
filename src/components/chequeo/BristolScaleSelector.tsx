import { useState } from 'react';
import { BRISTOL_SCALE, getBristolConfig, type BristolConfig } from '../../constants/bristol';

interface BristolScaleSelectorProps {
  values: string[];
  onChange: (values: string[]) => void;
  numEvacuaciones: number;
  disabled?: boolean;
}

// Componente de escala individual
function BristolScale({
  value,
  onChange,
  label,
  disabled
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const [hoveredType, setHoveredType] = useState<BristolConfig | null>(null);
  const selectedConfig = getBristolConfig(value);

  return (
    <div className="mb-4">
      <div className="text-sm font-medium text-gray-600 mb-2">{label}</div>

      {/* Escala horizontal */}
      <div className="relative">
        {/* Etiquetas de categoría */}
        <div className="flex justify-between text-[10px] text-gray-500 mb-1 px-1">
          <span className="text-amber-600 font-medium">Estreñimiento</span>
          <span className="text-green-600 font-medium">Normal</span>
          <span className="text-red-600 font-medium">Diarrea</span>
        </div>

        {/* Barra con puntos */}
        <div className="relative h-12 flex items-center">
          {/* Línea de fondo con degradado */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-amber-300 via-green-400 to-red-400 opacity-30" />

          {/* Puntos seleccionables */}
          <div className="relative w-full flex justify-between px-2">
            {BRISTOL_SCALE.map((tipo) => {
              const isSelected = value === tipo.tipo;
              const isHovered = hoveredType?.tipo === tipo.tipo;

              // Colores más visibles para cada tipo
              const buttonStyles: Record<number, { bg: string; border: string; text: string; selectedBg: string }> = {
                1: { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-700', selectedBg: 'bg-amber-500' },
                2: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-700', selectedBg: 'bg-orange-500' },
                3: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-700', selectedBg: 'bg-green-500' },
                4: { bg: 'bg-emerald-100', border: 'border-emerald-500', text: 'text-emerald-700', selectedBg: 'bg-emerald-500' },
                5: { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-700', selectedBg: 'bg-yellow-500' },
                6: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-700', selectedBg: 'bg-orange-500' },
                7: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-700', selectedBg: 'bg-red-500' },
              };

              const style = buttonStyles[tipo.numero];

              return (
                <button
                  key={tipo.tipo}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(tipo.tipo)}
                  onMouseEnter={() => setHoveredType(tipo)}
                  onMouseLeave={() => setHoveredType(null)}
                  className={`
                    relative w-10 h-10 md:w-12 md:h-12 rounded-full
                    flex items-center justify-center
                    font-bold text-base md:text-lg
                    transition-all duration-200 border-2
                    ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110 active:scale-95'}
                    ${isSelected
                      ? `${style.selectedBg} text-white ring-4 ring-offset-2 ring-gray-300 scale-110 shadow-lg border-transparent`
                      : `${style.bg} ${style.border} ${style.text} hover:shadow-md`
                    }
                  `}
                  title={`${tipo.nombre} - ${tipo.indicador}`}
                >
                  {tipo.numero}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tooltip en hover */}
        {hoveredType && !selectedConfig && (
          <div className="absolute left-1/2 -translate-x-1/2 mt-1 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10 whitespace-nowrap">
            <div className="font-medium">{hoveredType.nombre}</div>
            <div className="text-gray-300">{hoveredType.indicador}</div>
          </div>
        )}
      </div>

      {/* Descripción del tipo seleccionado */}
      {selectedConfig && (
        <div className={`mt-2 p-2 rounded-lg ${selectedConfig.bgColor} bg-opacity-10 border ${selectedConfig.borderColor} border-opacity-30`}>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${selectedConfig.color}`}>
              Tipo {selectedConfig.numero}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {selectedConfig.nombre}
            </span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${selectedConfig.bgColor} text-white`}>
              {selectedConfig.indicador}
            </span>
          </div>
        </div>
      )}

      {/* Botón limpiar selección */}
      {value && !disabled && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="mt-1 text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Limpiar selección
        </button>
      )}
    </div>
  );
}

// Modal de información
function BristolInfoModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-bold text-gray-900">Escala de Bristol</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            La <strong>Escala de Bristol</strong> es una herramienta médica desarrollada en 1997
            para clasificar la consistencia de las heces en 7 tipos. Ayuda a identificar
            problemas digestivos como estreñimiento o diarrea.
          </p>

          <div className="space-y-3">
            {BRISTOL_SCALE.map((tipo) => (
              <div
                key={tipo.tipo}
                className={`p-3 rounded-lg border-2 ${tipo.borderColor} ${tipo.bgColor} bg-opacity-10`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full ${tipo.bgColor} text-white flex items-center justify-center font-bold text-lg flex-shrink-0`}>
                    {tipo.numero}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{tipo.nombre}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${tipo.bgColor} text-white`}>
                        {tipo.indicador}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{tipo.descripcion}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Tipos 3 y 4</strong> se consideran normales e ideales.
              Los tipos 1-2 indican estreñimiento, mientras que 5-7 indican heces sueltas o diarrea.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente principal
export default function BristolScaleSelector({
  values,
  onChange,
  numEvacuaciones,
  disabled = false,
}: BristolScaleSelectorProps) {
  const [showInfo, setShowInfo] = useState(false);

  // Crear array del tamaño correcto basado en numEvacuaciones
  const getAdjustedValues = (): string[] => {
    const result: string[] = [];
    for (let i = 0; i < numEvacuaciones; i++) {
      result.push(values[i] || '');
    }
    return result;
  };

  const adjustedValues = getAdjustedValues();

  const handleChange = (index: number, value: string) => {
    const newValues = getAdjustedValues();
    newValues[index] = value;
    onChange(newValues);
  };

  if (numEvacuaciones === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      {/* Header con label y botón de ayuda */}
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-gray-700">
          Consistencia (Escala de Bristol)
        </label>
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="flex items-center gap-1 text-xs text-lavender-600 hover:text-lavender-700 hover:underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          ¿Qué es esto?
        </button>
      </div>

      {/* Escalas para cada evacuación */}
      <div className="space-y-2 bg-gray-50 rounded-lg p-3">
        {adjustedValues.map((value, index) => (
          <BristolScale
            key={`bristol-evac-${index}-${numEvacuaciones}`}
            value={value}
            onChange={(newValue) => handleChange(index, newValue)}
            label={numEvacuaciones === 1 ? 'Evacuación' : `Evacuación ${index + 1}`}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Modal de información */}
      <BristolInfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
    </div>
  );
}
