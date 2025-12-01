import { TipoActividadV2, TIPOS_ACTIVIDAD_CONFIG } from '../../types/actividades';

interface SelectorTipoActividadProps {
  value: TipoActividadV2;
  onChange: (tipo: TipoActividadV2) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function SelectorTipoActividad({
  value,
  onChange,
  disabled = false,
  size = 'md',
}: SelectorTipoActividadProps) {
  const tipos: TipoActividadV2[] = ['fisica', 'cognitiva'];

  const sizeClasses = {
    sm: 'py-2 px-3 text-sm',
    md: 'py-3 px-4 text-base',
    lg: 'py-4 px-6 text-lg',
  };

  const iconSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div className="flex gap-3">
      {tipos.map((tipo) => {
        const config = TIPOS_ACTIVIDAD_CONFIG[tipo];
        const isSelected = value === tipo;

        return (
          <button
            key={tipo}
            type="button"
            onClick={() => !disabled && onChange(tipo)}
            disabled={disabled}
            className={`
              flex-1 flex flex-col items-center justify-center gap-1
              ${sizeClasses[size]}
              rounded-xl border-2 transition-all duration-200
              ${
                isSelected
                  ? `${config.bgColor} border-current ${config.color} shadow-md`
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className={iconSizes[size]}>{config.icon}</span>
            <span className="font-medium">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
