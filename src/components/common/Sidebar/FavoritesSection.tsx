import { memo } from 'react';
import { SidebarMenuItem } from './SidebarMenuItem';
import { MENU_ITEMS } from '../../../config/menuConfig';
import type { MenuItemId } from '../../../types/userPreferences';
import type { Rol } from '../../../types';

interface FavoritesSectionProps {
  favoritos: MenuItemId[];
  currentPath: string;
  expanded: boolean;
  userRol: Rol;
  onNavigate: (path: string) => void;
  onToggleFavorite: (path: string) => void;
}

export const FavoritesSection = memo(function FavoritesSection({
  favoritos,
  currentPath,
  expanded,
  userRol,
  onNavigate,
  onToggleFavorite,
}: FavoritesSectionProps) {
  // Obtener items de favoritos que existen y el usuario puede ver
  const favoritosItems = favoritos
    .map(path => MENU_ITEMS.find(item => item.path === path))
    .filter((item): item is NonNullable<typeof item> =>
      item !== undefined && item.roles.includes(userRol)
    );

  return (
    <div className="mb-6">
      {/* Label del grupo */}
      {expanded && (
        <div className="px-3 mb-2 flex items-center gap-2">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
            Favoritos
          </span>
        </div>
      )}

      {favoritosItems.length === 0 ? (
        // Mensaje cuando no hay favoritos
        expanded && (
          <div className="px-3 py-3">
            <p className="text-xs text-warm-400 leading-relaxed">
              Agrega favoritos con la estrella junto a cada opcion
            </p>
          </div>
        )
      ) : (
        <ul className="space-y-1">
          {favoritosItems.map((item) => (
            <SidebarMenuItem
              key={`fav-${item.path}`}
              item={item}
              isActive={currentPath === item.path}
              expanded={expanded}
              isFavorite={true}
              showFavoriteStar={true}
              onNavigate={onNavigate}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </ul>
      )}
    </div>
  );
});
