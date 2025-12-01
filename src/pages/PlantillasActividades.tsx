import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import {
  TipoActividadV2,
  TIPOS_ACTIVIDAD_CONFIG,
  PlantillaActividadV2,
} from '../types/actividades';
import type { NivelEnergia, TurnoActividad } from '../types';

const PACIENTE_ID = 'paciente-principal';

const NIVELES_ENERGIA: { value: NivelEnergia; label: string; icon: string }[] = [
  { value: 'bajo', label: 'Bajo', icon: '🔋' },
  { value: 'medio', label: 'Medio', icon: '⚡' },
  { value: 'alto', label: 'Alto', icon: '🔥' },
];

const TURNOS: { value: TurnoActividad; label: string; icon: string }[] = [
  { value: 'matutino', label: 'Matutino', icon: '🌅' },
  { value: 'vespertino', label: 'Vespertino', icon: '🌤️' },
  { value: 'nocturno', label: 'Nocturno', icon: '🌙' },
];

interface FormState {
  nombre: string;
  tipo: TipoActividadV2;
  descripcion: string;
  duracion: number;
  ubicacion: string;
  materialesNecesarios: string[];
  nivelEnergia: NivelEnergia;
  etiquetas: string[];
  turnos: TurnoActividad[];
  foto: string;
}

const initialFormState: FormState = {
  nombre: '',
  tipo: 'fisica',
  descripcion: '',
  duracion: 30,
  ubicacion: '',
  materialesNecesarios: [],
  nivelEnergia: 'medio',
  etiquetas: [],
  turnos: ['matutino', 'vespertino', 'nocturno'],
  foto: '',
};

