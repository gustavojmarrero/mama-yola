import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import { CalendarioActividades } from '../components/actividades';
import { Actividad, TipoActividad, EstadoActividad, NivelEnergia, ParticipacionActividad, Usuario, PlantillaActividad } from '../types';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

const PACIENTE_ID = 'paciente-principal';

const tiposActividad: { value: TipoActividad; label: string; icon: string }[] = [
  { value: 'fisica', label: 'Física', icon: '🏃' },
  { value: 'terapeutica', label: 'Terapéutica', icon: '🏥' },
  { value: 'cognitiva', label: 'Cognitiva', icon: '🧠' },
  { value: 'recreativa', label: 'Recreativa', icon: '🎨' },
  { value: 'social', label: 'Social', icon: '👥' },
  { value: 'salida', label: 'Salida', icon: '🚶' }
];

const coloresTipo: Record<TipoActividad, string> = {
  fisica: 'bg-green-100 border-green-400 text-green-800',
  terapeutica: 'bg-blue-100 border-blue-400 text-blue-800',
  cognitiva: 'bg-purple-100 border-purple-400 text-purple-800',
  recreativa: 'bg-yellow-100 border-yellow-400 text-yellow-800',
  social: 'bg-pink-100 border-pink-400 text-pink-800',
  salida: 'bg-orange-100 border-orange-400 text-orange-800'
};

const coloresEstado: Record<EstadoActividad, string> = {
  programada: 'bg-gray-200 text-gray-700',
  en_progreso: 'bg-blue-200 text-blue-700',
  completada: 'bg-green-200 text-green-700',
  cancelada: 'bg-red-200 text-red-700'
};

// Plantillas iniciales para migración automática
const plantillasIniciales = [
  { nombre: 'Caminata matutina', tipo: 'fisica' as TipoActividad, duracion: 30, descripcion: 'Caminata ligera por el jardín o casa', nivelEnergia: 'medio' as NivelEnergia, materialesNecesarios: ['Zapatos cómodos'], ubicacion: 'Jardín o interior', etiquetas: ['ejercicio', 'mañana'] },
  { nombre: 'Ejercicios de fisioterapia', tipo: 'terapeutica' as TipoActividad, duracion: 45, descripcion: 'Rutina de ejercicios indicados por el fisioterapeuta', nivelEnergia: 'medio' as NivelEnergia, materialesNecesarios: ['Colchoneta', 'Banda elástica'], ubicacion: 'Sala', etiquetas: ['fisioterapia', 'ejercicio'] },
  { nombre: 'Ejercicios intestinales', tipo: 'terapeutica' as TipoActividad, duracion: 15, descripcion: 'Movimientos para estimular el tránsito intestinal', nivelEnergia: 'bajo' as NivelEnergia, materialesNecesarios: [], ubicacion: 'Habitación', etiquetas: ['salud digestiva'] },
  { nombre: 'Juegos de memoria', tipo: 'cognitiva' as TipoActividad, duracion: 30, descripcion: 'Crucigramas, sudoku, juegos de cartas', nivelEnergia: 'bajo' as NivelEnergia, materialesNecesarios: ['Crucigramas', 'Sudoku', 'Cartas'], ubicacion: 'Mesa del comedor', etiquetas: ['cognitivo', 'entretenimiento'] },
  { nombre: 'Lectura en voz alta', tipo: 'cognitiva' as TipoActividad, duracion: 20, descripcion: 'Leer periódico, libros o revistas', nivelEnergia: 'bajo' as NivelEnergia, materialesNecesarios: ['Libro o periódico', 'Lentes de lectura'], ubicacion: 'Sala', etiquetas: ['cognitivo', 'lectura'] },
  { nombre: 'Manualidades', tipo: 'recreativa' as TipoActividad, duracion: 45, descripcion: 'Tejido, pintura, armado de puzzles', nivelEnergia: 'bajo' as NivelEnergia, materialesNecesarios: ['Material de manualidades'], ubicacion: 'Mesa de trabajo', etiquetas: ['creatividad', 'entretenimiento'] },
  { nombre: 'Ver fotos familiares', tipo: 'social' as TipoActividad, duracion: 30, descripcion: 'Revisar álbumes y recordar momentos', nivelEnergia: 'bajo' as NivelEnergia, materialesNecesarios: ['Álbum de fotos'], ubicacion: 'Sala', etiquetas: ['familia', 'memoria'] },
  { nombre: 'Videollamada familiar', tipo: 'social' as TipoActividad, duracion: 30, descripcion: 'Llamada con familiares', nivelEnergia: 'bajo' as NivelEnergia, materialesNecesarios: ['Tablet o teléfono'], ubicacion: 'Sala', etiquetas: ['familia', 'comunicación'] },
  { nombre: 'Paseo al parque', tipo: 'salida' as TipoActividad, duracion: 60, descripcion: 'Salida al parque cercano', nivelEnergia: 'alto' as NivelEnergia, materialesNecesarios: ['Silla de ruedas', 'Gorra', 'Agua'], ubicacion: 'Parque', etiquetas: ['salida', 'aire libre'] }
];

