import { RecursoDigital, CategoriaRecurso } from '../../types';

interface RecursoCardProps {
  recurso: RecursoDigital;
  categoria?: CategoriaRecurso;
  puedeEditar: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorito: () => void;
}

// Función para obtener favicon de un dominio
function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;

    // Dominios que no funcionan bien con el servicio de favicon
    // Usamos iconos conocidos directamente
    if (domain.includes('goo.gl') || domain.includes('photos.app.goo')) {
      return 'https://www.google.com/s2/favicons?domain=photos.google.com&sz=64';
    }
    if (domain.includes('youtu.be')) {
      return 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64';
    }
    if (domain.includes('bit.ly') || domain.includes('tinyurl')) {
      return ''; // URLs acortadas genéricas, no mostrar favicon
    }

    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return '';
  }
}

// Función para obtener el dominio legible
function getDomainName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch {
    return 'enlace';
  }
}

// Colores de fondo por tipo de plataforma
function getBackgroundGradient(url: string): string {
  const domain = getDomainName(url).toLowerCase();

  if (domain.includes('spotify')) return 'from-green-500/20 to-green-600/30';
  if (domain.includes('youtube')) return 'from-red-500/20 to-red-600/30';
  if (domain.includes('netflix')) return 'from-red-600/20 to-black/30';
  if (domain.includes('photos.google') || domain.includes('photos.app.goo')) return 'from-blue-500/20 to-green-500/20';
  if (domain.includes('icloud')) return 'from-blue-400/20 to-blue-500/30';
  if (domain.includes('flickr')) return 'from-pink-500/20 to-blue-500/20';
  if (domain.includes('amazon') || domain.includes('primevideo')) return 'from-blue-600/20 to-cyan-500/20';
  if (domain.includes('apple')) return 'from-gray-400/20 to-gray-500/30';
  if (domain.includes('tidal')) return 'from-black/20 to-gray-600/30';
  if (domain.includes('deezer')) return 'from-purple-500/20 to-pink-500/20';
  if (domain.includes('soundcloud')) return 'from-orange-500/20 to-orange-600/30';
  if (domain.includes('vimeo')) return 'from-cyan-500/20 to-blue-500/20';
  if (domain.includes('disney')) return 'from-blue-700/20 to-purple-600/20';
  if (domain.includes('hbo')) return 'from-purple-700/20 to-purple-800/30';

  return 'from-lavender-100/50 to-lavender-200/50';
}

export default function RecursoCard({
  recurso,
  categoria,
  puedeEditar,
  onEdit,
  onDelete,
  onToggleFavorito,
}: RecursoCardProps) {
  const faviconUrl = getFaviconUrl(recurso.url);
  const domainName = getDomainName(recurso.url);
  const bgGradient = getBackgroundGradient(recurso.url);
  const categoriaColor = categoria?.color || '#8B7BB8';

  return (
    <div
      className={`
        group relative bg-white rounded-2xl border overflow-hidden
        transition-all duration-300 ease-out
        hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-1
        ${recurso.favorito ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200'}
      `}
    >
      {/* Thumbnail o placeholder con gradiente */}
      <div className={`relative h-36 bg-gradient-to-br ${bgGradient} overflow-hidden`}>
        {recurso.thumbnail ? (
          <img
            src={recurso.thumbnail}
            alt={recurso.titulo}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Patrón decorativo de fondo */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-4 left-4 w-16 h-16 rounded-full bg-white/20 blur-xl" />
              <div className="absolute bottom-4 right-4 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-white/15 blur-2xl" />
            </div>

            {/* Icono de categoría grande */}
            <span className="text-6xl opacity-60 transform group-hover:scale-110 transition-transform duration-300">
              {categoria?.icono || '🔗'}
            </span>
          </div>
        )}

        {/* Overlay con gradiente */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Badge de categoría */}
        <div
          className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-lg backdrop-blur-sm flex items-center gap-1.5"
          style={{ backgroundColor: `${categoriaColor}dd` }}
        >
          <span>{categoria?.icono || '🔗'}</span>
          <span>{categoria?.nombre || 'Sin categoría'}</span>
        </div>

        {/* Botón favorito */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorito();
          }}
          className={`
            absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center
            transition-all duration-300 backdrop-blur-sm
            ${recurso.favorito
              ? 'bg-amber-400 text-white shadow-lg shadow-amber-400/30 scale-110'
              : 'bg-white/80 text-gray-400 hover:bg-white hover:text-amber-500 hover:scale-110'
            }
          `}
        >
          <span className="text-lg">{recurso.favorito ? '⭐' : '☆'}</span>
        </button>

        {/* Favicon del sitio */}
        {faviconUrl && (
          <div className="absolute bottom-3 right-3 w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center overflow-hidden">
            <img
              src={faviconUrl}
              alt={domainName}
              className="w-5 h-5"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4">
        <h3 className="font-bold text-gray-900 text-lg leading-tight line-clamp-2 mb-1 group-hover:text-lavender-700 transition-colors">
          {recurso.titulo}
        </h3>

        {recurso.descripcion && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
            {recurso.descripcion}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
          <span className="flex items-center gap-1">
            <span>🌐</span>
            <span className="truncate max-w-[150px]">{domainName}</span>
          </span>
          <span>•</span>
          <span>{new Date(recurso.creadoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
        </div>

        {/* Acciones */}
        <div className="flex gap-2">
          <a
            href={recurso.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-lavender-500 to-lavender-600 hover:from-lavender-600 hover:to-lavender-700 text-white font-medium rounded-xl text-sm text-center transition-all duration-200 shadow-md shadow-lavender-500/20 hover:shadow-lg hover:shadow-lavender-500/30 flex items-center justify-center gap-2"
          >
            <span>Abrir</span>
            <span className="text-base">↗</span>
          </a>

          <a
            href={`https://wa.me/529982235370?text=${encodeURIComponent(`${recurso.titulo}\n${recurso.url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-colors"
            title="Compartir por WhatsApp"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>

          {puedeEditar && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                title="Editar"
              >
                ✏️
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-medium transition-colors"
                title="Eliminar"
              >
                🗑️
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
