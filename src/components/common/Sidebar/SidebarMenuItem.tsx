import { memo } from 'react';
import type { MenuItem } from '../../../config/menuConfig';

interface SidebarMenuItemProps {
  item: MenuItem;
  isActive: boolean;
  expanded: boolean;
  isFavorite: boolean;
  showFavoriteStar: boolean;
  onNavigate: (path: string) => void;
  onToggleFavorite: (path: string) => void;
}

export const SidebarMenuItem = memo(function SidebarMenuItem({
  item,
  isActive,
  expanded,
  isFavorite,
  showFavoriteStar,
  onNavigate,
  onToggleFavorite,
}: SidebarMenuItemProps) {
  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(item.path);
  };

  return (
    <li>
      <div className="group flex items-center">
        <button
          onClick={() => onNavigate(item.path)}
          title={!expanded ? item.name : undefined}
          className={`
            relative flex items-center gap-3 flex-1 rounded-xl
            transition-all duration-200
            ${expanded ? 'px-3 py-2.5' : 'px-3 py-2.5 justify-center'}
            ${isActive
              ? 'bg-lavender-100 text-lavender-700'
              : 'text-warm-600 hover:bg-warm-100 hover:text-warm-800'
            }
          `}
        >
          {/* Indicador activo */}
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-lavender-500 rounded-r-full" />
          )}

          {/* Icono */}
          <span className={`text-xl flex-shrink-0 transition-transform duration-200 ${
            !isActive && 'group-hover:scale-110'
          }`}>
            {item.icon}
          </span>

          {/* Nombre */}
          {expanded && (
            <span className={`font-medium truncate flex-1 text-left ${
              isActive ? 'text-lavender-700' : ''
            }`}>
              {item.name}
            </span>
          )}
        </button>

        {/* Estrella de favorito */}
        {expanded && showFavoriteStar && (
          <button
            onClick={handleStarClick}
            className={`
              p-1.5 rounded-lg transition-all duration-200 flex-shrink-0
              ${isFavorite
                ? 'text-amber-400 hover:text-amber-500'
                : 'text-warm-300 hover:text-amber-400 opacity-0 group-hover:opacity-100'
              }
            `}
            title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          >
            <svg
              className="w-4 h-4"
              fill={isFavorite ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>
        )}
      </div>
    </li>
  );
});
