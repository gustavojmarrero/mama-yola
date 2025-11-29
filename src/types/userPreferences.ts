// ===== TIPOS DE PREFERENCIAS DE USUARIO =====

// Identificador de un item del menú (usa el path como ID único)
export type MenuItemId = string;

// Preferencias generales del usuario
export interface UserPreferences {
  favoritos: MenuItemId[];
  actualizadoEn: Date;
}

// Estado del hook useFavorites
export interface FavoritesState {
  favoritos: MenuItemId[];
  loading: boolean;
  error: string | null;
}
