import { useState } from 'react';
import { CategoriaRecurso } from '../../types';
import { CrearCategoriaData, EditarCategoriaData } from '../../hooks/useRecursosDigitales';

interface GestionCategoriasModalProps {
  isOpen: boolean;
  onClose: () => void;
  categorias: CategoriaRecurso[];
  onCrear: (data: CrearCategoriaData) => Promise<void>;
  onEditar: (id: string, data: EditarCategoriaData) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
  usuarioId: string;
}

// Emojis sugeridos para categorías
const EMOJIS_SUGERIDOS = [
  '📷', '🎵', '🎬', '📚', '🎮', '🎧', '📺', '🎨',
  '🎭', '🎪', '🎯', '💻', '📱', '🌐', '🔗', '📝',
  '📖', '🎤', '🎹', '🎸', '🎻', '🥁', '🎺', '🎷',
  '📻', '📡', '🎥', '📽️', '🎞️', '📀', '💿', '🖼️',
  '🏠', '👨‍👩‍👧‍👦', '❤️', '⭐', '🌟', '✨', '💫', '🔥',
];

// Colores sugeridos
const COLORES_SUGERIDOS = [
  '#3B82F6', // Azul
  '#10B981', // Verde
  '#EF4444', // Rojo
  '#F59E0B', // Amarillo
  '#8B5CF6', // Púrpura
  '#EC4899', // Rosa
  '#06B6D4', // Cyan
  '#F97316', // Naranja
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#84CC16', // Lima
  '#A855F7', // Violeta
];

export default function GestionCategoriasModal({
  isOpen,
  onClose,
  categorias,
  onCrear,
  onEditar,
  onEliminar,
  usuarioId,
}: GestionCategoriasModalProps) {
  const [modo, setModo] = useState<'lista' | 'crear' | 'editar'>('lista');
  const [categoriaEditando, setCategoriaEditando] = useState<CategoriaRecurso | null>(null);
  const [nombre, setNombre] = useState('');
  const [icono, setIcono] = useState('📷');
  const [color, setColor] = useState('#3B82F6');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setNombre('');
    setIcono('📷');
    setColor('#3B82F6');
    setError('');
    setCategoriaEditando(null);
  };

  const handleCrear = () => {
    resetForm();
    setModo('crear');
  };

  const handleEditar = (cat: CategoriaRecurso) => {
    setCategoriaEditando(cat);
    setNombre(cat.nombre);
    setIcono(cat.icono);
    setColor(cat.color);
    setError('');
    setModo('editar');
  };

  const handleEliminar = async (cat: CategoriaRecurso) => {
    if (cat.predeterminada) {
      setError('No se pueden eliminar categorías predeterminadas');
      return;
    }

    if (!window.confirm(`¿Eliminar la categoría "${cat.nombre}"? Los recursos asociados no se eliminarán.`)) {
      return;
    }

    try {
      await onEliminar(cat.id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al eliminar';
      setError(errorMsg);
    }
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (modo === 'crear') {
        await onCrear({
          nombre: nombre.trim(),
          icono,
          color,
          creadoPor: usuarioId,
        });
      } else if (modo === 'editar' && categoriaEditando) {
        await onEditar(categoriaEditando.id, {
          nombre: nombre.trim(),
          icono,
          color,
        });
      }
      resetForm();
      setModo('lista');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al guardar';
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelar = () => {
    resetForm();
    setModo('lista');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-lavender-500 to-lavender-600 px-6 py-5">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏷️</span>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {modo === 'lista' && 'Gestionar Categorías'}
                  {modo === 'crear' && 'Nueva Categoría'}
                  {modo === 'editar' && 'Editar Categoría'}
                </h2>
                <p className="text-lavender-100 text-sm">
                  {modo === 'lista' && 'Organiza tus recursos digitales'}
                  {modo === 'crear' && 'Crea una nueva categoría personalizada'}
                  {modo === 'editar' && 'Modifica los datos de la categoría'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <span>⚠️</span>
              {error}
            </div>
          )}

          {/* Vista de lista */}
          {modo === 'lista' && (
            <div className="space-y-4">
              {/* Botón crear */}
              <button
                onClick={handleCrear}
                className="w-full px-4 py-4 bg-gradient-to-r from-lavender-50 to-lavender-100 hover:from-lavender-100 hover:to-lavender-200 border-2 border-dashed border-lavender-300 rounded-2xl text-lavender-700 font-semibold transition-all flex items-center justify-center gap-2"
              >
                <span className="text-xl">➕</span>
                <span>Crear Nueva Categoría</span>
              </button>

              {/* Lista de categorías */}
              <div className="space-y-2">
                {categorias.map((cat) => (
                  <div
                    key={cat.id}
                    className="group flex items-center gap-3 px-4 py-3 bg-white border-2 border-gray-100 hover:border-gray-200 rounded-2xl transition-all"
                  >
                    {/* Color e icono */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      {cat.icono}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{cat.nombre}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span>{cat.color}</span>
                        {cat.predeterminada && (
                          <span className="px-1.5 py-0.5 bg-lavender-100 text-lavender-600 rounded-full">
                            Sistema
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditar(cat)}
                        className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      {!cat.predeterminada && (
                        <button
                          onClick={() => handleEliminar(cat)}
                          className="w-9 h-9 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vista de crear/editar */}
          {(modo === 'crear' || modo === 'editar') && (
            <div className="space-y-5">
              {/* Preview */}
              <div className="flex items-center justify-center py-4">
                <div
                  className="px-6 py-3 rounded-2xl text-white font-semibold text-lg flex items-center gap-3 shadow-lg"
                  style={{ backgroundColor: color }}
                >
                  <span className="text-2xl">{icono}</span>
                  <span>{nombre || 'Nombre de categoría'}</span>
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre de la categoría *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Podcasts, Recuerdos, etc."
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-lavender-500 focus:ring-4 focus:ring-lavender-500/10 transition-all outline-none"
                />
              </div>

              {/* Selector de icono */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Icono
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-32 overflow-y-auto">
                  {EMOJIS_SUGERIDOS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setIcono(emoji)}
                      className={`
                        w-10 h-10 rounded-lg text-xl flex items-center justify-center
                        transition-all duration-200
                        ${icono === emoji
                          ? 'bg-lavender-500 scale-110 shadow-md'
                          : 'bg-white hover:bg-gray-100 border border-gray-200'
                        }
                      `}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector de color */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  {COLORES_SUGERIDOS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`
                        w-10 h-10 rounded-lg transition-all duration-200
                        ${color === c
                          ? 'scale-110 ring-2 ring-offset-2 ring-gray-400'
                          : 'hover:scale-105'
                        }
                      `}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-gray-500">Color personalizado:</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <span className="text-sm text-gray-400 font-mono">{color}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          {modo === 'lista' ? (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-lavender-500 to-lavender-600 hover:from-lavender-600 hover:to-lavender-700 text-white font-semibold rounded-xl transition-all shadow-md"
            >
              Listo
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancelar}
                className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-lavender-500 to-lavender-600 hover:from-lavender-600 hover:to-lavender-700 text-white font-semibold rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Guardar</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