export default function PlantillasActividades() {
  const { userProfile } = useAuth();

  // Estados principales
  const [plantillas, setPlantillas] = useState<PlantillaActividadV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<TipoActividadV2 | 'todas'>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [soloFavoritas, setSoloFavoritas] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [plantillaEditando, setPlantillaEditando] = useState<PlantillaActividadV2 | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inputs temporales
  const [nuevoMaterial, setNuevoMaterial] = useState('');
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Permisos
  const puedeEditar = userProfile?.rol === 'familiar' || userProfile?.rol === 'supervisor';

  // Cargar plantillas
  useEffect(() => {
    const plantillasRef = collection(db, 'pacientes', PACIENTE_ID, 'plantillasActividades');
    const q = query(plantillasRef, where('activo', '==', true));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        creadoEn: docSnap.data().creadoEn?.toDate() || new Date(),
        actualizadoEn: docSnap.data().actualizadoEn?.toDate() || new Date(),
      })) as PlantillaActividadV2[];
      // Ordenar por nombre en memoria
      data.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setPlantillas(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filtrar plantillas
  const plantillasFiltradas = plantillas.filter((p) => {
    // Filtro por tipo (mapear tipos legacy a V2)
    const tipoV2 = ['fisica', 'terapeutica', 'salida'].includes(p.tipo) ? 'fisica' : 'cognitiva';
    if (filtroTipo !== 'todas' && tipoV2 !== filtroTipo) return false;

    // Filtro por búsqueda
    if (busqueda) {
      const searchLower = busqueda.toLowerCase();
      if (
        !p.nombre.toLowerCase().includes(searchLower) &&
        !p.descripcion.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    // Filtro por favoritas
    if (soloFavoritas && !p.favorita) return false;

    return true;
  });

  // Abrir modal para crear
  const handleNueva = () => {
    setPlantillaEditando(null);
    setForm(initialFormState);
    setError(null);
    setModalOpen(true);
  };

  // Abrir modal para editar
  const handleEditar = (plantilla: PlantillaActividadV2) => {
    setPlantillaEditando(plantilla);
    const tipoV2: TipoActividadV2 = ['fisica', 'terapeutica', 'salida'].includes(plantilla.tipo as string)
      ? 'fisica'
      : 'cognitiva';
    setForm({
      nombre: plantilla.nombre,
      tipo: tipoV2,
      descripcion: plantilla.descripcion,
      duracion: plantilla.duracion,
      ubicacion: plantilla.ubicacion || '',
      materialesNecesarios: plantilla.materialesNecesarios || [],
      nivelEnergia: plantilla.nivelEnergia,
      etiquetas: plantilla.etiquetas || [],
      turnos: plantilla.turnos || ['matutino', 'vespertino', 'nocturno'],
      foto: plantilla.foto || '',
    });
    setError(null);
    setModalOpen(true);
  };

  // Duplicar plantilla
  const handleDuplicar = async (plantilla: PlantillaActividadV2) => {
    try {
      const plantillasRef = collection(db, 'pacientes', PACIENTE_ID, 'plantillasActividades');
      await addDoc(plantillasRef, {
        ...plantilla,
        id: undefined,
        nombre: `${plantilla.nombre} (copia)`,
        favorita: false,
        creadoEn: Timestamp.now(),
        actualizadoEn: Timestamp.now(),
      });
    } catch (err) {
      console.error('Error duplicando plantilla:', err);
    }
  };

  // Eliminar plantilla (soft delete)
  const handleEliminar = async (plantilla: PlantillaActividadV2) => {
    if (!confirm(`¿Eliminar la plantilla "${plantilla.nombre}"?`)) return;

    try {
      const docRef = doc(db, 'pacientes', PACIENTE_ID, 'plantillasActividades', plantilla.id);
      await updateDoc(docRef, {
        activo: false,
        actualizadoEn: Timestamp.now(),
      });
    } catch (err) {
      console.error('Error eliminando plantilla:', err);
    }
  };

  // Toggle favorita
  const handleToggleFavorita = async (plantilla: PlantillaActividadV2) => {
    try {
      const docRef = doc(db, 'pacientes', PACIENTE_ID, 'plantillasActividades', plantilla.id);
      await updateDoc(docRef, {
        favorita: !plantilla.favorita,
        actualizadoEn: Timestamp.now(),
      });
    } catch (err) {
      console.error('Error actualizando favorita:', err);
    }
  };

  // Guardar plantilla
  const handleGuardar = async () => {
    if (!form.nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }
    if (!form.descripcion.trim()) {
      setError('La descripción es requerida');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const datos = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        descripcion: form.descripcion.trim(),
        duracion: form.duracion,
        ubicacion: form.ubicacion.trim() || null,
        materialesNecesarios: form.materialesNecesarios,
        nivelEnergia: form.nivelEnergia,
        etiquetas: form.etiquetas,
        turnos: form.turnos,
        foto: form.foto || null,
        activo: true,
        actualizadoEn: Timestamp.now(),
      };

      if (plantillaEditando) {
        // Actualizar
        const docRef = doc(db, 'pacientes', PACIENTE_ID, 'plantillasActividades', plantillaEditando.id);
        await updateDoc(docRef, datos);
      } else {
        // Crear nueva
        const plantillasRef = collection(db, 'pacientes', PACIENTE_ID, 'plantillasActividades');
        await addDoc(plantillasRef, {
          ...datos,
          pacienteId: PACIENTE_ID,
          favorita: false,
          creadoEn: Timestamp.now(),
        });
      }

      setModalOpen(false);
    } catch (err) {
      console.error('Error guardando plantilla:', err);
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // Subir foto
  const handleSubirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubiendoFoto(true);
    try {
      const storageRef = ref(storage, `plantillas/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm((prev) => ({ ...prev, foto: url }));
    } catch (err) {
      console.error('Error subiendo foto:', err);
      setError('Error al subir la imagen');
    } finally {
      setSubiendoFoto(false);
    }
  };

  // Agregar material
  const handleAgregarMaterial = () => {
    if (nuevoMaterial.trim()) {
      setForm((prev) => ({
        ...prev,
        materialesNecesarios: [...prev.materialesNecesarios, nuevoMaterial.trim()],
      }));
      setNuevoMaterial('');
    }
  };

  // Agregar etiqueta
  const handleAgregarEtiqueta = () => {
    if (nuevaEtiqueta.trim()) {
      setForm((prev) => ({
        ...prev,
        etiquetas: [...prev.etiquetas, nuevaEtiqueta.trim().toLowerCase()],
      }));
      setNuevaEtiqueta('');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Plantillas de Actividades
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Plantillas reutilizables para programar actividades rápidamente
            </p>
          </div>

          {puedeEditar && (
            <button
              onClick={handleNueva}
              className="px-4 py-2 bg-lavender-600 text-white rounded-lg font-medium hover:bg-lavender-700 transition-colors flex items-center gap-2"
            >
              <span>+</span>
              <span>Nueva Plantilla</span>
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Búsqueda */}
            <div className="flex-1">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o descripción..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
              />
            </div>

            {/* Filtro por tipo */}
            <div className="flex gap-2">
              <button
                onClick={() => setFiltroTipo('todas')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filtroTipo === 'todas'
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFiltroTipo('fisica')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filtroTipo === 'fisica'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                🏃 Física
              </button>
              <button
                onClick={() => setFiltroTipo('cognitiva')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filtroTipo === 'cognitiva'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                🧠 Cognitiva
              </button>
            </div>

            {/* Solo favoritas */}
            <button
              onClick={() => setSoloFavoritas(!soloFavoritas)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                soloFavoritas
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ⭐ Favoritas
            </button>
          </div>
        </div>

        {/* Grid de plantillas */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lavender-600"></div>
          </div>
        ) : plantillasFiltradas.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-lg font-medium text-gray-800 mb-1">
              {plantillas.length === 0 ? 'Sin plantillas' : 'Sin resultados'}
            </h3>
            <p className="text-gray-500 text-sm">
              {plantillas.length === 0
                ? 'Crea tu primera plantilla para empezar'
                : 'Prueba con otros filtros'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plantillasFiltradas.map((plantilla) => {
              const tipoV2: TipoActividadV2 = ['fisica', 'terapeutica', 'salida'].includes(
                plantilla.tipo as string
              )
                ? 'fisica'
                : 'cognitiva';
              const tipoConfig = TIPOS_ACTIVIDAD_CONFIG[tipoV2];

              return (
                <div
                  key={plantilla.id}
                  className={`bg-white rounded-xl shadow overflow-hidden border-l-4 ${
                    tipoV2 === 'fisica' ? 'border-green-500' : 'border-purple-500'
                  }`}
                >
                  {/* Imagen */}
                  {plantilla.foto && (
                    <div className="h-32 overflow-hidden">
                      <img
                        src={plantilla.foto}
                        alt={plantilla.nombre}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{tipoConfig.icon}</span>
                        <h3 className="font-semibold text-gray-800">{plantilla.nombre}</h3>
                      </div>
                      <button
                        onClick={() => handleToggleFavorita(plantilla)}
                        className="text-xl hover:scale-110 transition-transform"
                      >
                        {plantilla.favorita ? '⭐' : '☆'}
                      </button>
                    </div>

                    {/* Descripción */}
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {plantilla.descripcion}
                    </p>

                    {/* Info */}
                    <div className="flex flex-wrap gap-2 text-xs mb-3">
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        ⏱️ {plantilla.duracion} min
                      </span>
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {NIVELES_ENERGIA.find((n) => n.value === plantilla.nivelEnergia)?.icon}{' '}
                        {NIVELES_ENERGIA.find((n) => n.value === plantilla.nivelEnergia)?.label}
                      </span>
                      {plantilla.ubicacion && (
                        <span className="bg-gray-100 px-2 py-1 rounded">
                          📍 {plantilla.ubicacion}
                        </span>
                      )}
                    </div>

                    {/* Turnos */}
                    {plantilla.turnos && plantilla.turnos.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {plantilla.turnos.map((turno) => {
                          const info = TURNOS.find((t) => t.value === turno);
                          return (
                            <span
                              key={turno}
                              className="text-xs bg-lavender-100 text-lavender-700 px-2 py-0.5 rounded"
                            >
                              {info?.icon} {info?.label}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Acciones */}
                    {puedeEditar && (
                      <div className="flex gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleEditar(plantilla)}
                          className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleDuplicar(plantilla)}
                          className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                          title="Duplicar"
                        >
                          📄
                        </button>
                        <button
                          onClick={() => handleEliminar(plantilla)}
                          className="p-2 bg-gray-100 rounded-lg hover:bg-red-100 text-red-600"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setModalOpen(false)} />

          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
              {/* Handle móvil */}
              <div className="sm:hidden flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800">
                    {plantillaEditando ? 'Editar Plantilla' : 'Nueva Plantilla'}
                  </h2>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Tipo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                  <div className="flex gap-2">
                    {(['fisica', 'cognitiva'] as TipoActividadV2[]).map((tipo) => {
                      const config = TIPOS_ACTIVIDAD_CONFIG[tipo];
                      return (
                        <button
                          key={tipo}
                          onClick={() => setForm((prev) => ({ ...prev, tipo }))}
                          className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                            form.tipo === tipo
                              ? tipo === 'fisica'
                                ? 'bg-green-600 text-white'
                                : 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {config.icon} {config.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                    placeholder="Ej: Caminata por el jardín"
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                  <textarea
                    value={form.descripcion}
                    onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent resize-none"
                    placeholder="Instrucciones o detalles de la actividad..."
                  />
                </div>

                {/* Duración y Energía */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración (min)</label>
                    <input
                      type="number"
                      value={form.duracion}
                      onChange={(e) => setForm((prev) => ({ ...prev, duracion: parseInt(e.target.value) || 30 }))}
                      min={5}
                      max={180}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de Energía</label>
                    <select
                      value={form.nivelEnergia}
                      onChange={(e) => setForm((prev) => ({ ...prev, nivelEnergia: e.target.value as NivelEnergia }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                    >
                      {NIVELES_ENERGIA.map((n) => (
                        <option key={n.value} value={n.value}>
                          {n.icon} {n.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Ubicación */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                  <input
                    type="text"
                    value={form.ubicacion}
                    onChange={(e) => setForm((prev) => ({ ...prev, ubicacion: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                    placeholder="Ej: Jardín, Sala, Terraza..."
                  />
                </div>

                {/* Turnos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Turnos</label>
                  <div className="flex gap-2">
                    {TURNOS.map((turno) => (
                      <button
                        key={turno.value}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            turnos: prev.turnos.includes(turno.value)
                              ? prev.turnos.filter((t) => t !== turno.value)
                              : [...prev.turnos, turno.value],
                          }));
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          form.turnos.includes(turno.value)
                            ? 'bg-lavender-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {turno.icon} {turno.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Materiales */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Materiales</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={nuevoMaterial}
                      onChange={(e) => setNuevoMaterial(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAgregarMaterial())}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                      placeholder="Agregar material..."
                    />
                    <button
                      onClick={handleAgregarMaterial}
                      className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      +
                    </button>
                  </div>
                  {form.materialesNecesarios.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.materialesNecesarios.map((m, i) => (
                        <span key={i} className="bg-gray-100 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                          {m}
                          <button
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                materialesNecesarios: prev.materialesNecesarios.filter((_, idx) => idx !== i),
                              }))
                            }
                            className="text-gray-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Etiquetas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={nuevaEtiqueta}
                      onChange={(e) => setNuevaEtiqueta(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAgregarEtiqueta())}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lavender-500 focus:border-transparent"
                      placeholder="Agregar etiqueta..."
                    />
                    <button
                      onClick={handleAgregarEtiqueta}
                      className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      +
                    </button>
                  </div>
                  {form.etiquetas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.etiquetas.map((e, i) => (
                        <span key={i} className="bg-lavender-100 text-lavender-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                          #{e}
                          <button
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                etiquetas: prev.etiquetas.filter((_, idx) => idx !== i),
                              }))
                            }
                            className="text-lavender-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Foto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Foto</label>
                  {form.foto ? (
                    <div className="relative">
                      <img src={form.foto} alt="Preview" className="w-full h-32 object-cover rounded-xl" />
                      <button
                        onClick={() => setForm((prev) => ({ ...prev, foto: '' }))}
                        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-red-50"
                      >
                        🗑️
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-lavender-400 hover:bg-lavender-50 transition-colors">
                      <input type="file" accept="image/*" onChange={handleSubirFoto} className="hidden" />
                      {subiendoFoto ? (
                        <span className="text-gray-500">Subiendo...</span>
                      ) : (
                        <span className="text-gray-500">📷 Subir imagen</span>
                      )}
                    </label>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardar}
                  disabled={saving}
                  className="flex-1 py-3 px-4 bg-lavender-600 text-white rounded-xl font-medium hover:bg-lavender-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
