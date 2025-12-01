import { useState } from 'react';
import { PlantillaActividad, TipoActividad, TurnoActividad } from '../../types';

interface TipoInfo {
  value: TipoActividad;
  label: string;
  icon: string;
}

interface TurnoInfo {
  label: string;
  icon: string;
  color: string;
}

interface PlantillaCarouselCardProps {
  plantilla: PlantillaActividad;
  onUsar: () => void;
  onEditar: () => void;
  onDuplicar: () => void;
  onEliminar: () => void;
  onToggleFavorita: () => void;
  tiposActividad: TipoInfo[];
  getTurnoInfo: (turno: TurnoActividad) => TurnoInfo;
  coloresTipo: Record<TipoActividad, string>;
}

export function PlantillaCarouselCard({
  plantilla,
  onUsar,
  onEditar,
  onDuplicar,
  onEliminar,
  onToggleFavorita,
  tiposActividad,
  getTurnoInfo,
  coloresTipo,
}: PlantillaCarouselCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const showPlaceholder = !plantilla.foto || imageError;
  const tipoInfo = tiposActividad.find(t => t.value === plantilla.tipo);

  return (
    <div className={`border rounded-lg overflow-hidden hover:shadow-lg transition-shadow max-w-xs mx-auto ${coloresTipo[plantilla.tipo]}`}>
      {/* Foto de la plantilla */}
      {plantilla.foto && !imageError ? (
        <div className="h-32 overflow-hidden relative">
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse" />
          )}
          <img
            src={plantilla.foto}
            alt={plantilla.nombre}
            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </div>
      ) : null}

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{tipoInfo?.icon}</span>
            <h3 className="font-semibold">{plantilla.nombre}</h3>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorita();
            }}
            className="text-xl hover:scale-110 transition-transform"
          >
            {plantilla.favorita ? '⭐' : '☆'}
          </button>
        </div>

        <p className="text-sm opacity-80 mb-2 line-clamp-2">{plantilla.descripcion}</p>

        <div className="flex flex-wrap gap-2 text-xs mb-3">
          <span className="bg-white/50 px-2 py-0.5 rounded">
            ⏱️ {plantilla.duracion} min
          </span>
          <span className="bg-white/50 px-2 py-0.5 rounded">
            {plantilla.nivelEnergia === 'bajo' ? '🔋' : plantilla.nivelEnergia === 'medio' ? '🔋🔋' : '🔋🔋🔋'}
          </span>
          {plantilla.ubicacion && (
            <span className="bg-white/50 px-2 py-0.5 rounded">
              📍 {plantilla.ubicacion}
            </span>
          )}
        </div>

        {/* Materiales */}
        {plantilla.materialesNecesarios && plantilla.materialesNecesarios.length > 0 && (
          <div className="text-xs mb-2">
            <span className="opacity-70">Materiales: </span>
            {plantilla.materialesNecesarios.slice(0, 3).join(', ')}
            {plantilla.materialesNecesarios.length > 3 && ` +${plantilla.materialesNecesarios.length - 3}`}
          </div>
        )}

        {/* Etiquetas */}
        {plantilla.etiquetas && plantilla.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {plantilla.etiquetas.map((etiqueta, idx) => (
              <span key={idx} className="text-xs bg-white/30 px-2 py-0.5 rounded">
                #{etiqueta}
              </span>
            ))}
          </div>
        )}

        {/* Turnos */}
        {plantilla.turnos && plantilla.turnos.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {plantilla.turnos.map((turno) => {
              const info = getTurnoInfo(turno);
              return (
                <span key={turno} className={`text-xs px-2 py-0.5 rounded ${info.color}`}>
                  {info.icon} {info.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2">
          <button
            onClick={onUsar}
            className="flex-1 py-2 bg-white/80 rounded-lg text-sm font-medium hover:bg-white transition-colors"
          >
            ✓ Usar
          </button>
          <button
            onClick={onEditar}
            className="p-2 bg-white/50 rounded-lg hover:bg-white/80"
            title="Editar"
          >
            ✏️
          </button>
          <button
            onClick={onDuplicar}
            className="p-2 bg-white/50 rounded-lg hover:bg-white/80"
            title="Duplicar"
          >
            📄
          </button>
          <button
            onClick={onEliminar}
            className="p-2 bg-white/50 rounded-lg hover:bg-red-100 text-red-600"
            title="Eliminar"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlantillaCarouselCard;