export default function Actividades() {
  const { userProfile } = useAuth();
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [semanaActual, setSemanaActual] = useState(new Date());
  const [vista, setVista] = useState<'calendario' | 'lista'>('calendario');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalCompletar, setModalCompletar] = useState(false);
  const [actividadSeleccionada, setActividadSeleccionada] = useState<Actividad | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);

  const [formActividad, setFormActividad] = useState({
    nombre: '',
    tipo: 'recreativa' as TipoActividad,
    fechaInicio: '',
    horaInicio: '10:00',
    duracion: 30,
    ubicacion: '',
    descripcion: '',
    materialesNecesarios: [] as string[],
    responsable: '',
    nivelEnergia: 'medio' as NivelEnergia,
    frecuencia: { tipo: 'unica' as 'unica' | 'diaria' | 'semanal', diasSemana: [] as number[] }
  });

  const [formCompletar, setFormCompletar] = useState({
    participacion: 'activa' as ParticipacionActividad,
    estadoAnimo: '',
    notas: ''
  });

  const [nuevoMaterial, setNuevoMaterial] = useState('');

  // Estados para plantillas configurables
  const [plantillas, setPlantillas] = useState<PlantillaActividad[]>([]);
  const [modalPlantillas, setModalPlantillas] = useState(false);
  const [modalPlantillaCRUD, setModalPlantillaCRUD] = useState(false);
  const [plantillaEditando, setPlantillaEditando] = useState<PlantillaActividad | null>(null);
  const [busquedaPlantilla, setBusquedaPlantilla] = useState('');
  const [filtroTipoPlantilla, setFiltroTipoPlantilla] = useState<TipoActividad | 'todas'>('todas');
  const [mostrarSoloFavoritas, setMostrarSoloFavoritas] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [nuevoMaterialPlantilla, setNuevoMaterialPlantilla] = useState('');
  const [nuevaEtiquetaPlantilla, setNuevaEtiquetaPlantilla] = useState('');

  const [formPlantilla, setFormPlantilla] = useState({
    nombre: '',
    tipo: 'recreativa' as TipoActividad,
    descripcion: '',
    duracion: 30,
    ubicacion: '',
    materialesNecesarios: [] as string[],
    nivelEnergia: 'medio' as NivelEnergia,
    responsableDefault: '',
    etiquetas: [] as string[],
    favorita: false,
    foto: ''
  });

  // Hook para detectar cambios sin guardar
  const { isDirty, setIsDirty, markAsSaved, confirmNavigation } = useUnsavedChanges();
  const isInitialLoadActividad = useRef(true);
  const isInitialLoadPlantilla = useRef(true);

  // Detectar cambios en el formulario de actividad
  useEffect(() => {
    if (modalAbierto && !isInitialLoadActividad.current) {
      setIsDirty(true);
    }
  }, [formActividad, modalAbierto]);

  // Detectar cambios en el formulario de plantilla
  useEffect(() => {
    if (modalPlantillaCRUD && !isInitialLoadPlantilla.current) {
      setIsDirty(true);
    }
  }, [formPlantilla, modalPlantillaCRUD]);

  // Resetear flags cuando se abren/cierran modales
  useEffect(() => {
    if (modalAbierto) {
      setTimeout(() => { isInitialLoadActividad.current = false; }, 100);
    } else {
      isInitialLoadActividad.current = true;
      if (!modalPlantillaCRUD) setIsDirty(false);
    }
  }, [modalAbierto]);

  useEffect(() => {
    if (modalPlantillaCRUD) {
      setTimeout(() => { isInitialLoadPlantilla.current = false; }, 100);
    } else {
      isInitialLoadPlantilla.current = true;
      if (!modalAbierto) setIsDirty(false);
    }
  }, [modalPlantillaCRUD]);

  // Obtener inicio y fin de semana
  const inicioSemana = startOfWeek(semanaActual, { weekStartsOn: 1 });
  const finSemana = endOfWeek(semanaActual, { weekStartsOn: 1 });
  const diasSemana = eachDayOfInterval({ start: inicioSemana, end: finSemana });

  // Cargar actividades
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'actividades'),
      orderBy('fechaInicio', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const actividadesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fechaInicio: doc.data().fechaInicio?.toDate(),
        fechaFin: doc.data().fechaFin?.toDate(),
        horaInicioReal: doc.data().horaInicioReal?.toDate(),
        horaFinReal: doc.data().horaFinReal?.toDate(),
        creadoEn: doc.data().creadoEn?.toDate(),
        actualizadoEn: doc.data().actualizadoEn?.toDate()
      })) as Actividad[];
      setActividades(actividadesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cargar usuarios
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'usuarios'),
      where('activo', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usuariosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Usuario[];
      setUsuarios(usuariosData);
    });

    return () => unsubscribe();
  }, []);

  // Cargar plantillas de actividades
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'plantillasActividades'),
      orderBy('nombre', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const plantillasData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          creadoEn: doc.data().creadoEn?.toDate(),
          actualizadoEn: doc.data().actualizadoEn?.toDate()
        }))
        .filter(p => p.activo !== false) as PlantillaActividad[];

      // Si no hay plantillas, migrar las iniciales
      if (plantillasData.length === 0 && snapshot.docs.length === 0) {
        await migrarPlantillasIniciales();
      } else {
        setPlantillas(plantillasData);
      }
    });

    return () => unsubscribe();
  }, []);

  // Migrar plantillas iniciales a Firestore
  async function migrarPlantillasIniciales() {
    try {
      for (const plantilla of plantillasIniciales) {
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'plantillasActividades'), {
          pacienteId: PACIENTE_ID,
          nombre: plantilla.nombre,
          tipo: plantilla.tipo,
          descripcion: plantilla.descripcion,
          duracion: plantilla.duracion,
          ubicacion: plantilla.ubicacion,
          materialesNecesarios: plantilla.materialesNecesarios,
          nivelEnergia: plantilla.nivelEnergia,
          etiquetas: plantilla.etiquetas,
          favorita: false,
          activo: true,
          creadoEn: Timestamp.now(),
          actualizadoEn: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('Error migrando plantillas:', error);
    }
  }

  // Actividades del día
  function actividadesDelDia(fecha: Date): Actividad[] {
    return actividades.filter(a => a.fechaInicio && isSameDay(a.fechaInicio, fecha));
  }

  // Actividades de hoy
  function actividadesHoy(): Actividad[] {
    return actividadesDelDia(new Date());
  }

  // Usar plantilla
  function usarPlantilla(plantilla: PlantillaActividad) {
    setFormActividad({
      ...formActividad,
      nombre: plantilla.nombre,
      tipo: plantilla.tipo,
      duracion: plantilla.duracion,
      descripcion: plantilla.descripcion,
      ubicacion: plantilla.ubicacion || '',
      materialesNecesarios: plantilla.materialesNecesarios || [],
      nivelEnergia: plantilla.nivelEnergia,
      responsable: plantilla.responsableDefault || ''
    });
    setModalPlantillas(false);
  }

  // ========== FUNCIONES CRUD DE PLANTILLAS ==========

  function abrirModalPlantilla(plantilla?: PlantillaActividad) {
    if (plantilla) {
      setPlantillaEditando(plantilla);
      setFormPlantilla({
        nombre: plantilla.nombre,
        tipo: plantilla.tipo,
        descripcion: plantilla.descripcion,
        duracion: plantilla.duracion,
        ubicacion: plantilla.ubicacion || '',
        materialesNecesarios: plantilla.materialesNecesarios || [],
        nivelEnergia: plantilla.nivelEnergia,
        responsableDefault: plantilla.responsableDefault || '',
        etiquetas: plantilla.etiquetas || [],
        favorita: plantilla.favorita,
        foto: plantilla.foto || ''
      });
    } else {
      setPlantillaEditando(null);
      setFormPlantilla({
        nombre: '',
        tipo: 'recreativa',
        descripcion: '',
        duracion: 30,
        ubicacion: '',
        materialesNecesarios: [],
        nivelEnergia: 'medio',
        responsableDefault: '',
        etiquetas: [],
        favorita: false,
        foto: ''
      });
    }
    setModalPlantillaCRUD(true);
  }

  function cerrarModalPlantilla() {
    setModalPlantillaCRUD(false);
    setPlantillaEditando(null);
    setNuevoMaterialPlantilla('');
    setNuevaEtiquetaPlantilla('');
  }

  async function guardarPlantilla() {
    if (!formPlantilla.nombre.trim()) {
      alert('El nombre de la plantilla es obligatorio');
      return;
    }

    try {
      const plantillaData: Record<string, unknown> = {
        pacienteId: PACIENTE_ID,
        nombre: formPlantilla.nombre.trim(),
        tipo: formPlantilla.tipo,
        descripcion: formPlantilla.descripcion,
        duracion: formPlantilla.duracion,
        materialesNecesarios: formPlantilla.materialesNecesarios,
        nivelEnergia: formPlantilla.nivelEnergia,
        etiquetas: formPlantilla.etiquetas,
        favorita: formPlantilla.favorita,
        activo: true,
        actualizadoEn: Timestamp.now()
      };

      // Solo incluir campos opcionales si tienen valor
      if (formPlantilla.ubicacion) {
        plantillaData.ubicacion = formPlantilla.ubicacion;
      }
      if (formPlantilla.responsableDefault) {
        plantillaData.responsableDefault = formPlantilla.responsableDefault;
      }
      if (formPlantilla.foto) {
        plantillaData.foto = formPlantilla.foto;
      }

      if (plantillaEditando) {
        await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'plantillasActividades', plantillaEditando.id), plantillaData);
      } else {
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'plantillasActividades'), {
          ...plantillaData,
          creadoEn: Timestamp.now()
        });
      }

      markAsSaved();
      cerrarModalPlantilla();
    } catch (error) {
      console.error('Error al guardar plantilla:', error);
      alert('Error al guardar la plantilla');
    }
  }

  async function eliminarPlantilla(plantilla: PlantillaActividad) {
    if (!confirm(`¿Eliminar la plantilla "${plantilla.nombre}"?`)) return;

    try {
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'plantillasActividades', plantilla.id), {
        activo: false,
        actualizadoEn: Timestamp.now()
      });
    } catch (error) {
      console.error('Error al eliminar plantilla:', error);
      alert('Error al eliminar la plantilla');
    }
  }

  async function duplicarPlantilla(plantilla: PlantillaActividad) {
    try {
      const nuevaPlantilla: Record<string, unknown> = {
        pacienteId: PACIENTE_ID,
        nombre: `${plantilla.nombre} (copia)`,
        tipo: plantilla.tipo,
        favorita: false,
        activo: true,
        creadoEn: Timestamp.now(),
        actualizadoEn: Timestamp.now()
      };

      // Solo agregar campos opcionales si tienen valor
      if (plantilla.descripcion) nuevaPlantilla.descripcion = plantilla.descripcion;
      if (plantilla.duracion) nuevaPlantilla.duracion = plantilla.duracion;
      if (plantilla.ubicacion) nuevaPlantilla.ubicacion = plantilla.ubicacion;
      if (plantilla.materialesNecesarios && plantilla.materialesNecesarios.length > 0) {
        nuevaPlantilla.materialesNecesarios = plantilla.materialesNecesarios;
      }
      if (plantilla.nivelEnergia) nuevaPlantilla.nivelEnergia = plantilla.nivelEnergia;
      if (plantilla.responsableDefault) nuevaPlantilla.responsableDefault = plantilla.responsableDefault;
      if (plantilla.etiquetas && plantilla.etiquetas.length > 0) {
        nuevaPlantilla.etiquetas = plantilla.etiquetas;
      }
      if (plantilla.foto) nuevaPlantilla.foto = plantilla.foto;

      await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'plantillasActividades'), nuevaPlantilla);
    } catch (error) {
      console.error('Error al duplicar plantilla:', error);
      alert('Error al duplicar la plantilla');
    }
  }

  async function toggleFavoritaPlantilla(plantilla: PlantillaActividad) {
    try {
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'plantillasActividades', plantilla.id), {
        favorita: !plantilla.favorita,
        actualizadoEn: Timestamp.now()
      });
    } catch (error) {
      console.error('Error al cambiar favorita:', error);
    }
  }

  async function handleFotoPlantillaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFoto(true);
      const storageRef = ref(storage, `plantillasActividades/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFormPlantilla({ ...formPlantilla, foto: url });
    } catch (error) {
      console.error('Error al subir foto:', error);
      alert('Error al subir la foto');
    } finally {
      setUploadingFoto(false);
    }
  }

  // Filtrado de plantillas
  const plantillasFiltradas = plantillas
    .filter(p => filtroTipoPlantilla === 'todas' || p.tipo === filtroTipoPlantilla)
    .filter(p => !mostrarSoloFavoritas || p.favorita)
    .filter(p => !busquedaPlantilla ||
      p.nombre.toLowerCase().includes(busquedaPlantilla.toLowerCase()) ||
      p.descripcion.toLowerCase().includes(busquedaPlantilla.toLowerCase()) ||
      p.materialesNecesarios?.some(m => m.toLowerCase().includes(busquedaPlantilla.toLowerCase()))
    );

  const todasEtiquetas = [...new Set(plantillas.flatMap(p => p.etiquetas || []))];

  // Crear/Editar actividad
  async function guardarActividad() {
    if (!formActividad.nombre || !formActividad.fechaInicio) return;

    const fechaInicio = new Date(`${formActividad.fechaInicio}T${formActividad.horaInicio}`);
    const fechaFin = new Date(fechaInicio.getTime() + formActividad.duracion * 60000);

    const datosActividad = {
      pacienteId: PACIENTE_ID,
      nombre: formActividad.nombre,
      tipo: formActividad.tipo,
      fechaInicio: Timestamp.fromDate(fechaInicio),
      fechaFin: Timestamp.fromDate(fechaFin),
      duracion: formActividad.duracion,
      ubicacion: formActividad.ubicacion || null,
      descripcion: formActividad.descripcion || null,
      materialesNecesarios: formActividad.materialesNecesarios.length > 0 ? formActividad.materialesNecesarios : null,
      responsable: formActividad.responsable || null,
      estado: 'programada' as EstadoActividad,
      nivelEnergia: formActividad.nivelEnergia,
      frecuencia: formActividad.frecuencia.tipo !== 'unica' ? formActividad.frecuencia : null,
      actualizadoEn: Timestamp.now()
    };

    if (modoEdicion && actividadSeleccionada) {
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'actividades', actividadSeleccionada.id), datosActividad);
    } else {
      await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'actividades'), {
        ...datosActividad,
        creadoEn: Timestamp.now()
      });
    }

    markAsSaved();
    cerrarModal();
  }

  // Iniciar actividad
  async function iniciarActividad(actividad: Actividad) {
    await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'actividades', actividad.id), {
      estado: 'en_progreso',
      horaInicioReal: Timestamp.now(),
      actualizadoEn: Timestamp.now()
    });
  }

  // Completar actividad
  async function completarActividad() {
    if (!actividadSeleccionada) return;

    await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'actividades', actividadSeleccionada.id), {
      estado: 'completada',
      horaFinReal: Timestamp.now(),
      completadaPor: userProfile?.id,
      participacion: formCompletar.participacion,
      estadoAnimo: formCompletar.estadoAnimo || null,
      notas: formCompletar.notas || null,
      actualizadoEn: Timestamp.now()
    });

    setModalCompletar(false);
    setActividadSeleccionada(null);
    setFormCompletar({ participacion: 'activa', estadoAnimo: '', notas: '' });
  }

  // Cancelar actividad
  async function cancelarActividad(actividad: Actividad, motivo: string) {
    await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'actividades', actividad.id), {
      estado: 'cancelada',
      motivoCancelacion: motivo,
      actualizadoEn: Timestamp.now()
    });
  }

  // Eliminar actividad
  async function eliminarActividad(actividad: Actividad) {
    if (!confirm('¿Eliminar esta actividad?')) return;
    await deleteDoc(doc(db, 'pacientes', PACIENTE_ID, 'actividades', actividad.id));
  }

  // Agregar material
  function agregarMaterial() {
    if (!nuevoMaterial.trim()) return;
    setFormActividad({
      ...formActividad,
      materialesNecesarios: [...formActividad.materialesNecesarios, nuevoMaterial.trim()]
    });
    setNuevoMaterial('');
  }

  function cerrarModal() {
    setModalAbierto(false);
    setModoEdicion(false);
    setActividadSeleccionada(null);
    setFechaSeleccionada(null);
    setFormActividad({
      nombre: '',
      tipo: 'recreativa',
      fechaInicio: '',
      horaInicio: '10:00',
      duracion: 30,
      ubicacion: '',
      descripcion: '',
      materialesNecesarios: [],
      responsable: '',
      nivelEnergia: 'medio',
      frecuencia: { tipo: 'unica', diasSemana: [] }
    });
  }

  function abrirEditar(actividad: Actividad) {
    setActividadSeleccionada(actividad);
    setModoEdicion(true);
    setFormActividad({
      nombre: actividad.nombre,
      tipo: actividad.tipo,
      fechaInicio: actividad.fechaInicio ? format(actividad.fechaInicio, 'yyyy-MM-dd') : '',
      horaInicio: actividad.fechaInicio ? format(actividad.fechaInicio, 'HH:mm') : '10:00',
      duracion: actividad.duracion,
      ubicacion: actividad.ubicacion || '',
      descripcion: actividad.descripcion || '',
      materialesNecesarios: actividad.materialesNecesarios || [],
      responsable: actividad.responsable || '',
      nivelEnergia: actividad.nivelEnergia,
      frecuencia: actividad.frecuencia || { tipo: 'unica', diasSemana: [] }
    });
    setModalAbierto(true);
  }

  // Estadísticas de la semana
  function estadisticasSemana() {
    const actividadesSemana = actividades.filter(a =>
      a.fechaInicio && a.fechaInicio >= inicioSemana && a.fechaInicio <= finSemana
    );

    const completadas = actividadesSemana.filter(a => a.estado === 'completada').length;
    const total = actividadesSemana.length;
    const porTipo: Record<string, number> = {};

    actividadesSemana.forEach(a => {
      porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1;
    });

    return { completadas, total, porTipo };
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex justify-center items-center h-64">
          <div className="text-gray-500">Cargando actividades...</div>
        </div>
      </Layout>
    );
  }

  const stats = estadisticasSemana();

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header - Responsive */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Actividades</h1>
            <p className="text-sm text-gray-600 hidden sm:block">Programación y seguimiento de actividades</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setVista(vista === 'calendario' ? 'lista' : 'calendario')}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 min-h-[44px]
                         bg-warm-100 text-warm-700 rounded-lg
                         hover:bg-warm-200 active:scale-[0.98]
                         transition-all touch-feedback text-sm sm:text-base"
            >
              {vista === 'calendario' ? '📋 Lista' : '📅 Calendario'}
            </button>
            {(userProfile?.rol === 'familiar' || userProfile?.rol === 'supervisor') && (
              <button
                onClick={() => {
                  setFechaSeleccionada(new Date());
                  setFormActividad({ ...formActividad, fechaInicio: format(new Date(), 'yyyy-MM-dd') });
                  setModalAbierto(true);
                }}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 min-h-[44px]
                           bg-lavender-600 text-white rounded-lg
                           hover:bg-lavender-700 active:scale-[0.98]
                           transition-all touch-feedback text-sm sm:text-base
                           shadow-btn-primary hover:shadow-btn-primary-hover"
              >
                + Nueva
              </button>
            )}
          </div>
        </div>

        {/* Resumen de actividades de hoy */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">📌 Actividades de Hoy</h3>
          <div className="flex flex-wrap gap-3">
            {actividadesHoy().length === 0 ? (
              <p className="text-gray-500">No hay actividades programadas para hoy</p>
            ) : (
              actividadesHoy().map(act => (
                <div
                  key={act.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-l-4 ${coloresTipo[act.tipo]}`}
                >
                  <span>{tiposActividad.find(t => t.value === act.tipo)?.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{act.nombre}</p>
                    <p className="text-xs opacity-75">
                      {act.fechaInicio && format(act.fechaInicio, 'HH:mm')} - {act.duracion}min
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${coloresEstado[act.estado]}`}>
                    {act.estado === 'en_progreso' ? '▶ En curso' : act.estado}
                  </span>
                  {act.estado === 'programada' && (
                    <button
                      onClick={() => iniciarActividad(act)}
                      className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                    >
                      Iniciar
                    </button>
                  )}
                  {act.estado === 'en_progreso' && (
                    <button
                      onClick={() => {
                        setActividadSeleccionada(act);
                        setModalCompletar(true);
                      }}
                      className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                    >
                      Completar
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Estadísticas de la semana - Responsive con scroll horizontal en móvil */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4
                        sm:mx-0 sm:px-0 sm:overflow-visible
                        sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 mb-4 sm:mb-6
                        scrollbar-hide">
          <div className="flex-shrink-0 w-[130px] sm:w-auto bg-white rounded-lg shadow p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs sm:text-sm text-gray-500">Programadas</div>
          </div>
          <div className="flex-shrink-0 w-[130px] sm:w-auto bg-white rounded-lg shadow p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-green-600">{stats.completadas}</div>
            <div className="text-xs sm:text-sm text-gray-500">Completadas</div>
          </div>
          <div className="flex-shrink-0 w-[130px] sm:w-auto bg-white rounded-lg shadow p-3 sm:p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-purple-600">
              {stats.total > 0 ? Math.round((stats.completadas / stats.total) * 100) : 0}%
            </div>
            <div className="text-xs sm:text-sm text-gray-500">Cumplimiento</div>
          </div>
          <div className="flex-shrink-0 w-[130px] sm:w-auto bg-white rounded-lg shadow p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">Por tipo:</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(stats.porTipo).map(([tipo, count]) => (
                <span key={tipo} className={`text-xs px-2 py-0.5 rounded ${coloresTipo[tipo as TipoActividad]}`}>
                  {tiposActividad.find(t => t.value === tipo)?.icon} {count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Navegación de semana - Solo visible en vista lista */}
        {vista === 'lista' && (
          <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-lg shadow">
            <button
              onClick={() => setSemanaActual(subWeeks(semanaActual, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              ← Anterior
            </button>
            <div className="text-center">
              <h2 className="font-semibold text-sm sm:text-base">
                <span className="sm:hidden">
                  {format(inicioSemana, "d", { locale: es })}-{format(finSemana, "d MMM", { locale: es })}
                </span>
                <span className="hidden sm:inline">
                  {format(inicioSemana, "d 'de' MMMM", { locale: es })} - {format(finSemana, "d 'de' MMMM yyyy", { locale: es })}
                </span>
              </h2>
              <button
                onClick={() => setSemanaActual(new Date())}
                className="text-sm text-lavender-600 hover:underline"
              >
                Ir a hoy
              </button>
            </div>
            <button
              onClick={() => setSemanaActual(addWeeks(semanaActual, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              Siguiente →
            </button>
          </div>
        )}

        {vista === 'calendario' ? (
          /* Vista Calendario - Componente Adaptativo */
          <CalendarioActividades
            actividades={actividades}
            onActividadClick={abrirEditar}
            onAgregarClick={(fecha) => {
              setFechaSeleccionada(fecha);
              setFormActividad({ ...formActividad, fechaInicio: format(fecha, 'yyyy-MM-dd') });
              setModalAbierto(true);
            }}
            puedeAgregar={userProfile?.rol === 'familiar' || userProfile?.rol === 'supervisor'}
            coloresTipo={coloresTipo}
            coloresEstado={coloresEstado}
            tiposActividad={tiposActividad}
          />
        ) : (
          /* Vista Lista */
          <div className="bg-white rounded-lg shadow">
            <div className="divide-y">
              {diasSemana.map((dia, idx) => {
                const actsDia = actividadesDelDia(dia);
                const esHoy = isSameDay(dia, new Date());

                return (
                  <div key={idx} className={`p-4 ${esHoy ? 'bg-blue-50' : ''}`}>
                    <h3 className={`font-semibold mb-2 ${esHoy ? 'text-blue-600' : ''}`}>
                      {format(dia, "EEEE d 'de' MMMM", { locale: es })}
                      {esHoy && <span className="ml-2 text-sm bg-blue-600 text-white px-2 py-0.5 rounded">Hoy</span>}
                    </h3>
                    {actsDia.length === 0 ? (
                      <p className="text-gray-400 text-sm">Sin actividades programadas</p>
                    ) : (
                      <div className="space-y-2">
                        {actsDia.map(act => (
                          <div
                            key={act.id}
                            className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${coloresTipo[act.tipo]}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{tiposActividad.find(t => t.value === act.tipo)?.icon}</span>
                              <div>
                                <p className="font-medium">{act.nombre}</p>
                                <p className="text-sm opacity-75">
                                  {act.fechaInicio && format(act.fechaInicio, 'HH:mm')} - {act.duracion}min
                                  {act.ubicacion && ` • ${act.ubicacion}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs rounded ${coloresEstado[act.estado]}`}>
                                {act.estado}
                              </span>
                              {act.estado === 'programada' && (
                                <button
                                  onClick={() => iniciarActividad(act)}
                                  className="text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                                >
                                  ▶ Iniciar
                                </button>
                              )}
                              {act.estado === 'en_progreso' && (
                                <button
                                  onClick={() => {
                                    setActividadSeleccionada(act);
                                    setModalCompletar(true);
                                  }}
                                  className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                >
                                  ✓ Completar
                                </button>
                              )}
                              <button
                                onClick={() => abrirEditar(act)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                ✏️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Leyenda */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {tiposActividad.map(tipo => (
            <div key={tipo.value} className="flex items-center gap-2">
              <span>{tipo.icon}</span>
              <span>{tipo.label}</span>
            </div>
          ))}
        </div>

        {/* Modal Crear/Editar Actividad - Bottom Sheet en móvil */}
        {modalAbierto && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
            <div className="bg-white w-full sm:max-w-2xl sm:mx-4
                            rounded-t-2xl sm:rounded-lg
                            max-h-[92vh] sm:max-h-[85vh]
                            overflow-hidden flex flex-col
                            animate-slide-up-modal sm:animate-scale-in">

              {/* Handle de drag - solo mobile */}
              <div className="sm:hidden flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
              </div>

              {/* Header sticky */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0">
                <h2 className="text-lg sm:text-xl font-bold text-warm-800">
                  {modoEdicion ? 'Editar Actividad' : 'Nueva Actividad'}
                </h2>
              </div>

              {/* Contenido scrolleable */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">

              {/* Botón para ver plantillas */}
              {!modoEdicion && (
                <div className="mb-4">
                  <button
                    onClick={() => setModalPlantillas(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    📋 Usar Plantilla de Actividad
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {/* Nombre y Tipo - Stack en mobile, grid en desktop */}
                <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={formActividad.nombre}
                      onChange={(e) => setFormActividad({ ...formActividad, nombre: e.target.value })}
                      className="w-full border rounded-lg px-3 py-3 sm:py-2 text-base"
                      placeholder="Nombre de la actividad"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={formActividad.tipo}
                      onChange={(e) => setFormActividad({ ...formActividad, tipo: e.target.value as TipoActividad })}
                      className="w-full border rounded-lg px-3 py-3 sm:py-2 text-base"
                    >
                      {tiposActividad.map(t => (
                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fecha, Hora, Duración - Stack en mobile, grid en desktop */}
                <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                    <input
                      type="date"
                      value={formActividad.fechaInicio}
                      onChange={(e) => setFormActividad({ ...formActividad, fechaInicio: e.target.value })}
                      className="w-full border rounded-lg px-3 py-3 sm:py-2 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                    <input
                      type="time"
                      value={formActividad.horaInicio}
                      onChange={(e) => setFormActividad({ ...formActividad, horaInicio: e.target.value })}
                      className="w-full border rounded-lg px-3 py-3 sm:py-2 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración (min)</label>
                    <input
                      type="number"
                      value={formActividad.duracion}
                      onChange={(e) => setFormActividad({ ...formActividad, duracion: parseInt(e.target.value) || 30 })}
                      className="w-full border rounded-lg px-3 py-3 sm:py-2 text-base"
                      min="5"
                      step="5"
                    />
                  </div>
                </div>

                {/* Ubicación y Responsable - Stack en mobile, grid en desktop */}
                <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                    <input
                      type="text"
                      value={formActividad.ubicacion}
                      onChange={(e) => setFormActividad({ ...formActividad, ubicacion: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Dónde se realizará"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de energía</label>
                    <select
                      value={formActividad.nivelEnergia}
                      onChange={(e) => setFormActividad({ ...formActividad, nivelEnergia: e.target.value as NivelEnergia })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="bajo">🔋 Bajo</option>
                      <option value="medio">🔋🔋 Medio</option>
                      <option value="alto">🔋🔋🔋 Alto</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                  <select
                    value={formActividad.responsable}
                    onChange={(e) => setFormActividad({ ...formActividad, responsable: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Sin asignar</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    value={formActividad.descripcion}
                    onChange={(e) => setFormActividad({ ...formActividad, descripcion: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Detalles de la actividad..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Materiales necesarios</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={nuevoMaterial}
                      onChange={(e) => setNuevoMaterial(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder="Agregar material..."
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarMaterial())}
                    />
                    <button
                      type="button"
                      onClick={agregarMaterial}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formActividad.materialesNecesarios.map((mat, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1">
                        {mat}
                        <button
                          onClick={() => setFormActividad({
                            ...formActividad,
                            materialesNecesarios: formActividad.materialesNecesarios.filter((_, i) => i !== idx)
                          })}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              </div>
              {/* Fin contenido scrolleable */}

              {/* Footer sticky con safe-area */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-white flex-shrink-0 safe-bottom-modal">
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    {modoEdicion && actividadSeleccionada && (
                      <button
                        onClick={() => {
                          eliminarActividad(actividadSeleccionada);
                          cerrarModal();
                        }}
                        className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg min-h-[44px] touch-feedback"
                      >
                        Eliminar
                      </button>
                    )}
                    {/* Indicador de cambios sin guardar */}
                    {isDirty && !modoEdicion && (
                      <span className="text-sm text-orange-600 flex items-center gap-1">
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                        Sin guardar
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={() => confirmNavigation(cerrarModal)}
                      className="flex-1 sm:flex-none px-4 py-3 sm:py-2 min-h-[44px]
                                 text-gray-600 hover:bg-gray-100 rounded-lg touch-feedback"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={guardarActividad}
                      disabled={!formActividad.nombre || !formActividad.fechaInicio}
                      className="flex-1 sm:flex-none px-4 py-3 sm:py-2 min-h-[44px]
                                 bg-lavender-600 text-white rounded-lg
                                 hover:bg-lavender-700 disabled:opacity-50
                                 touch-feedback shadow-btn-primary"
                    >
                      {modoEdicion ? 'Guardar' : 'Crear'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Completar Actividad - Bottom Sheet en móvil */}
        {modalCompletar && actividadSeleccionada && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
            <div className="bg-white w-full sm:max-w-md sm:mx-4
                            rounded-t-2xl sm:rounded-lg
                            max-h-[92vh] sm:max-h-[85vh]
                            overflow-hidden flex flex-col
                            animate-slide-up-modal sm:animate-scale-in">

              {/* Handle de drag - solo mobile */}
              <div className="sm:hidden flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
              </div>

              {/* Header sticky */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0">
                <h2 className="text-lg sm:text-xl font-bold text-warm-800">Completar Actividad</h2>
              </div>

              {/* Contenido scrolleable */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                <div className="bg-lavender-50 p-3 rounded-lg mb-4">
                  <p className="font-medium text-warm-800">{actividadSeleccionada.nombre}</p>
                  <p className="text-sm text-warm-600">
                    {actividadSeleccionada.fechaInicio && format(actividadSeleccionada.fechaInicio, "HH:mm")} - {actividadSeleccionada.duracion}min
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nivel de participación
                    </label>
                    <select
                      value={formCompletar.participacion}
                      onChange={(e) => setFormCompletar({ ...formCompletar, participacion: e.target.value as ParticipacionActividad })}
                      className="w-full border rounded-lg px-3 py-3 sm:py-2 text-base"
                    >
                      <option value="activa">Activa - Participó con entusiasmo</option>
                      <option value="pasiva">Pasiva - Participó con ayuda</option>
                      <option value="minima">Mínima - Poca participación</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estado de ánimo
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                      {['Alegre', 'Neutral', 'Triste', 'Cansada', 'Irritada'].map(animo => (
                        <button
                          key={animo}
                          type="button"
                          onClick={() => setFormCompletar({ ...formCompletar, estadoAnimo: animo })}
                          className={`flex-shrink-0 px-4 py-2.5 min-h-[44px] rounded-lg text-sm
                                      active:scale-95 transition-transform touch-feedback ${
                            formCompletar.estadoAnimo === animo
                              ? 'bg-lavender-100 border-lavender-500 border-2 text-lavender-700'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {animo}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notas adicionales
                    </label>
                    <textarea
                      value={formCompletar.notas}
                      onChange={(e) => setFormCompletar({ ...formCompletar, notas: e.target.value })}
                      className="w-full border rounded-lg px-3 py-3 sm:py-2 text-base"
                      rows={2}
                      placeholder="Observaciones sobre la actividad..."
                    />
                  </div>
                </div>
              </div>

              {/* Footer sticky con safe-area */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-white flex-shrink-0 safe-bottom-modal">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                  <button
                    onClick={() => {
                      const motivo = prompt('Motivo de cancelación:');
                      if (motivo) {
                        cancelarActividad(actividadSeleccionada, motivo);
                        setModalCompletar(false);
                        setActividadSeleccionada(null);
                      }
                    }}
                    className="px-4 py-3 sm:py-2 min-h-[44px] text-red-600 hover:bg-red-50 rounded-lg touch-feedback"
                  >
                    Cancelar Actividad
                  </button>
                  <button
                    onClick={() => {
                      setModalCompletar(false);
                      setActividadSeleccionada(null);
                      setFormCompletar({ participacion: 'activa', estadoAnimo: '', notas: '' });
                    }}
                    className="px-4 py-3 sm:py-2 min-h-[44px] text-gray-600 hover:bg-gray-100 rounded-lg touch-feedback"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={completarActividad}
                    className="px-4 py-3 sm:py-2 min-h-[44px] bg-green-600 text-white rounded-lg
                               hover:bg-green-700 touch-feedback shadow-sm"
                  >
                    Marcar Completada
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Selección de Plantillas - Bottom Sheet en móvil */}
        {modalPlantillas && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
            <div className="bg-white w-full sm:max-w-4xl sm:mx-4
                            rounded-t-2xl sm:rounded-lg
                            max-h-[95vh] sm:max-h-[90vh]
                            overflow-hidden flex flex-col
                            animate-slide-up-modal sm:animate-scale-in">

              {/* Handle de drag - solo mobile */}
              <div className="sm:hidden flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
              </div>

              {/* Header sticky */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg sm:text-xl font-bold text-warm-800">Plantillas</h2>
                  <button
                    onClick={() => setModalPlantillas(false)}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center
                               text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    <span className="text-2xl">×</span>
                  </button>
                </div>
              </div>

              {/* Filtros - Responsive */}
              <div className="px-4 sm:px-6 py-3 border-b flex-shrink-0">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <input
                    type="text"
                    value={busquedaPlantilla}
                    onChange={(e) => setBusquedaPlantilla(e.target.value)}
                    placeholder="Buscar plantillas..."
                    className="w-full sm:flex-1 sm:min-w-[200px] border rounded-lg px-3 py-3 sm:py-2 text-base"
                  />
                  <div className="flex gap-2">
                    <select
                      value={filtroTipoPlantilla}
                      onChange={(e) => setFiltroTipoPlantilla(e.target.value as TipoActividad | 'todas')}
                      className="flex-1 sm:flex-none border rounded-lg px-3 py-3 sm:py-2 text-base"
                    >
                      <option value="todas">Todos</option>
                      {tiposActividad.map(t => (
                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setMostrarSoloFavoritas(!mostrarSoloFavoritas)}
                      className={`p-3 sm:px-4 sm:py-2 min-h-[44px] rounded-lg touch-feedback ${
                        mostrarSoloFavoritas ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <span className="sm:hidden">⭐</span>
                      <span className="hidden sm:inline">⭐ Favoritas</span>
                    </button>
                    <button
                      onClick={() => abrirModalPlantilla()}
                      className="p-3 sm:px-4 sm:py-2 min-h-[44px] bg-lavender-600 text-white rounded-lg
                                 hover:bg-lavender-700 touch-feedback"
                    >
                      <span className="sm:hidden">+</span>
                      <span className="hidden sm:inline">+ Nueva</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid de plantillas */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                {plantillasFiltradas.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-4xl mb-2">📋</p>
                    <p>No se encontraron plantillas</p>
                    {plantillas.length === 0 && (
                      <p className="text-sm mt-2">Crea tu primera plantilla para comenzar</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {plantillasFiltradas.map(plantilla => (
                      <div
                        key={plantilla.id}
                        className={`border rounded-lg overflow-hidden hover:shadow-lg transition-shadow ${coloresTipo[plantilla.tipo]}`}
                      >
                        {/* Foto de la plantilla */}
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
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{tiposActividad.find(t => t.value === plantilla.tipo)?.icon}</span>
                              <h3 className="font-semibold">{plantilla.nombre}</h3>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavoritaPlantilla(plantilla);
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
                            <div className="flex flex-wrap gap-1 mb-3">
                              {plantilla.etiquetas.map((etiqueta, idx) => (
                                <span key={idx} className="text-xs bg-white/30 px-2 py-0.5 rounded">
                                  #{etiqueta}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Acciones */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => usarPlantilla(plantilla)}
                              className="flex-1 py-2 bg-white/80 rounded-lg text-sm font-medium hover:bg-white transition-colors"
                            >
                              ✓ Usar
                            </button>
                            <button
                              onClick={() => abrirModalPlantilla(plantilla)}
                              className="p-2 bg-white/50 rounded-lg hover:bg-white/80"
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => duplicarPlantilla(plantilla)}
                              className="p-2 bg-white/50 rounded-lg hover:bg-white/80"
                              title="Duplicar"
                            >
                              📄
                            </button>
                            <button
                              onClick={() => eliminarPlantilla(plantilla)}
                              className="p-2 bg-white/50 rounded-lg hover:bg-red-100 text-red-600"
                              title="Eliminar"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer sticky con safe-area */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-white flex-shrink-0 safe-bottom-modal">
                <div className="flex justify-between items-center">
                  <p className="text-xs sm:text-sm text-gray-500">
                    {plantillasFiltradas.length} de {plantillas.length}
                  </p>
                  <button
                    onClick={() => setModalPlantillas(false)}
                    className="px-4 py-3 sm:py-2 min-h-[44px] text-gray-600 hover:bg-gray-100 rounded-lg touch-feedback"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal CRUD de Plantilla - Bottom Sheet en móvil */}
        {modalPlantillaCRUD && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60]">
            <div className="bg-white w-full sm:max-w-2xl sm:mx-4
                            rounded-t-2xl sm:rounded-lg
                            max-h-[95vh] sm:max-h-[90vh]
                            overflow-hidden flex flex-col
                            animate-slide-up-modal sm:animate-scale-in">

              {/* Handle de drag - solo mobile */}
              <div className="sm:hidden flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
              </div>

              {/* Header sticky */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0">
                <h2 className="text-lg sm:text-xl font-bold text-warm-800">
                  {plantillaEditando ? 'Editar Plantilla' : 'Nueva Plantilla'}
                </h2>
              </div>

              {/* Contenido scrolleable */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              <div className="space-y-4">
                {/* Info básica - responsive */}
                <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={formPlantilla.nombre}
                      onChange={(e) => setFormPlantilla({ ...formPlantilla, nombre: e.target.value })}
                      className="w-full border rounded-lg px-3 py-3 sm:py-2 text-base"
                      placeholder="Nombre de la plantilla"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                    <select
                      value={formPlantilla.tipo}
                      onChange={(e) => setFormPlantilla({ ...formPlantilla, tipo: e.target.value as TipoActividad })}
                      className="w-full border rounded-lg px-3 py-3 sm:py-2 text-base"
                    >
                      {tiposActividad.map(t => (
                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Duración, Ubicación, Energía - responsive */}
                <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración (min) *</label>
                    <input
                      type="number"
                      value={formPlantilla.duracion}
                      onChange={(e) => setFormPlantilla({ ...formPlantilla, duracion: parseInt(e.target.value) || 30 })}
                      className="w-full border rounded-lg px-3 py-2"
                      min="5"
                      step="5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de energía</label>
                    <select
                      value={formPlantilla.nivelEnergia}
                      onChange={(e) => setFormPlantilla({ ...formPlantilla, nivelEnergia: e.target.value as NivelEnergia })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="bajo">🔋 Bajo</option>
                      <option value="medio">🔋🔋 Medio</option>
                      <option value="alto">🔋🔋🔋 Alto</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                    <input
                      type="text"
                      value={formPlantilla.ubicacion}
                      onChange={(e) => setFormPlantilla({ ...formPlantilla, ubicacion: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Dónde se realiza"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    value={formPlantilla.descripcion}
                    onChange={(e) => setFormPlantilla({ ...formPlantilla, descripcion: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Descripción de la actividad..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable por defecto</label>
                  <select
                    value={formPlantilla.responsableDefault}
                    onChange={(e) => setFormPlantilla({ ...formPlantilla, responsableDefault: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Sin asignar</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
                    ))}
                  </select>
                </div>

                {/* Materiales */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Materiales necesarios</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={nuevoMaterialPlantilla}
                      onChange={(e) => setNuevoMaterialPlantilla(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder="Agregar material..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && nuevoMaterialPlantilla.trim()) {
                          e.preventDefault();
                          setFormPlantilla({
                            ...formPlantilla,
                            materialesNecesarios: [...formPlantilla.materialesNecesarios, nuevoMaterialPlantilla.trim()]
                          });
                          setNuevoMaterialPlantilla('');
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (nuevoMaterialPlantilla.trim()) {
                          setFormPlantilla({
                            ...formPlantilla,
                            materialesNecesarios: [...formPlantilla.materialesNecesarios, nuevoMaterialPlantilla.trim()]
                          });
                          setNuevoMaterialPlantilla('');
                        }
                      }}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formPlantilla.materialesNecesarios.map((mat, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1">
                        {mat}
                        <button
                          onClick={() => setFormPlantilla({
                            ...formPlantilla,
                            materialesNecesarios: formPlantilla.materialesNecesarios.filter((_, i) => i !== idx)
                          })}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Etiquetas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={nuevaEtiquetaPlantilla}
                      onChange={(e) => setNuevaEtiquetaPlantilla(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder="Agregar etiqueta..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && nuevaEtiquetaPlantilla.trim()) {
                          e.preventDefault();
                          setFormPlantilla({
                            ...formPlantilla,
                            etiquetas: [...formPlantilla.etiquetas, nuevaEtiquetaPlantilla.trim()]
                          });
                          setNuevaEtiquetaPlantilla('');
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (nuevaEtiquetaPlantilla.trim()) {
                          setFormPlantilla({
                            ...formPlantilla,
                            etiquetas: [...formPlantilla.etiquetas, nuevaEtiquetaPlantilla.trim()]
                          });
                          setNuevaEtiquetaPlantilla('');
                        }
                      }}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                  {/* Sugerencias de etiquetas existentes */}
                  {todasEtiquetas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      <span className="text-xs text-gray-500">Sugerencias:</span>
                      {todasEtiquetas.filter(e => !formPlantilla.etiquetas.includes(e)).slice(0, 5).map(etiqueta => (
                        <button
                          key={etiqueta}
                          type="button"
                          onClick={() => setFormPlantilla({
                            ...formPlantilla,
                            etiquetas: [...formPlantilla.etiquetas, etiqueta]
                          })}
                          className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                        >
                          +{etiqueta}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {formPlantilla.etiquetas.map((etiqueta, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm flex items-center gap-1">
                        #{etiqueta}
                        <button
                          onClick={() => setFormPlantilla({
                            ...formPlantilla,
                            etiquetas: formPlantilla.etiquetas.filter((_, i) => i !== idx)
                          })}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Foto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Foto de referencia</label>
                  <div className="flex items-center gap-4">
                    {formPlantilla.foto ? (
                      <div className="relative">
                        <img
                          src={formPlantilla.foto}
                          alt="Foto plantilla"
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => setFormPlantilla({ ...formPlantilla, foto: '' })}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-sm hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                        📷
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFotoPlantillaUpload}
                        className="hidden"
                        id="foto-plantilla"
                        disabled={uploadingFoto}
                      />
                      <label
                        htmlFor="foto-plantilla"
                        className={`inline-block px-4 py-2 rounded-lg cursor-pointer ${
                          uploadingFoto ? 'bg-gray-300' : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        {uploadingFoto ? 'Subiendo...' : 'Subir foto'}
                      </label>
                    </div>
                  </div>
                </div>

                {/* Favorita */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="favorita"
                    checked={formPlantilla.favorita}
                    onChange={(e) => setFormPlantilla({ ...formPlantilla, favorita: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="favorita" className="text-sm text-gray-700">
                    ⭐ Marcar como favorita
                  </label>
                </div>
              </div>
              </div>
              {/* Fin contenido scrolleable */}

              {/* Footer */}
              <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-t bg-white flex-shrink-0 safe-bottom-modal">
                {/* Indicador de cambios sin guardar */}
                {isDirty && (
                  <span className="text-sm text-orange-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                    Sin guardar
                  </span>
                )}
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={() => confirmNavigation(cerrarModalPlantilla)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarPlantilla}
                    disabled={!formPlantilla.nombre.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {plantillaEditando ? 'Guardar Cambios' : 'Crear Plantilla'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
