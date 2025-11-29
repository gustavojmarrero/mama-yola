import { ReactNode, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUnsavedChangesContext } from '../../context/UnsavedChangesContext';
import { useFavorites } from '../../hooks/useFavorites';
import { MENU_GROUPS } from '../../config/menuConfig';
import type { MenuItem } from '../../config/menuConfig';
import { FavoritesSection, SidebarMenuItem } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { currentUser, userProfile, logout } = useAuth();
  const { confirmAndNavigate } = useUnsavedChangesContext();
  const { favoritos, isFavorite, toggleFavorite } = useFavorites();
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

  // Handler para toggle favorito
  const handleToggleFavorite = async (path: string) => {
    try {
      await toggleFavorite(path);
    } catch (error) {
      console.error('Error al cambiar favorito:', error);
    }
  };

  // Filtrar grupos basado en rol
  const visibleGroups = MENU_GROUPS
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
                Mamá Yola
              </h1>
              <p className="text-xs text-warm-500 -mt-0.5">Sistema de Cuidado</p>
            </div>
          )}
        </div>
      </div>

      {/* Navegación con grupos */}
      <nav className="flex-1 min-h-0 px-3 py-4 overflow-y-auto">
        {/* Sección de Favoritos */}
        {userProfile?.rol && (
          <FavoritesSection
            favoritos={favoritos}
            currentPath={location.pathname}
            expanded={expanded}
            userRol={userProfile.rol}
            onNavigate={handleNavigation}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {/* Grupos del menú */}
        {visibleGroups.map((group) => (
          <div key={group.id} className="mt-6">
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
              {group.items.map((item) => (
                <SidebarMenuItem
                  key={item.path}
                  item={item}
                  isActive={location.pathname === item.path}
                  expanded={expanded}
                  isFavorite={isFavorite(item.path)}
                  showFavoriteStar={true}
                  onNavigate={handleNavigation}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
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
            <h1 className="text-lg font-bold text-warm-800 font-display">Mamá Yola</h1>
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
