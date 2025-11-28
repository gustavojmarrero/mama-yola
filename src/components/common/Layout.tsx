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

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

// Menú agrupado por categorías
const menuGroups: MenuGroup[] = [
  {
    label: 'Principal',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: '🏠', roles: ['familiar', 'supervisor', 'cuidador'] },
      { name: 'Chequeo Diario', path: '/chequeo-diario', icon: '📋', roles: ['familiar', 'supervisor', 'cuidador'] },
      { name: 'Pastillero', path: '/pastillero-diario', icon: '💊', roles: ['familiar', 'supervisor', 'cuidador'] },
    ],
  },
  {
    label: 'Salud',
    items: [
      { name: 'Signos Vitales', path: '/signos-vitales', icon: '💓', roles: ['familiar', 'supervisor', 'cuidador'] },
      { name: 'Medicamentos', path: '/medicamentos', icon: '⚕️', roles: ['familiar', 'supervisor'] },
      { name: 'Adherencia', path: '/adherencia', icon: '📊', roles: ['familiar', 'supervisor'] },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { name: 'Inventarios', path: '/inventarios', icon: '📦', roles: ['familiar', 'supervisor'] },
      { name: 'Turnos', path: '/turnos', icon: '👥', roles: ['familiar', 'supervisor', 'cuidador'] },
      { name: 'Actividades', path: '/actividades', icon: '🎯', roles: ['familiar', 'supervisor', 'cuidador'] },
      { name: 'Menú Comida', path: '/menu-comida', icon: '🍽️', roles: ['familiar', 'supervisor', 'cuidador'] },
    ],
  },
  {
    label: 'Otros',
    items: [
      { name: 'Eventos', path: '/eventos', icon: '📅', roles: ['familiar', 'supervisor'] },
      { name: 'Contactos', path: '/contactos', icon: '📇', roles: ['familiar', 'supervisor'] },
      { name: 'Usuarios', path: '/usuarios', icon: '👤', roles: ['familiar'] },
      { name: 'Paciente', path: '/paciente', icon: '🧓', roles: ['familiar', 'supervisor'] },
      { name: 'Analytics', path: '/analytics', icon: '📈', roles: ['familiar', 'supervisor'] },
    ],
  },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { currentUser, userProfile, logout } = useAuth();
  const { confirmAndNavigate } = useUnsavedChangesContext();
  const location = useLocation();
  const navigate = useNavigate();

  // Detectar tamaño de pantalla
  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      setIsMobile(width < 1024);

      if (width >= 1024) {
        setSidebarExpanded(true);
        setMobileMenuOpen(false);
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

  // Filtrar grupos basado en rol
  const visibleGroups = menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => userProfile?.rol && item.roles.includes(userProfile.rol)
      ),
    }))
    .filter((group) => group.items.length > 0);

  // Componente del contenido del sidebar
  const SidebarContent = ({ expanded }: { expanded: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Header con Logo */}
      <div className={`p-5 ${expanded ? 'border-b border-warm-100' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-11 h-11 bg-gradient-to-br from-lavender-400 to-lavender-600 rounded-2xl flex items-center justify-center shadow-lg shadow-lavender-500/20">
            <span className="text-xl text-white">🏥</span>
          </div>
          {expanded && (
            <div className="animate-fade-in">
              <h1 className="text-lg font-bold text-warm-800 font-display tracking-tight">
                Mama Yola
              </h1>
              <p className="text-xs text-warm-500 -mt-0.5">Sistema de Cuidado</p>
            </div>
          )}
        </div>
      </div>

      {/* Navegación con grupos */}
      <nav className="flex-1 min-h-0 px-3 py-4 overflow-y-auto">
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.label} className={groupIndex > 0 ? 'mt-6' : ''}>
            {/* Label del grupo */}
            {expanded && (
              <div className="px-3 mb-2">
                <span className="text-[10px] font-bold text-warm-400 uppercase tracking-widest">
                  {group.label}
                </span>
              </div>
            )}

            {/* Items del grupo */}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <button
                      onClick={() => handleNavigation(item.path)}
                      title={!expanded ? item.name : undefined}
                      className={`
                        group relative flex items-center gap-3 w-full rounded-xl
                        transition-all duration-200
                        ${expanded ? 'px-3 py-2.5' : 'px-3 py-2.5 justify-center'}
                        ${
                          isActive
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
                      <span
                        className={`text-xl flex-shrink-0 transition-transform duration-200 ${
                          !isActive && 'group-hover:scale-110'
                        }`}
                      >
                        {item.icon}
                      </span>

                      {/* Nombre */}
                      {expanded && (
                        <span
                          className={`font-medium truncate ${
                            isActive ? 'text-lavender-700' : ''
                          }`}
                        >
                          {item.name}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer - Usuario */}
      <div className="flex-shrink-0 border-t border-warm-100 p-4">
        {expanded ? (
          <div className="bg-gradient-to-br from-warm-50 to-lavender-50/50 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 bg-gradient-to-br from-lavender-400 to-lavender-500 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {userProfile?.nombre?.charAt(0).toUpperCase() || '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-warm-800 truncate">
                  {userProfile?.nombre || currentUser?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-warm-500 truncate">{currentUser?.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-lavender-100 text-lavender-700 rounded-lg capitalize">
                {userProfile?.rol}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-lavender-400 to-lavender-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">
              {userProfile?.nombre?.charAt(0).toUpperCase() || '👤'}
            </div>
          </div>
        )}

        {/* Botón cerrar sesión */}
        <button
          onClick={handleLogout}
          className={`
            w-full flex items-center justify-center gap-2
            bg-gradient-to-r from-error to-error-dark
            text-white font-medium rounded-xl
            shadow-sm hover:shadow-md
            transition-all duration-200
            hover:from-error-dark hover:to-red-700
            active:scale-[0.98]
            ${expanded ? 'px-4 py-2.5' : 'p-2.5'}
          `}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          {expanded && <span className="text-sm">Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-warm-50 flex">
      {/* Mobile Header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 h-16 bg-white/95 glass border-b border-warm-100 z-40 flex items-center justify-between px-4">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2.5 hover:bg-lavender-50 rounded-xl transition-colors"
            aria-label="Abrir menú"
          >
            <svg className="w-6 h-6 text-warm-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-lavender-400 to-lavender-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-sm">🏥</span>
            </div>
            <h1 className="text-lg font-bold text-warm-800 font-display">Mama Yola</h1>
          </div>

          <div className="w-10" /> {/* Spacer */}
        </header>
      )}

      {/* Mobile Drawer Overlay */}
      {isMobile && mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-warm-900/60 z-40 animate-fade-in backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer */}
          <aside className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-white z-50 flex flex-col shadow-2xl animate-slide-in-left">
            {/* Close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-lavender-50 rounded-xl transition-colors z-10"
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

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside
          className={`
            ${sidebarExpanded ? 'w-72' : 'w-20'}
            h-screen sticky top-0
            bg-white border-r border-warm-100
            transition-all duration-300 ease-out
            flex flex-col flex-shrink-0
            relative
          `}
        >
          {/* Toggle button */}
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="absolute -right-3 top-7 w-6 h-6 bg-white border border-warm-200 rounded-full shadow-sm flex items-center justify-center text-warm-500 hover:text-lavender-600 hover:border-lavender-300 transition-all z-10"
            aria-label={sidebarExpanded ? 'Colapsar menú' : 'Expandir menú'}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-300 ${
                sidebarExpanded ? '' : 'rotate-180'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <SidebarContent expanded={sidebarExpanded} />
        </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-auto ${isMobile ? 'pt-16' : ''}`}>
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
