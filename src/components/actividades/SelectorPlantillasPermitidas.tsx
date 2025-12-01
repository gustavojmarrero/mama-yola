import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { TipoActividadV2, TIPOS_ACTIVIDAD_CONFIG, mapearTipoActividad } from '../../types/actividades';
import type { PlantillaActividad } from '../../types';

const PACIENTE_ID = 'paciente-principal';

interface SelectorPlantillasPermitidasProps {
  tipo: TipoActividadV2;
  value: string[]; // IDs de plantillas seleccionadas
  onChange: (plantillasIds: string[]) => void;
  disabled?: boolean;
}

export default function SelectorPlantillasPermitidas({
  tipo,
  value,
  onChange,
  disabled = false,
}: SelectorPlantillasPermitidasProps) {
  const [plantillas, setPlantillas] = useState<PlantillaActividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectAll, setSelectAll] = useState(true);

  // Cargar plantillas del tipo seleccionado
  useEffect(() => {
    const cargarPlantillas = async () => {
      setLoading(true);
      try {
        const plantillasRef = collection(
          db,
          'pacientes',
          PACIENTE_ID,
          'plantillasActividades'
        );

        // Obtener todas las plantillas activas
        const q = query(
          plantillasRef,
          where('activo', '==', true),
          orderBy('nombre', 'asc')
        );

        const snapshot = await getDocs(q);
        const todas = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PlantillaActividad[];

        // Filtrar por tipo (considerando tipos legacy)
        const filtradas = todas.filter((p) => {
          const tipoMapeado = mapearTipoActividad(p.tipo);
          return tipoMapeado === tipo;
        });

        setPlantillas(filtradas);

        // Si no hay selección previa o "todas" está habilitado, seleccionar todas
        if (value.length === 0) {
          setSelectAll(true);
        } else {
          setSelectAll(false);
        }
      } catch (error) {
        console.error('Error cargando plantillas:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarPlantillas();
  }, [tipo]);

  const togglePlantilla = (plantillaId: string) => {
    if (disabled) return;

    if (selectAll) {
      // Si está en modo "todas", cambiar a modo selección manual
      setSelectAll(false);
      onChange([plantillaId]);
    } else {
      if (value.includes(plantillaId)) {
        const nuevasSeleccionadas = value.filter((id) => id !== plantillaId);
        if (nuevasSeleccionadas.length === 0) {
          // Si se deseleccionan todas, volver a modo "todas"
          setSelectAll(true);
          onChange([]);
        } else {
          onChange(nuevasSeleccionadas);
        }
      } else {
        onChange([...value, plantillaId]);
      }
    }
  };

  const handleSelectAllChange = () => {
    if (disabled) return;

    if (!selectAll) {
      setSelectAll(true);
      onChange([]); // Vacío significa "todas permitidas"
    }
  };

  const config = TIPOS_ACTIVIDAD_CONFIG[tipo];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-lavender-600"></div>
        <span className="ml-2 text-gray-500">Cargando plantillas...</span>
      </div>
    );
  }

  if (plantillas.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500">
          No hay plantillas de tipo {config.label.toLowerCase()} disponibles.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          El cuidador podrá crear actividades manualmente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Opción de seleccionar todas */}
      <label
        className={`
          flex items-center gap-3 p-3 rounded-lg border-2 transition-all
          ${
            selectAll
              ? 'border-lavender-400 bg-lavender-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <input
          type="checkbox"
          checked={selectAll}
          onChange={handleSelectAllChange}
          disabled={disabled}
          className="w-5 h-5 rounded text-lavender-600 focus:ring-lavender-500"
        />
        <div className="flex-1">
          <span className="font-medium text-gray-800">
            Todas las plantillas {config.label.toLowerCase()}s
          </span>
          <p className="text-xs text-gray-500">
            El cuidador podrá elegir cualquier plantilla de tipo {config.label.toLowerCase()}
          </p>
        </div>
        <span className="text-2xl">{config.icon}</span>
      </label>

      {/* Divider con texto */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-gray-500">
            O selecciona plantillas específicas
          </span>
        </div>
      </div>

      {/* Lista de plantillas */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {plantillas.map((plantilla) => {
          const isSelected = selectAll || value.includes(plantilla.id);

          return (
            <label
              key={plantilla.id}
              className={`
                flex items-center gap-3 p-3 rounded-lg border transition-all
                ${
                  isSelected && !selectAll
                    ? 'border-lavender-400 bg-lavender-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }
                ${selectAll ? 'opacity-60' : ''}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => togglePlantilla(plantilla.id)}
                disabled={disabled || selectAll}
                className="w-4 h-4 rounded text-lavender-600 focus:ring-lavender-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 truncate">
                    {plantilla.nombre}
                  </span>
                  {plantilla.favorita && <span className="text-amber-500">★</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{plantilla.duracion} min</span>
                  {plantilla.ubicacion && (
                    <>
                      <span>•</span>
                      <span className="truncate">{plantilla.ubicacion}</span>
                    </>
                  )}
                </div>
              </div>
              {plantilla.foto && (
                <img
                  src={plantilla.foto}
                  alt={plantilla.nombre}
                  className="w-10 h-10 rounded object-cover"
                />
              )}
            </label>
          );
        })}
      </div>

      {/* Resumen de selección */}
      <div className="text-center text-xs text-gray-500 pt-2 border-t border-gray-100">
        {selectAll
          ? `Todas las ${plantillas.length} plantillas ${config.label.toLowerCase()}s disponibles`
          : `${value.length} de ${plantillas.length} plantillas seleccionadas`}
      </div>
    </div>
  );
}
