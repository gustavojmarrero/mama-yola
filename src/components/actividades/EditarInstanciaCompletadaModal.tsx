import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  InstanciaActividad,
  ActividadElegida,
  TIPOS_ACTIVIDAD_CONFIG,
  mapearTipoActividad,
} from '../../types/actividades';
import { actualizarInstanciaCompletada, vaciarInstanciaCompletada } from '../../services/instanciasActividades';
import type { PlantillaActividad, ParticipacionActividad } from '../../types';

const PACIENTE_ID = 'paciente-principal';

interface EditarInstanciaCompletadaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  instancia: InstanciaActividad | null;
}

interface FormState {
  duracionReal: number;
  participacion: ParticipacionActividad;
  estadoAnimo: string;
  notas: string;
}

const ESTADOS_ANIMO = [
  { value: 'alegre', label: 'Alegre', emoji: '😊' },
  { value: 'neutral', label: 'Neutral', emoji: '😐' },
  { value: 'tranquila', label: 'Tranquila', emoji: '😌' },
  { value: 'cansada', label: 'Cansada', emoji: '😴' },
  { value: 'frustrada', label: 'Frustrada', emoji: '😤' },
  { value: 'triste', label: 'Triste', emoji: '😢' },
];

export default function EditarInstanciaCompletadaModal({
  isOpen,
  onClose,
  onSuccess,
  instancia,
}: EditarInstanciaCompletadaModalProps) {
  const [paso, setPaso] = useState<'editar' | 'cambiar' | 'vaciar'>('editar');
  const [plantillas, setPlantillas] = useState<PlantillaActividad[]>([]);
  const [loading, setLoading] = useState(false);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaActividad | null>(null);
  const [actividadElegida, setActividadElegida] = useState<ActividadElegida | null>(null);
  const [form, setForm] = useState<FormState>({
    duracionReal: 30,
    participacion: 'activa',
    estadoAnimo: '',
    notas: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar plantillas cuando se quiere cambiar la actividad
  useEffect(() => {
    const cargarPlantillas = async () => {
      if (!isOpen || !instancia || paso !== 'cambiar') return;

      setLoading(true);
      try {
        const plantillasRef = collection(
          db,
          'pacientes',
          PACIENTE_ID,
          'plantillasActividades'
        );

        const q = query(
          plantillasRef,
          where('activo', '==', true),
          orderBy('nombre', 'asc')
        );

        const snapshot = await getDocs(q);
        let todas = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PlantillaActividad[];

        // Filtrar por tipo
        todas = todas.filter((p) => {
          const tipoMapeado = mapearTipoActividad(p.tipo);
          return tipoMapeado === instancia.tipo;
        });

        // Filtrar por plantillas permitidas si hay restricciones
        const permitidas = instancia.slotAbierto?.plantillasPermitidas;
        if (permitidas && permitidas.length > 0) {
          todas = todas.filter((p) => permitidas.includes(p.id));
        }

        setPlantillas(todas);
      } catch (err) {
        console.error('Error cargando plantillas:', err);
      } finally {
        setLoading(false);
      }
    };

    cargarPlantillas();
  }, [isOpen, instancia, paso]);

  // Inicializar con datos actuales cuando se abre
  useEffect(() => {
    if (isOpen && instancia) {
      setPaso('editar');
      setPlantillaSeleccionada(null);
      setActividadElegida(instancia.actividadElegida || null);
      setForm({
        duracionReal: instancia.ejecucion?.duracionReal || 30,
        participacion: instancia.ejecucion?.participacion || 'activa',
        estadoAnimo: instancia.ejecucion?.estadoAnimo || '',
        notas: instancia.ejecucion?.notas || '',
      });
      setError(null);
    }
  }, [isOpen, instancia]);

  const handleSeleccionarPlantilla = (plantilla: PlantillaActividad) => {
    setPlantillaSeleccionada(plantilla);
    // La duración viene del slot, no de la plantilla
    const duracionSlot = instancia?.slotAbierto?.duracionEstimada || form.duracionReal;
    const nuevaActividad: ActividadElegida = {
      plantillaId: plantilla.id,
      nombre: plantilla.nombre,
      duracion: duracionSlot,
      descripcion: plantilla.descripcion,
      ubicacion: plantilla.ubicacion,
      nivelEnergia: plantilla.nivelEnergia,
    };
    setActividadElegida(nuevaActividad);
    // No cambiar duracionReal, mantener la que ya tiene
    setPaso('editar');
  };

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleGuardar = async () => {
    if (!instancia || !actividadElegida) return;

    setSaving(true);
    setError(null);

    try {
      await actualizarInstanciaCompletada(
        instancia.id,
        actividadElegida,
        form.duracionReal,
        form.participacion,
        form.estadoAnimo || undefined,
        form.notas || undefined
      );

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error actualizando instancia:', err);
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleVaciar = async () => {
    if (!instancia) return;

    setSaving(true);
    setError(null);

    try {
      await vaciarInstanciaCompletada(instancia.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error vaciando instancia:', err);
      setError('Error al vaciar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !instancia || !actividadElegida) return null;

  const tipoConfig = TIPOS_ACTIVIDAD_CONFIG[instancia.tipo];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
          {/* Handle de arrastre móvil */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">
                {paso === 'editar' ? 'Editar Actividad' : 'Cambiar Actividad'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Info del slot */}
            <div className="mt-3 p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-xl">{tipoConfig.icon}</span>
                <div>
                  <h3 className="font-medium text-gray-800">
                    {instancia.horaPreferida} - Actividad {tipoConfig.label}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Paso: Editar detalles */}
            {paso === 'editar' && (
              <div className="space-y-5">
                {/* Actividad actual seleccionada */}
                <div className={`p-3 rounded-xl ${tipoConfig.bgColor}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{tipoConfig.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">{actividadElegida.nombre}</h3>
                      {actividadElegida.ubicacion && (
                        <p className="text-xs text-gray-600">{actividadElegida.ubicacion}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setPaso('cambiar')}
                      className="text-xs text-lavender-600 hover:text-lavender-700 font-medium"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>

                {/* Duración Real */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duración Real (minutos)
                  </label>
                  <input
                    type="number"
                    value={form.duracionReal}
                    onChange={(e) => handleChange('duracionReal', parseInt(e.target.value) || 0)}
                    min={1}
                    max={180}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                  />
                </div>

                {/* Nivel de Participación */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nivel de Participación
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'activa', label: 'Activa', desc: 'Con gusto' },
                      { value: 'pasiva', label: 'Pasiva', desc: 'Con ayuda' },
                      { value: 'minima', label: 'Mínima', desc: 'Poca' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleChange('participacion', opt.value as ParticipacionActividad)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          form.participacion === opt.value
                            ? 'border-lavender-500 bg-lavender-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-sm">{opt.label}</div>
                        <div className="text-xs text-gray-500">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Estado de Ánimo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado de Ánimo (opcional)
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {ESTADOS_ANIMO.map((estado) => (
                      <button
                        key={estado.value}
                        type="button"
                        onClick={() =>
                          handleChange(
                            'estadoAnimo',
                            form.estadoAnimo === estado.value ? '' : estado.value
                          )
                        }
                        className={`flex-shrink-0 px-3 py-2 rounded-xl border-2 transition-all ${
                          form.estadoAnimo === estado.value
                            ? 'border-lavender-500 bg-lavender-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-lg">{estado.emoji}</span>
                        <span className="ml-1 text-sm">{estado.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={form.notas}
                    onChange={(e) => handleChange('notas', e.target.value)}
                    placeholder="Observaciones..."
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            )}

            {/* Paso: Cambiar actividad */}
            {paso === 'cambiar' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Selecciona otra actividad {tipoConfig.label.toLowerCase()}:
                </p>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lavender-600"></div>
                  </div>
                ) : plantillas.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      No hay otras plantillas disponibles.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {plantillas.map((plantilla) => {
                      const isSelected = plantilla.id === actividadElegida.plantillaId;
                      return (
                        <button
                          key={plantilla.id}
                          onClick={() => handleSeleccionarPlantilla(plantilla)}
                          className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                            isSelected
                              ? 'border-lavender-500 bg-lavender-50'
                              : 'border-gray-200 hover:border-lavender-400 hover:bg-lavender-50'
                          }`}
                        >
                          {plantilla.foto ? (
                            <img
                              src={plantilla.foto}
                              alt={plantilla.nombre}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${tipoConfig.bgColor}`}>
                              {tipoConfig.icon}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800 truncate">
                                {plantilla.nombre}
                              </span>
                              {plantilla.favorita && <span className="text-amber-500">★</span>}
                              {isSelected && (
                                <span className="text-xs bg-lavender-600 text-white px-2 py-0.5 rounded-full">
                                  Actual
                                </span>
                              )}
                            </div>
                            {plantilla.ubicacion && (
                              <div className="text-xs text-gray-500">
                                {plantilla.ubicacion}
                              </div>
                            )}
                          </div>
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={() => setPaso('editar')}
                  className="text-sm text-lavender-600 hover:text-lavender-700"
                >
                  ← Volver a editar
                </button>
              </div>
            )}

            {/* Paso: Confirmar eliminar */}
            {paso === 'vaciar' && (
              <div className="space-y-4 py-4">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    ¿Eliminar esta actividad?
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Podrás elegir otra actividad después.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setPaso('editar')}
                    disabled={saving}
                    className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    No, volver
                  </button>
                  <button
                    type="button"
                    onClick={handleVaciar}
                    disabled={saving}
                    className="flex-1 py-3 px-4 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 bg-red-500 text-white hover:bg-red-600"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Eliminando...
                      </>
                    ) : (
                      'Sí, eliminar'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          {paso === 'editar' && (
            <div className="px-6 py-4 border-t border-gray-100">
              {/* Acción destructiva - sutil pero accesible */}
              <div className="flex justify-center mb-4">
                <button
                  type="button"
                  onClick={() => setPaso('vaciar')}
                  disabled={saving}
                  className="group flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-red-500 transition-all duration-200 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="font-medium">Eliminar actividad</span>
                </button>
              </div>

              {/* Acciones principales */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardar}
                  disabled={saving}
                  className="flex-1 py-3 px-4 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 bg-lavender-600 text-white hover:bg-lavender-700"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
