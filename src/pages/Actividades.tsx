import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import { Actividad, TipoActividad, EstadoActividad, NivelEnergia, ParticipacionActividad, Usuario } from '../types';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

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

const plantillasActividad: { nombre: string; tipo: TipoActividad; duracion: number; descripcion: string }[] = [
  { nombre: 'Caminata matutina', tipo: 'fisica', duracion: 30, descripcion: 'Caminata ligera por el jardín o casa' },
  { nombre: 'Ejercicios de fisioterapia', tipo: 'terapeutica', duracion: 45, descripcion: 'Rutina de ejercicios indicados por el fisioterapeuta' },
  { nombre: 'Ejercicios intestinales', tipo: 'terapeutica', duracion: 15, descripcion: 'Movimientos para estimular el tránsito intestinal' },
  { nombre: 'Juegos de memoria', tipo: 'cognitiva', duracion: 30, descripcion: 'Crucigramas, sudoku, juegos de cartas' },
  { nombre: 'Lectura en voz alta', tipo: 'cognitiva', duracion: 20, descripcion: 'Leer periódico, libros o revistas' },
  { nombre: 'Manualidades', tipo: 'recreativa', duracion: 45, descripcion: 'Tejido, pintura, armado de puzzles' },
  { nombre: 'Ver fotos familiares', tipo: 'social', duracion: 30, descripcion: 'Revisar álbumes y recordar momentos' },
  { nombre: 'Videollamada familiar', tipo: 'social', duracion: 30, descripcion: 'Llamada con familiares' },
  { nombre: 'Paseo al parque', tipo: 'salida', duracion: 60, descripcion: 'Salida al parque cercano' }
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

  // Actividades del día
  function actividadesDelDia(fecha: Date): Actividad[] {
    return actividades.filter(a => a.fechaInicio && isSameDay(a.fechaInicio, fecha));
  }

  // Actividades de hoy
  function actividadesHoy(): Actividad[] {
    return actividadesDelDia(new Date());
  }

  // Usar plantilla
  function usarPlantilla(plantilla: typeof plantillasActividad[0]) {
    setFormActividad({
      ...formActividad,
      nombre: plantilla.nombre,
      tipo: plantilla.tipo,
      duracion: plantilla.duracion,
      descripcion: plantilla.descripcion
    });
  }

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
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🎯 Actividades</h1>
            <p className="text-gray-600">Programación y seguimiento de actividades del paciente</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setVista(vista === 'calendario' ? 'lista' : 'calendario')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Nueva Actividad
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

        {/* Estadísticas de la semana */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-500">Programadas</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.completadas}</div>
            <div className="text-sm text-gray-500">Completadas</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">
              {stats.total > 0 ? Math.round((stats.completadas / stats.total) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-500">Cumplimiento</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Por tipo:</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(stats.porTipo).map(([tipo, count]) => (
                <span key={tipo} className={`text-xs px-2 py-0.5 rounded ${coloresTipo[tipo as TipoActividad]}`}>
                  {tiposActividad.find(t => t.value === tipo)?.icon} {count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Navegación de semana */}
        <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-lg shadow">
          <button
            onClick={() => setSemanaActual(subWeeks(semanaActual, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            ← Anterior
          </button>
          <div className="text-center">
            <h2 className="font-semibold">
              {format(inicioSemana, "d 'de' MMMM", { locale: es })} - {format(finSemana, "d 'de' MMMM yyyy", { locale: es })}
            </h2>
            <button
              onClick={() => setSemanaActual(new Date())}
              className="text-sm text-blue-600 hover:underline"
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

        {vista === 'calendario' ? (
          /* Vista Calendario */
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="grid grid-cols-7 border-b">
              {diasSemana.map((dia, idx) => {
                const esHoy = isSameDay(dia, new Date());
                return (
                  <div
                    key={idx}
                    className={`p-3 text-center border-r last:border-r-0 ${esHoy ? 'bg-blue-50' : ''}`}
                  >
                    <div className="text-sm text-gray-500">{format(dia, 'EEE', { locale: es })}</div>
                    <div className={`text-lg font-semibold ${esHoy ? 'text-blue-600' : ''}`}>
                      {format(dia, 'd')}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-7 min-h-[400px]">
              {diasSemana.map((dia, idx) => {
                const actsDia = actividadesDelDia(dia);
                const esHoy = isSameDay(dia, new Date());

                return (
                  <div key={idx} className={`border-r last:border-r-0 p-2 ${esHoy ? 'bg-blue-50/30' : ''}`}>
                    {actsDia.map(act => (
                      <div
                        key={act.id}
                        onClick={() => abrirEditar(act)}
                        className={`mb-2 p-2 rounded border-l-4 cursor-pointer hover:shadow-md transition-shadow text-sm ${coloresTipo[act.tipo]}`}
                      >
                        <div className="flex items-center gap-1">
                          <span>{tiposActividad.find(t => t.value === act.tipo)?.icon}</span>
                          <span className="font-medium truncate">{act.nombre}</span>
                        </div>
                        <div className="text-xs opacity-75">
                          {act.fechaInicio && format(act.fechaInicio, 'HH:mm')} ({act.duracion}min)
                        </div>
                        <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded ${coloresEstado[act.estado]}`}>
                          {act.estado}
                        </span>
                      </div>
                    ))}

                    {(userProfile?.rol === 'familiar' || userProfile?.rol === 'supervisor') && (
                      <button
                        onClick={() => {
                          setFechaSeleccionada(dia);
                          setFormActividad({ ...formActividad, fechaInicio: format(dia, 'yyyy-MM-dd') });
                          setModalAbierto(true);
                        }}
                        className="w-full p-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded border border-dashed border-gray-300"
                      >
                        + Agregar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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

        {/* Modal Crear/Editar Actividad */}
        {modalAbierto && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
              <h2 className="text-xl font-bold mb-4">
                {modoEdicion ? '✏️ Editar Actividad' : '🎯 Nueva Actividad'}
              </h2>

              {/* Plantillas rápidas */}
              {!modoEdicion && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plantillas rápidas
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {plantillasActividad.slice(0, 5).map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => usarPlantilla(p)}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        {tiposActividad.find(t => t.value === p.tipo)?.icon} {p.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={formActividad.nombre}
                      onChange={(e) => setFormActividad({ ...formActividad, nombre: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Nombre de la actividad"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={formActividad.tipo}
                      onChange={(e) => setFormActividad({ ...formActividad, tipo: e.target.value as TipoActividad })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      {tiposActividad.map(t => (
                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                    <input
                      type="date"
                      value={formActividad.fechaInicio}
                      onChange={(e) => setFormActividad({ ...formActividad, fechaInicio: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                    <input
                      type="time"
                      value={formActividad.horaInicio}
                      onChange={(e) => setFormActividad({ ...formActividad, horaInicio: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración (min)</label>
                    <input
                      type="number"
                      value={formActividad.duracion}
                      onChange={(e) => setFormActividad({ ...formActividad, duracion: parseInt(e.target.value) || 30 })}
                      className="w-full border rounded-lg px-3 py-2"
                      min="5"
                      step="5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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

              <div className="flex justify-between mt-6">
                {modoEdicion && actividadSeleccionada && (
                  <button
                    onClick={() => {
                      eliminarActividad(actividadSeleccionada);
                      cerrarModal();
                    }}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    🗑️ Eliminar
                  </button>
                )}
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={cerrarModal}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarActividad}
                    disabled={!formActividad.nombre || !formActividad.fechaInicio}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {modoEdicion ? 'Guardar Cambios' : 'Crear Actividad'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Completar Actividad */}
        {modalCompletar && actividadSeleccionada && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">✓ Completar Actividad</h2>

              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <p className="font-medium">{actividadSeleccionada.nombre}</p>
                <p className="text-sm text-gray-600">
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
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="activa">😊 Activa - Participó con entusiasmo</option>
                    <option value="pasiva">😐 Pasiva - Participó con ayuda</option>
                    <option value="minima">😔 Mínima - Poca participación</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado de ánimo
                  </label>
                  <div className="flex gap-2">
                    {['😊 Alegre', '😐 Neutral', '😔 Triste', '😴 Cansada', '😤 Irritada'].map(animo => (
                      <button
                        key={animo}
                        type="button"
                        onClick={() => setFormCompletar({ ...formCompletar, estadoAnimo: animo })}
                        className={`px-3 py-2 rounded-lg text-sm ${
                          formCompletar.estadoAnimo === animo
                            ? 'bg-blue-100 border-blue-500 border-2'
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
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Observaciones sobre la actividad..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    const motivo = prompt('Motivo de cancelación:');
                    if (motivo) {
                      cancelarActividad(actividadSeleccionada, motivo);
                      setModalCompletar(false);
                      setActividadSeleccionada(null);
                    }
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Cancelar Actividad
                </button>
                <button
                  onClick={() => {
                    setModalCompletar(false);
                    setActividadSeleccionada(null);
                    setFormCompletar({ participacion: 'activa', estadoAnimo: '', notas: '' });
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cerrar
                </button>
                <button
                  onClick={completarActividad}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  ✓ Marcar Completada
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
