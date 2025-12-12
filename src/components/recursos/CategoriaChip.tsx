import { CategoriaRecurso } from '../../types';

interface CategoriaChipProps {
  categoria?: CategoriaRecurso;
  label?: string;
  activo: boolean;
  onClick: () => void;
  count?: number;
}

export default function CategoriaChip({
  categoria,
  label,
  activo,
  onClick,
  count,
}: CategoriaChipProps) {
  const nombre = categoria?.nombre || label || 'Todas';
  const icono = categoria?.icono || '🌐';
  const color = categoria?.color || '#8B7BB8';

  return (
    <button
      onClick={onClick}
      className={`
        group relative flex items-center gap-2 px-4 py-2.5 rounded-2xl
        font-medium text-sm transition-all duration-300 ease-out
        border-2 overflow-hidden
        ${activo
          ? 'text-white shadow-lg scale-[1.02]'
          : 'bg-white/80 text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-[1.01]'
        }
      `}
      style={{
        borderColor: activo ? color : undefined,
        backgroundColor: activo ? color : undefined,
        boxShadow: activo ? `0 4px 14px -3px ${color}60` : undefined,
      }}
    >
      {/* Efecto de brillo en hover */}
      <span
        className={`
          absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
          bg-gradient-to-r from-transparent via-white/20 to-transparent
          -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%]
          transition-transform duration-700
        `}
      />

      <span className="text-lg flex-shrink-0 relative z-10">{icono}</span>
      <span className="relative z-10 whitespace-nowrap">{nombre}</span>

      {count !== undefined && count > 0 && (
        <span
          className={`
            relative z-10 px-2 py-0.5 rounded-full text-xs font-bold
            ${activo
              ? 'bg-white/25 text-white'
              : 'bg-gray-100 text-gray-600'
            }
          `}
        >
          {count}
        </span>
      )}
    </button>
  );
}
