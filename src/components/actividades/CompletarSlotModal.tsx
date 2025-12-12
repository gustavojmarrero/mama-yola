import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import {
  InstanciaActividad,
  ActividadElegida,
  TIPOS_ACTIVIDAD_CONFIG,
  mapearTipoActividad,
} from '../../types/actividades';
import { completarSlotAbierto, omitirInstancia } from '../../services/instanciasActividades';
import type { PlantillaActividad, ParticipacionActividad } from '../../types';

const PACIENTE_ID = 'paciente-principal';

interface CompletarSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  instancia: InstanciaActividad | null;
  userId: string;
  userNombre: string;
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

export default function CompletarSlotModal({
  isOpen,
  onClose,
  onSuccess,
  instancia,
  userId,
  userNombre,
}: CompletarSlotModalProps) {
  const [paso, setPaso] = useState<'elegir' | 'completar' | 'omitir'>('elegir');
  const [plantillas, setPlantillas] = useState<PlantillaActividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaActividad | null>(null);
  const [form, setForm] = useState<FormState>({
    duracionReal: 30,
    participacion: 'activa',
    estadoAnimo: '',
    notas: '',
  });
  const [motivoOmision, setMotivoOmision] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para captura de actividad custom
  const [customForm, setCustomForm] = useState({
    nombre: '',
    descripcion: '',
    foto: '',
  });
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Cargar plantillas filtradas
  useEffect(() => {
    const cargarPlantillas = async () => {
      if (!isOpen || !instancia) return;

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

        // Filtrar por tipo - usar instancia.tipo directamente
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
  }, [isOpen, instancia]);

  // Reset cuando se abre
  useEffect(() => {
    if (isOpen) {
      setPaso('elegir');
      setPlantillaSeleccionada(null);
      setForm({
        duracionReal: instancia?.slotAbierto?.duracionEstimada || 30,
        participacion: 'activa',
        estadoAnimo: '',
        notas: '',
      });
      setMotivoOmision('');
      setError(null);
      // Reset formulario custom
      setCustomForm({ nombre: '', descripcion: '', foto: '' });
    }
  }, [isOpen, instancia]);

  const handleSeleccionarPlantilla = (plantilla: PlantillaActividad) => {
    setPlantillaSeleccionada(plantilla);
    // La duración viene del slot, no de la plantilla
    // No cambiar duracionReal, ya viene inicializada con la del slot
    setPaso('completar');
  };

  const handleSeleccionarCustom = () => {
    if (!customForm.nombre.trim()) return;
    setPlantillaSeleccionada(null); // Asegurar que no hay plantilla seleccionada
    setPaso('completar');
  };

  const handleFotoCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubiendoFoto(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}.${ext}`;
      const storageRef = ref(storage, `actividades-custom/${fileName}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setCustomForm(prev => ({ ...prev, foto: url }));
    } catch (error) {
      console.error('Error al subir foto:', error);
      setError('Error al subir la foto');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleCompletar = async () => {
    if (!instancia) return;

    // Validar que hay plantilla seleccionada O datos custom
    if (!plantillaSeleccionada && !customForm.nombre.trim()) return;

    setSaving(true);
    setError(null);

    try {
      let actividadElegida: ActividadElegida;

      if (plantillaSeleccionada) {
        // Flujo existente: plantilla seleccionada
        actividadElegida = {
          plantillaId: plantillaSeleccionada.id,
          nombre: plantillaSeleccionada.nombre,
          duracion: instancia.slotAbierto?.duracionEstimada || form.duracionReal,
          descripcion: plantillaSeleccionada.descripcion,
          ubicacion: plantillaSeleccionada.ubicacion,
          nivelEnergia: plantillaSeleccionada.nivelEnergia,
        };
      } else {
        // Nuevo flujo: actividad custom
        actividadElegida = {
          plantillaId: null,
          nombre: customForm.nombre.trim(),
          duracion: form.duracionReal,
          descripcion: customForm.descripcion.trim() || undefined,
          esCustom: true,
          fotoCustom: customForm.foto || undefined,
        };
      }

      await completarSlotAbierto(
        instancia.id,
        actividadElegida,
        userId,
        userNombre,
        form.duracionReal,
        form.participacion,
        form.estadoAnimo || undefined,
        form.notas || undefined
      );

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error completando slot:', err);
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleOmitir = async () => {
    if (!instancia) return;

    if (!motivoOmision.trim()) {
      setError('Por favor indica el motivo de omisión');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await omitirInstancia(
        instancia.id,
        motivoOmision.trim(),
        userId,
        userNombre
      );

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error omitiendo slot:', err);
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !instancia || !instancia.slotAbierto) return null;

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
                {paso === 'elegir'
                  ? 'Elegir Actividad'
                  : paso === 'completar'
                  ? 'Completar Actividad'
                  : 'Omitir Actividad'}
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
            <div className="mt-3 p-3 rounded-xl bg-gray-50 border-2 border-dashed border-gray-300">
              <div className="flex items-center gap-2">
                <span className="text-xl">{tipoConfig.icon}</span>
                <div>
                  <h3 className="font-medium text-gray-800">
                    Actividad {tipoConfig.label} - {instancia.horaPreferida}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {instancia.slotAbierto.duracionEstimada} min estimados
                    {instancia.slotAbierto.instrucciones && (
                      <span className="block text-xs italic mt-1">
                        {instancia.slotAbierto.instrucciones}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Paso 1: Elegir plantilla */}
            {paso === 'elegir' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Elige la actividad {tipoConfig.label.toLowerCase()} que realizaste:
                </p>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lavender-600"></div>
                  </div>
                ) : plantillas.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      No hay plantillas disponibles para este tipo de actividad.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {plantillas.map((plantilla) => (
                      <button
                        key={plantilla.id}
                        onClick={() => handleSeleccionarPlantilla(plantilla)}
                        className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-lavender-400 hover:bg-lavender-50 transition-all text-left flex items-center gap-3"
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
                    ))}
                  </div>
                )}

                {/* Separador y formulario para actividad custom */}
                {!loading && (
                  <>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-white text-gray-500">
                          o capturar actividad nueva
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      {/* Nombre */}
                      <input
                        type="text"
                        value={customForm.nombre}
                        onChange={(e) => setCustomForm(prev => ({ ...prev, nombre: e.target.value }))}
                        placeholder="Nombre de la actividad realizada..."
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent bg-white"
                      />

                      {/* Campos adicionales cuando hay nombre */}
                      {customForm.nombre.trim() && (
                        <>
                          {/* Descripción */}
                          <textarea
                            value={customForm.descripcion}
                            onChange={(e) => setCustomForm(prev => ({ ...prev, descripcion: e.target.value }))}
                            placeholder="Descripción breve (opcional)..."
                            rows={2}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent resize-none bg-white"
                          />

                          {/* Foto */}
                          <div className="flex gap-2">
                            {customForm.foto ? (
                              <div className="relative">
                                <img
                                  src={customForm.foto}
                                  alt="Preview"
                                  className="w-16 h-16 rounded-lg object-cover"
                                />
                                <button
                                  onClick={() => setCustomForm(prev => ({ ...prev, foto: '' }))}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <>
                                <label className="flex-1 flex items-center justify-center gap-2 py-2 px-3 border border-gray-200 rounded-xl bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleFotoCustomUpload}
                                    className="hidden"
                                    disabled={subiendoFoto}
                                  />
                                  {subiendoFoto ? (
                                    <div className="w-4 h-4 border-2 border-gray-300 border-t-lavender-600 rounded-full animate-spin" />
                                  ) : (
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  )}
                                  <span className="text-sm text-gray-600">Foto</span>
                                </label>
                                <label className="flex-1 flex items-center justify-center gap-2 py-2 px-3 border border-gray-200 rounded-xl bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFotoCustomUpload}
                                    className="hidden"
                                    disabled={subiendoFoto}
                                  />
                                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-sm text-gray-600">Galería</span>
                                </label>
                              </>
                            )}
                          </div>

                          {/* Botón continuar */}
                          <button
                            onClick={handleSeleccionarCustom}
                            disabled={!customForm.nombre.trim()}
                            className="w-full py-3 bg-lavender-600 text-white rounded-xl font-medium hover:bg-lavender-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            Continuar con esta actividad
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}

                {/* Botón omitir */}
                <button
                  onClick={() => setPaso('omitir')}
                  className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm"
                >
                  No se realizó ninguna actividad
                </button>
              </div>
            )}

            {/* Paso 2: Completar detalles */}
            {paso === 'completar' && (plantillaSeleccionada || customForm.nombre.trim()) && (
              <div className="space-y-5">
                {/* Actividad seleccionada (plantilla o custom) */}
                <div className={`p-3 rounded-xl ${tipoConfig.bgColor}`}>
                  <div className="flex items-center gap-2">
                    {/* Foto o icono */}
                    {plantillaSeleccionada?.foto ? (
                      <img
                        src={plantillaSeleccionada.foto}
                        alt={plantillaSeleccionada.nombre}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : customForm.foto ? (
                      <img
                        src={customForm.foto}
                        alt={customForm.nombre}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="text-xl">{tipoConfig.icon}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 truncate">
                        {plantillaSeleccionada?.nombre || customForm.nombre}
                      </h3>
                      {plantillaSeleccionada?.ubicacion && (
                        <p className="text-xs text-gray-600">{plantillaSeleccionada.ubicacion}</p>
                      )}
                      {!plantillaSeleccionada && customForm.descripcion && (
                        <p className="text-xs text-gray-600 truncate">{customForm.descripcion}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setPlantillaSeleccionada(null);
                        setPaso('elegir');
                      }}
                      className="ml-auto text-xs text-gray-500 hover:text-gray-700"
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

            {/* Paso 3: Omitir */}
            {paso === 'omitir' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo de Omisión *
                  </label>
                  <textarea
                    value={motivoOmision}
                    onChange={(e) => setMotivoOmision(e.target.value)}
                    placeholder="¿Por qué no se realizó ninguna actividad?"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent resize-none"
                  />
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    Al omitir el slot, quedará registrado como no completado.
                  </p>
                </div>
                <button
                  onClick={() => setPaso('elegir')}
                  className="text-sm text-lavender-600 hover:text-lavender-700"
                >
                  ← Volver a elegir actividad
                </button>
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
          {(paso === 'completar' || paso === 'omitir') && (
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setPaso('elegir')}
                disabled={saving}
                className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={paso === 'completar' ? handleCompletar : handleOmitir}
                disabled={saving}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                  paso === 'completar'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : paso === 'completar' ? (
                  'Completar'
                ) : (
                  'Confirmar Omisión'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
