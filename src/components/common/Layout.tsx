import { ReactNode, useState, useEffect } from 'react';
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
  roles: string[];
}

const menuItems: MenuItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: '🏠', roles: ['familiar', 'supervisor', 'cuidador'] },
  { name: 'Usuarios', path: '/usuarios', icon: '👥', roles: ['familiar'] },
  { name: 'Paciente', path: '/paciente', icon: '🧓', roles: ['familiar', 'supervisor'] },
  { name: 'Chequeo Diario', path: '/chequeo-diario', icon: '📋', roles: ['familiar', 'supervisor', 'cuidador'] },
  { name: 'Signos Vitales', path: '/signos-vitales', icon: '💓', roles: ['familiar', 'supervisor', 'cuidador'] },
  { name: 'Pastillero Diario', path: '/pastillero-diario', icon: '💊', roles: ['familiar', 'supervisor', 'cuidador'] },
  { name: 'Adherencia', path: '/adherencia', icon: '📊', roles: ['familiar', 'supervisor'] },
  { name: 'Medicamentos', path: '/medicamentos', icon: '⚕️', roles: ['familiar', 'supervisor'] },
  { name: 'Contactos', path: '/contactos', icon: '📇', roles: ['familiar', 'supervisor'] },
  { name: 'Eventos', path: '/eventos', icon: '📅', roles: ['familiar', 'supervisor'] },
  { name: 'Inventarios', path: '/inventarios', icon: '📦', roles: ['familiar', 'supervisor'] },
  { name: 'Turnos', path: '/turnos', icon: '👥', roles: ['familiar', 'supervisor', 'cuidador'] },
  { name: 'Actividades', path: '/actividades', icon: '🎯', roles: ['familiar', 'supervisor', 'cuidador'] },
  { name: 'Menú Comida', path: '/menu-comida', icon: '🍽️', roles: ['familiar', 'supervisor', 'cuidador'] },
  { name: 'Analytics', path: '/analytics', icon: '📊', roles: ['familiar', 'supervisor'] }
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  const { currentUser, userProfile, logout } = useAuth();
  const { confirmAndNavigate } = useUnsavedChangesContext();
  const location = useLocation();
  const navigate = useNavigate();

  // Detectar tamaño de pantalla
  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);

      // Auto-colapsar en tablet, expandir en desktop
      if (width >= 1024) {
        setSidebarExpanded(true);
      } else if (width >= 768) {
        setSidebarExpanded(false);
      }
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cerrar mobile menu al cambiar de ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  function handleNavigation(path: string) {
    confirmAndNavigate(path, navigate);
    if (isMobile) setMobileMenuOpen(false);
  }

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  const visibleMenuItems = menuItems.filter(item =>
    userProfile?.rol && item.roles.includes(userProfile.rol)
  );

  // Contenido del sidebar (reutilizado en desktop y mobile drawer)
  const SidebarContent = ({ expanded }: { expanded: boolean }) => (
    <>
      {/* Header */}
      <div className="p-4 border-b border-warm-200">
        <div className="flex items-center justify-between">
          {expanded ? (
            <div>
              <h1 className="text-xl font-bold text-warm-800 font-display">🏥 Mama Yola</h1>
              <p className="text-xs text-warm-500">Sistema de Cuidado</p>
            </div>
          ) : (
            <div className="text-2xl mx-auto">🏥</div>
          )}
          {!isMobile && (
            <button
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="p-2 hover:bg-lavender-100 rounded-xl text-warm-600 transition-colors"
              aria-label={expanded ? 'Colapsar menú' : 'Expandir menú'}
            >
              {expanded ? '◀' : '▶'}
            </button>
          )}
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {visibleMenuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <button
                  onClick={() => handleNavigation(item.path)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full text-left ${
                    isActive
                      ? 'bg-lavender-600 text-white shadow-soft-md'
                      : 'text-warm-700 hover:bg-lavender-50 hover:text-lavender-700'
                  }`}
                >
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  {expanded && (
                    <span className="font-medium truncate">{item.name}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer - Usuario */}
      <div className="p-4 border-t border-warm-200">
        {expanded ? (
          <div className="mb-3">
            <p className="text-sm font-semibold text-warm-800 truncate">
              {userProfile?.nombre || currentUser?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-warm-500 truncate">
              {currentUser?.email}
            </p>
            <span className="inline-block mt-2 px-2.5 py-1 text-xs font-medium bg-lavender-100 text-lavender-700 rounded-full">
              {userProfile?.rol}
            </span>
          </div>
        ) : (
          <div className="text-xl mb-3 text-center">👤</div>
        )}
        <button
          onClick={handleLogout}
          className={`w-full ${
            expanded ? 'px-4' : 'px-2'
          } py-2.5 bg-error hover:bg-error-dark text-white text-sm font-medium rounded-xl transition-colors shadow-soft-sm`}
        >
          {expanded ? 'Cerrar Sesión' : '🚪'}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-warm-50 flex">
      {/* Mobile Header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-sm border-b border-warm-200 z-40 flex items-center justify-between px-4">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 hover:bg-lavender-50 rounded-xl transition-colors"
            aria-label="Abrir menú"
          >
            <svg className="w-6 h-6 text-warm-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-warm-800 font-display">🏥 Mama Yola</h1>
          <div className="w-10" /> {/* Spacer para centrar título */}
        </header>
      )}

      {/* Mobile Drawer Overlay */}
      {isMobile && mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-warm-900/50 z-40 animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <aside className="fixed top-0 left-0 bottom-0 w-72 bg-white z-50 flex flex-col shadow-soft-xl animate-slide-in-left">
            {/* Close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-lavender-50 rounded-xl transition-colors"
              aria-label="Cerrar menú"
            >
              <svg className="w-5 h-5 text-warm-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <SidebarContent expanded={true} />
          </aside>
        </>
      )}

      {/* Desktop/Tablet Sidebar */}
      {!isMobile && (
        <aside
          className={`${
            sidebarExpanded ? 'w-64' : 'w-20'
          } bg-white border-r border-warm-200 transition-all duration-300 flex flex-col flex-shrink-0`}
        >
          <SidebarContent expanded={sidebarExpanded} />
        </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-auto ${isMobile ? 'pt-16' : ''}`}>
        {children}
      </main>
    </div>
  );
}
