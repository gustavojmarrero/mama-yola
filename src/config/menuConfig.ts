import type { Rol } from '../types';

// ===== TIPOS DEL MENÚ =====

export interface MenuItem {
  id: string;       // Identificador único (igual al path)
  name: string;
  path: string;
  icon: string;
  roles: Rol[];
}

export interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
}

// ===== ITEMS DEL MENÚ =====

export const MENU_ITEMS: MenuItem[] = [
  // Salud
  { id: '/signos-vitales', name: 'Signos Vitales', path: '/signos-vitales', icon: '💓', roles: ['familiar', 'supervisor', 'cuidador'] },
  { id: '/chequeo-diario', name: 'Chequeo Diario', path: '/chequeo-diario', icon: '📋', roles: ['familiar', 'supervisor', 'cuidador'] },
  { id: '/pastillero-diario', name: 'Pastillero', path: '/pastillero-diario', icon: '💊', roles: ['familiar', 'supervisor', 'cuidador'] },
  { id: '/medicamentos', name: 'Medicamentos', path: '/medicamentos', icon: '⚕️', roles: ['familiar', 'supervisor'] },

  // Gestión
  { id: '/dashboard', name: 'Dashboard', path: '/dashboard', icon: '🏠', roles: ['familiar', 'supervisor', 'cuidador'] },
  { id: '/inventarios', name: 'Inventarios', path: '/inventarios', icon: '📦', roles: ['familiar', 'supervisor'] },
  { id: '/turnos', name: 'Turnos', path: '/turnos', icon: '👥', roles: ['familiar', 'supervisor', 'cuidador'] },
  { id: '/actividades', name: 'Actividades', path: '/actividades', icon: '🎯', roles: ['familiar', 'supervisor', 'cuidador'] },
  { id: '/menu-comida', name: 'Menú Comida', path: '/menu-comida', icon: '🍽️', roles: ['familiar', 'supervisor', 'cuidador'] },

  // Otros
  { id: '/eventos', name: 'Eventos', path: '/eventos', icon: '📅', roles: ['familiar', 'supervisor'] },
  { id: '/contactos', name: 'Contactos', path: '/contactos', icon: '📇', roles: ['familiar', 'supervisor'] },
  { id: '/usuarios', name: 'Usuarios', path: '/usuarios', icon: '👤', roles: ['familiar'] },
  { id: '/paciente', name: 'Paciente', path: '/paciente', icon: '🧓', roles: ['familiar', 'supervisor'] },
  { id: '/analytics', name: 'Analytics', path: '/analytics', icon: '📈', roles: ['familiar', 'supervisor'] },
];

// ===== GRUPOS DEL MENÚ (reorganizados) =====

export const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'salud',
    label: 'Salud',
    items: [
      MENU_ITEMS.find(i => i.id === '/signos-vitales')!,
      MENU_ITEMS.find(i => i.id === '/chequeo-diario')!,
      MENU_ITEMS.find(i => i.id === '/pastillero-diario')!,
      MENU_ITEMS.find(i => i.id === '/medicamentos')!,
    ],
  },
  {
    id: 'gestion',
    label: 'Gestión',
    items: [
      MENU_ITEMS.find(i => i.id === '/dashboard')!,
      MENU_ITEMS.find(i => i.id === '/inventarios')!,
      MENU_ITEMS.find(i => i.id === '/turnos')!,
      MENU_ITEMS.find(i => i.id === '/actividades')!,
      MENU_ITEMS.find(i => i.id === '/menu-comida')!,
    ],
  },
  {
    id: 'otros',
    label: 'Otros',
    items: [
      MENU_ITEMS.find(i => i.id === '/eventos')!,
      MENU_ITEMS.find(i => i.id === '/contactos')!,
      MENU_ITEMS.find(i => i.id === '/usuarios')!,
      MENU_ITEMS.find(i => i.id === '/paciente')!,
      MENU_ITEMS.find(i => i.id === '/analytics')!,
    ],
  },
];

// ===== HELPERS =====

export function getMenuItemByPath(path: string): MenuItem | undefined {
  return MENU_ITEMS.find(item => item.path === path);
}

export function getMenuItemById(id: string): MenuItem | undefined {
  return MENU_ITEMS.find(item => item.id === id);
}
