import { DIAS_SEMANA } from '../../types/actividades';

interface SelectorDiasSemanaProps {
  value: number[];
  onChange: (dias: number[]) => void;
  disabled?: boolean;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function SelectorDiasSemana({
  value,
  onChange,
  disabled = false,
  showLabels = false,
  size = 'md',
}: SelectorDiasSemanaProps) {
  const toggleDia = (dia: number) => {
    if (disabled) return;

    if (value.includes(dia)) {
      // Remover el día si ya está seleccionado
      onChange(value.filter((d) => d !== dia));
    } else {
      // Agregar el día si no está seleccionado
      onChange([...value, dia].sort((a, b) => a - b));
    }
  };

  const seleccionarTodos = () => {
    if (disabled) return;
    onChange([0, 1, 2, 3, 4, 5, 6]);
  };

  const seleccionarLunesViernes = () => {
    if (disabled) return;
    onChange([1, 2, 3, 4, 5]);
  };

  const limpiar = () => {
    if (disabled) return;
    onChange([]);
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-center gap-2">
        {DIAS_SEMANA.map((dia) => {
          const isSelected = value.includes(dia.valor);

          return (
            <button
              key={dia.valor}
              type="button"
              onClick={() => toggleDia(dia.valor)}
              disabled={disabled}
              title={dia.largo}
              className={`
                ${sizeClasses[size]}
                rounded-full font-medium
                transition-all duration-200
                flex items-center justify-center
                ${
                  isSelected
                    ? 'bg-lavender-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {dia.corto}
            </button>
          );
        })}
      </div>

      {showLabels && (
        <div className="flex justify-center gap-2 text-xs">
          <button
            type="button"
            onClick={seleccionarLunesViernes}
            disabled={disabled}
            className="text-lavender-600 hover:text-lavender-700 disabled:opacity-50"
          >
            L-V
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={seleccionarTodos}
            disabled={disabled}
            className="text-lavender-600 hover:text-lavender-700 disabled:opacity-50"
          >
            Todos
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={limpiar}
            disabled={disabled}
            className="text-gray-500 hover:text-gray-600 disabled:opacity-50"
          >
            Limpiar
          </button>
        </div>
      )}

      {value.length > 0 && (
        <p className="text-center text-xs text-gray-500">
          {value.length === 7
            ? 'Todos los días'
            : value.length === 5 && value.includes(1) && !value.includes(0) && !value.includes(6)
            ? 'Lunes a Viernes'
            : `${value.length} día${value.length > 1 ? 's' : ''} seleccionado${value.length > 1 ? 's' : ''}`}
        </p>
      )}
    </div>
  );
}
