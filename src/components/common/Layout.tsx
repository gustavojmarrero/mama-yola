import { ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUnsavedChangesContext } from '../../context/UnsavedChangesContext';

interface LayoutProps {
  children: ReactNode;
}

interface MenuItem {
  name: string;
  path: string;
  icon: string;
  roles: string[]; // roles que pueden ver este item
}

const menuItems: MenuItem[] = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: '🏠',
    roles: ['familiar', 'supervisor', 'cuidador']
  },
  {
    name: 'Usuarios',
    path: '/usuarios',
    icon: '👥',
    roles: ['familiar'] // Solo familiar puede gestionar usuarios
  },
  {
    name: 'Paciente',
    path: '/paciente',
    icon: '🧓',
    roles: ['familiar', 'supervisor']
  },
  {
    name: 'Chequeo Diario',
    path: '/chequeo-diario',
    icon: '📋',
    roles: ['familiar', 'supervisor', 'cuidador']
  },
  {
    name: 'Signos Vitales',
    path: '/signos-vitales',
    icon: '💓',
    roles: ['familiar', 'supervisor', 'cuidador']
  },
  {
    name: 'Pastillero Diario',
    path: '/pastillero-diario',
    icon: '💊',
    roles: ['familiar', 'supervisor', 'cuidador']
  },
  {
    name: 'Adherencia',
    path: '/adherencia',
    icon: '📊',
    roles: ['familiar', 'supervisor']
  },
  {
    name: 'Medicamentos',
    path: '/medicamentos',
    icon: '⚕️',
    roles: ['familiar', 'supervisor']
  },
  {
    name: 'Contactos',
    path: '/contactos',
    icon: '📇',
    roles: ['familiar', 'supervisor']
  },
  {
    name: 'Eventos',
    path: '/eventos',
    icon: '📅',
    roles: ['familiar', 'supervisor']
  },
  {
    name: 'Inventarios',
    path: '/inventarios',
    icon: '📦',
    roles: ['familiar', 'supervisor']
  },
  {
    name: 'Turnos',
    path: '/turnos',
    icon: '👥',
    roles: ['familiar', 'supervisor', 'cuidador']
  },
  {
    name: 'Actividades',
    path: '/actividades',
    icon: '🎯',
    roles: ['familiar', 'supervisor', 'cuidador']
  },
  {
    name: 'Menú Comida',
    path: '/menu-comida',
    icon: '🍽️',
    roles: ['familiar', 'supervisor', 'cuidador']
  },
  {
    name: 'Analytics',
    path: '/analytics',
    icon: '📊',
    roles: ['familiar', 'supervisor']
  }
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { currentUser, userProfile, logout } = useAuth();
  const { confirmAndNavigate } = useUnsavedChangesContext();
  const location = useLocation();
  const navigate = useNavigate();

  function handleNavigation(path: string) {
    confirmAndNavigate(path, navigate);
  }

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  // Filtrar items según el rol del usuario
  const visibleMenuItems = menuItems.filter(item =>
    userProfile?.rol && item.roles.includes(userProfile.rol)
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white shadow-lg transition-all duration-300 flex flex-col`}
      >
        {/* Header del sidebar */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <div>
                <h1 className="text-xl font-bold text-gray-900">🏥 Mama Yola</h1>
                <p className="text-xs text-gray-500">Sistema de Cuidado</p>
              </div>
            ) : (
              <div className="text-2xl">🏥</div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
          </div>
        </div>

        {/* Menú de navegación */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {visibleMenuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <button
                    onClick={() => handleNavigation(item.path)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    {sidebarOpen && (
                      <span className="font-medium">{item.name}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer del sidebar - Info del usuario */}
        <div className="p-4 border-t">
          {sidebarOpen ? (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900 truncate">
                {userProfile?.nombre || currentUser?.email?.split('@')[0]}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {currentUser?.email}
              </p>
              <span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                {userProfile?.rol}
              </span>
            </div>
          ) : (
            <div className="text-xl mb-2">👤</div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full ${
              sidebarOpen ? 'px-4' : 'px-2'
            } py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors`}
          >
            {sidebarOpen ? 'Cerrar Sesión' : '🚪'}
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
