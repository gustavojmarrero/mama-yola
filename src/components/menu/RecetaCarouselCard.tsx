import { useState } from 'react';
import { Receta } from '../../types';

interface RecetaCarouselCardProps {
  receta: Receta;
  onSelect: (receta: Receta) => void;
}

export function RecetaCarouselCard({ receta, onSelect }: RecetaCarouselCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const showPlaceholder = !receta.foto || imageError;

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-black/5 border border-gray-100 overflow-hidden">
      {/* Imagen */}
      <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-amber-50 to-orange-50">
        {!showPlaceholder && (
          <>
            {/* Skeleton mientras carga */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse" />
            )}
            <img
              src={receta.foto}
              alt={receta.nombre}
              className={`
                w-full h-full object-cover
                transition-opacity duration-300
                ${imageLoaded ? 'opacity-100' : 'opacity-0'}
              `}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        )}

        {/* Placeholder si no hay imagen */}
        {showPlaceholder && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-7xl opacity-60">
              {receta.categoria === 'bebida' ? '\u2615' : '\ud83c\udf7d\ufe0f'}
            </span>
          </div>
        )}

        {/* Badge favorita */}
        {receta.favorita && (
          <div className="absolute top-3 right-3 bg-amber-400/95 backdrop-blur-sm text-amber-900 px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Favorita
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-5">
        {/* Nombre */}
        <h3 className="text-xl font-bold text-gray-800 mb-3 leading-tight">
          {receta.nombre}
        </h3>

        {/* Etiquetas */}
        {receta.etiquetas && receta.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {receta.etiquetas.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium"
              >
                {tag}
              </span>
            ))}
            {receta.etiquetas.length > 3 && (
              <span className="text-xs text-gray-400 px-1 py-1">
                +{receta.etiquetas.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Botón de seleccionar */}
        <button
          onClick={() => onSelect(receta)}
          className="
            w-full py-3.5 rounded-xl font-semibold text-base
            bg-gradient-to-r from-amber-500 to-orange-500
            text-white shadow-lg shadow-amber-500/25
            transition-all duration-200 ease-out
            hover:shadow-xl hover:shadow-amber-500/30 hover:-translate-y-0.5
            active:scale-[0.98] active:shadow-md
          "
        >
          Seleccionar receta
        </button>
      </div>
    </div>
  );
}

export default RecetaCarouselCard;
