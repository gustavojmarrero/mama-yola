import { useState, useMemo } from 'react';
import Layout from '../components/common/Layout';
import SearchBar from '../components/common/SearchBar';
import LoadMoreButton from '../components/common/LoadMoreButton';
import { useAuth } from '../context/AuthContext';
import { useRecursosDigitales, CrearRecursoData, EditarRecursoData } from '../hooks/useRecursosDigitales';
import RecursoCard from '../components/recursos/RecursoCard';
import CategoriaChip from '../components/recursos/CategoriaChip';
import RecursoModal from '../components/recursos/RecursoModal';
import GestionCategoriasModal from '../components/recursos/GestionCategoriasModal';
import { RecursoDigital } from '../types';

const ITEMS_PER_PAGE = 9;

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export default function RecursosDigitales() {
  const { currentUser, userProfile } = useAuth();
  const {
    recursos,
    categorias,
    loading,
    crearRecurso,
    editarRecurso,
    eliminarRecurso,
    toggleFavorito,
    crearCategoria,
    editarCategoria,
    eliminarCategoria,
    getCategoriaById,
  } = useRecursosDigitales();

  // Estados de UI
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Estados de modales
  const [showRecursoModal, setShowRecursoModal] = useState(false);
  const [showCategoriasModal, setShowCategoriasModal] = useState(false);
  const [recursoEditando, setRecursoEditando] = useState<RecursoDigital | undefined>(undefined);

  // Control de permisos
  const puedeEditar = userProfile?.rol === 'familiar' || userProfile?.rol === 'supervisor';

  // Función para mostrar toast
  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Filtrar recursos
  const recursosFiltrados = useMemo(() => {
    let lista = [...recursos];

    // Filtro por categoría
    if (filtroCategoria !== 'todas') {
      lista = lista.filter((r) => r.categoriaId === filtroCategoria);
    }

    // Filtro por búsqueda
    if (searchTerm) {
      const termLower = searchTerm.toLowerCase();
      lista = lista.filter(
        (r) =>
          r.titulo.toLowerCase().includes(termLower) ||
          r.descripcion.toLowerCase().includes(termLower) ||
          r.categoriaNombre.toLowerCase().includes(termLower) ||
          r.url.toLowerCase().includes(termLower)
      );
    }

    return lista;
  }, [recursos, filtroCategoria, searchTerm]);

  // Recursos visibles (paginados)
  const recursosVisibles = recursosFiltrados.slice(0, visibleCount);
  const hayMas = recursosFiltrados.length > visibleCount;

  // Contadores por categoría
  const contadorPorCategoria = useMemo(() => {
    const contador: Record<string, number> = {};
    recursos.forEach((r) => {
      contador[r.categoriaId] = (contador[r.categoriaId] || 0) + 1;
    });
    return contador;
  }, [recursos]);

  // Handlers
  const handleNuevoRecurso = () => {
    setRecursoEditando(undefined);
    setShowRecursoModal(true);
  };

  const handleEditarRecurso = (recurso: RecursoDigital) => {
    setRecursoEditando(recurso);
    setShowRecursoModal(true);
  };

  const handleEliminarRecurso = async (recurso: RecursoDigital) => {
    if (!window.confirm(`¿Eliminar "${recurso.titulo}"?`)) return;
    try {
      await eliminarRecurso(recurso.id);
      showToast('Recurso eliminado', 'success');
    } catch {
      showToast('Error al eliminar recurso', 'error');
    }
  };

  const handleToggleFavorito = async (id: string) => {
    try {
      await toggleFavorito(id);
    } catch {
      showToast('Error al cambiar favorito', 'error');
    }
  };

  const handleGuardarRecurso = async (
    data: CrearRecursoData | EditarRecursoData,
    isEditing: boolean
  ) => {
    try {
      if (isEditing && recursoEditando) {
        await editarRecurso(recursoEditando.id, data as EditarRecursoData);
        showToast('Recurso actualizado', 'success');
      } else {
        await crearRecurso(data as CrearRecursoData);
        showToast('Recurso creado', 'success');
      }
    } catch {
      showToast('Error al guardar recurso', 'error');
      throw new Error('Error al guardar');
    }
  };

  // Estadísticas
  const totalRecursos = recursos.length;
  const totalFavoritos = recursos.filter((r) => r.favorito).length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Toasts */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-slide-in backdrop-blur-sm ${
                toast.type === 'success'
                  ? 'bg-green-500/90'
                  : toast.type === 'error'
                  ? 'bg-red-500/90'
                  : toast.type === 'warning'
                  ? 'bg-yellow-500/90'
                  : 'bg-blue-500/90'
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>

        {/* Header con diseño especial */}
        <div className="relative overflow-hidden bg-gradient-to-br from-lavender-500 via-lavender-600 to-purple-700 rounded-3xl p-6 sm:p-8">
          {/* Decoraciones de fondo */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-purple-400/20 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/3 w-20 h-20 bg-white/5 rounded-full blur-2xl" />
          </div>

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-white">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">🔗</span>
                <h1 className="text-2xl sm:text-3xl font-bold">Recursos Digitales</h1>
              </div>
              <p className="text-lavender-100 text-sm sm:text-base max-w-md">
                Accede a álbumes de fotos, playlists de música, películas y más contenido digital de la familia
              </p>
            </div>

            {puedeEditar && (
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowCategoriasModal(true)}
                  className="px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white font-medium rounded-xl transition-all flex items-center gap-2 backdrop-blur-sm border border-white/20"
                >
                  <span>🏷️</span>
                  <span className="hidden sm:inline">Categorías</span>
                </button>
                <button
                  onClick={handleNuevoRecurso}
                  className="px-5 py-2.5 bg-white hover:bg-gray-50 text-lavender-700 font-semibold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-black/10"
                >
                  <span>➕</span>
                  <span>Nuevo Recurso</span>
                </button>
              </div>
            )}
          </div>

          {/* Mini estadísticas */}
          <div className="relative flex gap-6 mt-6 pt-6 border-t border-white/20">
            <div className="text-white/90">
              <div className="text-2xl font-bold">{totalRecursos}</div>
              <div className="text-xs text-white/60">recursos</div>
            </div>
            <div className="text-white/90">
              <div className="text-2xl font-bold">{categorias.length}</div>
              <div className="text-xs text-white/60">categorías</div>
            </div>
            <div className="text-white/90">
              <div className="text-2xl font-bold flex items-center gap-1">
                <span className="text-lg">⭐</span>
                {totalFavoritos}
              </div>
              <div className="text-xs text-white/60">favoritos</div>
            </div>
          </div>
        </div>

        {/* Filtros por categoría */}
        <div className="flex flex-wrap gap-2 pb-2 -mx-1 px-1 overflow-x-auto scrollbar-hide">
          <CategoriaChip
            label="Todas"
            activo={filtroCategoria === 'todas'}
            onClick={() => setFiltroCategoria('todas')}
            count={totalRecursos}
          />
          {categorias.map((cat) => (
            <CategoriaChip
              key={cat.id}
              categoria={cat}
              activo={filtroCategoria === cat.id}
              onClick={() => setFiltroCategoria(cat.id)}
              count={contadorPorCategoria[cat.id] || 0}
            />
          ))}
        </div>

        {/* Barra de búsqueda */}
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar recursos por título, descripción o URL..."
        />

        {/* Grid de recursos */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-lavender-200 border-t-lavender-600 rounded-full animate-spin" />
              <p className="text-gray-500">Cargando recursos...</p>
            </div>
          </div>
        ) : recursosVisibles.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-lavender-100 rounded-full mb-4">
              <span className="text-4xl">
                {searchTerm || filtroCategoria !== 'todas' ? '🔍' : '📭'}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm || filtroCategoria !== 'todas'
                ? 'No se encontraron recursos'
                : 'Aún no hay recursos'}
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              {searchTerm || filtroCategoria !== 'todas'
                ? 'Intenta ajustar los filtros o términos de búsqueda'
                : 'Agrega tu primer recurso digital para comenzar a organizar el contenido de la familia'}
            </p>
            {puedeEditar && filtroCategoria === 'todas' && !searchTerm && (
              <button
                onClick={handleNuevoRecurso}
                className="px-6 py-3 bg-gradient-to-r from-lavender-500 to-lavender-600 hover:from-lavender-600 hover:to-lavender-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-lavender-500/25 flex items-center gap-2 mx-auto"
              >
                <span>➕</span>
                <span>Agregar Primer Recurso</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recursosVisibles.map((recurso) => (
              <RecursoCard
                key={recurso.id}
                recurso={recurso}
                categoria={getCategoriaById(recurso.categoriaId)}
                puedeEditar={puedeEditar}
                onEdit={() => handleEditarRecurso(recurso)}
                onDelete={() => handleEliminarRecurso(recurso)}
                onToggleFavorito={() => handleToggleFavorito(recurso.id)}
              />
            ))}
          </div>
        )}

        {/* Botón cargar más */}
        {hayMas && (
          <LoadMoreButton
            onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
            remaining={recursosFiltrados.length - visibleCount}
          />
        )}

        {/* Tip para cuidadores */}
        {!puedeEditar && recursos.length > 0 && (
          <div className="bg-lavender-50 border border-lavender-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <p className="text-sm text-lavender-800">
                <strong>Tip:</strong> Puedes acceder a todos los recursos, pero solo los familiares y supervisores pueden agregar o editar contenido.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nuevo/Editar Recurso */}
      <RecursoModal
        isOpen={showRecursoModal}
        onClose={() => {
          setShowRecursoModal(false);
          setRecursoEditando(undefined);
        }}
        recurso={recursoEditando}
        categorias={categorias}
        onGuardar={handleGuardarRecurso}
        usuarioId={currentUser?.uid || ''}
        usuarioNombre={userProfile?.nombre || ''}
      />

      {/* Modal Gestionar Categorías */}
      <GestionCategoriasModal
        isOpen={showCategoriasModal}
        onClose={() => setShowCategoriasModal(false)}
        categorias={categorias}
        onCrear={async (data) => {
          await crearCategoria(data);
          showToast('Categoría creada', 'success');
        }}
        onEditar={async (id, data) => {
          await editarCategoria(id, data);
          showToast('Categoría actualizada', 'success');
        }}
        onEliminar={async (id) => {
          await eliminarCategoria(id);
          showToast('Categoría eliminada', 'success');
        }}
        usuarioId={currentUser?.uid || ''}
      />
    </Layout>
  );
}
