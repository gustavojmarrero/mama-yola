import { useState, useEffect } from 'react';
import { RecursoDigital, CategoriaRecurso } from '../../types';
import { CrearRecursoData, EditarRecursoData } from '../../hooks/useRecursosDigitales';

interface RecursoModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurso?: RecursoDigital;
  categorias: CategoriaRecurso[];
  onGuardar: (data: CrearRecursoData | EditarRecursoData, isEditing: boolean) => Promise<void>;
  usuarioId: string;
  usuarioNombre: string;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export default function RecursoModal({
  isOpen,
  onClose,
  recurso,
  categorias,
  onGuardar,
  usuarioId,
  usuarioNombre,
}: RecursoModalProps) {
  const isEditing = !!recurso;

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [url, setUrl] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [notasPrivadas, setNotasPrivadas] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes or recurso changes
  useEffect(() => {
    if (isOpen) {
      if (recurso) {
        setTitulo(recurso.titulo);
        setDescripcion(recurso.descripcion);
        setUrl(recurso.url);
        setCategoriaId(recurso.categoriaId);
        setThumbnail(recurso.thumbnail || '');
        setNotasPrivadas(recurso.notasPrivadas || '');
      } else {
        setTitulo('');
        setDescripcion('');
        setUrl('');
        setCategoriaId(categorias[0]?.id || '');
        setThumbnail('');
        setNotasPrivadas('');
      }
      setErrors({});
    }
  }, [isOpen, recurso, categorias]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!titulo.trim()) {
      newErrors.titulo = 'El título es requerido';
    }

    if (!url.trim()) {
      newErrors.url = 'La URL es requerida';
    } else if (!isValidUrl(url)) {
      newErrors.url = 'Ingresa una URL válida (ej: https://...)';
    }

    if (!categoriaId) {
      newErrors.categoriaId = 'Selecciona una categoría';
    }

    if (thumbnail && !isValidUrl(thumbnail)) {
      newErrors.thumbnail = 'Ingresa una URL de imagen válida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    try {
      const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);

      if (isEditing) {
        const data: EditarRecursoData = {
          titulo,
          descripcion,
          url,
          categoriaId,
          categoriaNombre: categoriaSeleccionada?.nombre || '',
          thumbnail: thumbnail || undefined,
          notasPrivadas: notasPrivadas || undefined,
        };
        await onGuardar(data, true);
      } else {
        const data: CrearRecursoData = {
          titulo,
          descripcion,
          url,
          categoriaId,
          categoriaNombre: categoriaSeleccionada?.nombre || '',
          thumbnail: thumbnail || undefined,
          notasPrivadas: notasPrivadas || undefined,
          creadoPor: usuarioId,
          creadoPorNombre: usuarioNombre,
        };
        await onGuardar(data, false);
      }
      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
    } finally {
      setSaving(false);
    }
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
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-scale-in">
        {/* Header con gradiente */}
        <div className="relative bg-gradient-to-r from-lavender-500 to-lavender-600 px-6 py-5">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{isEditing ? '✏️' : '🔗'}</span>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {isEditing ? 'Editar Recurso' : 'Nuevo Recurso'}
                </h2>
                <p className="text-lavender-100 text-sm">
                  {isEditing ? 'Modifica los datos del enlace' : 'Agrega un nuevo enlace digital'}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Título */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Título *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Álbum de fotos familiares 2024"
              className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 outline-none ${
                errors.titulo
                  ? 'border-red-300 bg-red-50 focus:border-red-500'
                  : 'border-gray-200 focus:border-lavender-500 focus:ring-4 focus:ring-lavender-500/10'
              }`}
            />
            {errors.titulo && (
              <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                <span>⚠️</span> {errors.titulo}
              </p>
            )}
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              URL del enlace *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://photos.google.com/..."
              className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 outline-none ${
                errors.url
                  ? 'border-red-300 bg-red-50 focus:border-red-500'
                  : 'border-gray-200 focus:border-lavender-500 focus:ring-4 focus:ring-lavender-500/10'
              }`}
            />
            {errors.url && (
              <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                <span>⚠️</span> {errors.url}
              </p>
            )}
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Categoría *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaId(cat.id)}
                  className={`
                    px-3 py-2.5 rounded-xl border-2 text-sm font-medium
                    transition-all duration-200 flex items-center justify-center gap-2
                    ${categoriaId === cat.id
                      ? 'text-white shadow-md scale-[1.02]'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }
                  `}
                  style={{
                    backgroundColor: categoriaId === cat.id ? cat.color : undefined,
                    borderColor: categoriaId === cat.id ? cat.color : undefined,
                  }}
                >
                  <span>{cat.icono}</span>
                  <span>{cat.nombre}</span>
                </button>
              ))}
            </div>
            {errors.categoriaId && (
              <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                <span>⚠️</span> {errors.categoriaId}
              </p>
            )}
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Descripción
              <span className="font-normal text-gray-400 ml-1">(opcional)</span>
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Una breve descripción del contenido..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-lavender-500 focus:ring-4 focus:ring-lavender-500/10 transition-all duration-200 outline-none resize-none"
            />
          </div>

          {/* Thumbnail URL */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              URL de imagen de vista previa
              <span className="font-normal text-gray-400 ml-1">(opcional)</span>
            </label>
            <input
              type="url"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="https://ejemplo.com/imagen.jpg"
              className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 outline-none ${
                errors.thumbnail
                  ? 'border-red-300 bg-red-50 focus:border-red-500'
                  : 'border-gray-200 focus:border-lavender-500 focus:ring-4 focus:ring-lavender-500/10'
              }`}
            />
            {errors.thumbnail && (
              <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                <span>⚠️</span> {errors.thumbnail}
              </p>
            )}
            {thumbnail && isValidUrl(thumbnail) && (
              <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 h-24">
                <img
                  src={thumbnail}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '';
                    e.currentTarget.alt = 'Error al cargar imagen';
                  }}
                />
              </div>
            )}
          </div>

          {/* Notas privadas */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notas privadas
              <span className="font-normal text-gray-400 ml-1">(solo visible para familiares)</span>
            </label>
            <textarea
              value={notasPrivadas}
              onChange={(e) => setNotasPrivadas(e.target.value)}
              placeholder="Notas internas sobre este recurso..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-lavender-500 focus:ring-4 focus:ring-lavender-500/10 transition-all duration-200 outline-none resize-none"
            />
          </div>
        </form>

        {/* Footer con botones */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-lavender-500 to-lavender-600 hover:from-lavender-600 hover:to-lavender-700 text-white font-semibold rounded-xl transition-all shadow-md shadow-lavender-500/20 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <span>{isEditing ? '💾' : '➕'}</span>
                <span>{isEditing ? 'Guardar Cambios' : 'Crear Recurso'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
