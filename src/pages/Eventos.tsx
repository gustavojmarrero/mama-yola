import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import Layout from '../components/common/Layout';
import { Evento, TipoEvento, EstadoEvento, Contacto } from '../types';
import { useAuth } from '../context/AuthContext';

const PACIENTE_ID = 'paciente-principal';

const locales = {
  es: es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const tiposEvento: { value: TipoEvento; label: string; color: string }[] = [
  { value: 'cita_medica', label: 'Cita Médica', color: '#3b82f6' },
  { value: 'estudio', label: 'Estudio', color: '#8b5cf6' },
  { value: 'terapia', label: 'Terapia', color: '#10b981' },
  { value: 'visita', label: 'Visita', color: '#f59e0b' },
  { value: 'evento_social', label: 'Evento Social', color: '#ec4899' },
  { value: 'tramite', label: 'Trámite', color: '#6b7280' },
  { value: 'otro', label: 'Otro', color: '#14b8a6' },
];

const estadosEvento: { value: EstadoEvento; label: string }[] = [
  { value: 'programada', label: 'Programada' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'en_curso', label: 'En Curso' },
  { value: 'completada', label: 'Completada' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'reprogramada', label: 'Reprogramada' },
];

export default function Eventos() {
  const { currentUser } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [editando, setEditando] = useState<Evento | null>(null);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<Evento | null>(null);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());

  const [formData, setFormData] = useState({
    titulo: '',
    tipo: 'cita_medica' as TipoEvento,
    subtipo: '',
    fechaInicio: '',
    horaInicio: '',
    fechaFin: '',
    horaFin: '',
    ubicacion: '',
    coordenadas: { lat: 0, lng: 0 },
    contactoId: '',
    descripcion: '',
    motivoConsulta: '',
    preparacion: [] as Array<{ item: string; completado: boolean }>,
    recordatorios: [] as string[],
    transporte: '',
    acompanante: '',
    estado: 'programada' as EstadoEvento,
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      await Promise.all([cargarEventos(), cargarContactos()]);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  }

  async function cargarEventos() {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'eventos'),
        orderBy('fechaInicio', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const eventosData: Evento[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        eventosData.push({
          id: doc.id,
          ...data,
          fechaInicio: data.fechaInicio?.toDate() || new Date(),
          fechaFin: data.fechaFin?.toDate() || new Date(),
          confirmadoEn: data.confirmadoEn?.toDate(),
          horaLlegada: data.horaLlegada?.toDate(),
          horaSalida: data.horaSalida?.toDate(),
          proximaCita: data.proximaCita?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Evento);
      });

      setEventos(eventosData);
    } catch (error) {
      console.error('Error al cargar eventos:', error);
    }
  }

  async function cargarContactos() {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'contactos'),
        where('activo', '==', true)
      );
      const querySnapshot = await getDocs(q);
      const contactosData: Contacto[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        contactosData.push({
          id: doc.id,
          ...data,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Contacto);
      });

      setContactos(contactosData);
    } catch (error) {
      console.error('Error al cargar contactos:', error);
    }
  }

  function abrirModal(evento?: Evento, slotInfo?: { start: Date; end: Date }) {
    if (evento) {
      const contacto = contactos.find((c) => c.id === evento.contactoId);
      setEditando(evento);
      setFormData({
        titulo: evento.titulo,
        tipo: evento.tipo,
        subtipo: evento.subtipo || '',
        fechaInicio: format(evento.fechaInicio, 'yyyy-MM-dd'),
        horaInicio: format(evento.fechaInicio, 'HH:mm'),
        fechaFin: format(evento.fechaFin, 'yyyy-MM-dd'),
        horaFin: format(evento.fechaFin, 'HH:mm'),
        ubicacion: evento.ubicacion || '',
        coordenadas: evento.coordenadas || { lat: 0, lng: 0 },
        contactoId: evento.contactoId || '',
        descripcion: evento.descripcion || '',
        motivoConsulta: evento.motivoConsulta || '',
        preparacion: evento.preparacion || [],
        recordatorios: evento.recordatorios || [],
        transporte: evento.transporte || '',
        acompanante: evento.acompanante || '',
        estado: evento.estado,
      });
    } else {
      setEditando(null);
      const inicio = slotInfo?.start || new Date();
      const fin = slotInfo?.end || new Date(inicio.getTime() + 60 * 60 * 1000);
      setFormData({
        titulo: '',
        tipo: 'cita_medica',
        subtipo: '',
        fechaInicio: format(inicio, 'yyyy-MM-dd'),
        horaInicio: format(inicio, 'HH:mm'),
        fechaFin: format(fin, 'yyyy-MM-dd'),
        horaFin: format(fin, 'HH:mm'),
        ubicacion: '',
        coordenadas: { lat: 0, lng: 0 },
        contactoId: '',
        descripcion: '',
        motivoConsulta: '',
        preparacion: [],
        recordatorios: [],
        transporte: '',
        acompanante: '',
        estado: 'programada',
      });
    }
    setShowModal(true);
  }

  function cerrarModal() {
    setShowModal(false);
    setEditando(null);
  }

  function abrirDetalleModal(evento: Evento) {
    setEventoSeleccionado(evento);
    setShowDetalleModal(true);
  }

  function cerrarDetalleModal() {
    setShowDetalleModal(false);
    setEventoSeleccionado(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.titulo || !formData.fechaInicio || !formData.horaInicio) {
      alert('Por favor completa los campos obligatorios');
      return;
    }

    try {
      const fechaInicio = new Date(`${formData.fechaInicio}T${formData.horaInicio}`);
      const fechaFin = new Date(
        `${formData.fechaFin || formData.fechaInicio}T${formData.horaFin || formData.horaInicio}`
      );

      const ahora = Timestamp.now();
      const contacto = contactos.find((c) => c.id === formData.contactoId);

      const eventoData = {
        pacienteId: PACIENTE_ID,
        titulo: formData.titulo,
        tipo: formData.tipo,
        subtipo: formData.subtipo || undefined,
        fechaInicio: Timestamp.fromDate(fechaInicio),
        fechaFin: Timestamp.fromDate(fechaFin),
        ubicacion: formData.ubicacion || undefined,
        coordenadas:
          formData.coordenadas.lat !== 0 || formData.coordenadas.lng !== 0
            ? formData.coordenadas
            : undefined,
        contactoId: formData.contactoId || undefined,
        contactoNombre: contacto?.nombre || undefined,
        descripcion: formData.descripcion || undefined,
        motivoConsulta: formData.motivoConsulta || undefined,
        preparacion: formData.preparacion.length > 0 ? formData.preparacion : undefined,
        recordatorios: formData.recordatorios.length > 0 ? formData.recordatorios : [],
        transporte: formData.transporte || undefined,
        acompanante: formData.acompanante || undefined,
        estado: formData.estado,
        creadoPor: currentUser?.uid || '',
        actualizadoEn: ahora,
      };

      if (editando) {
        await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'eventos', editando.id), eventoData);
        alert('Evento actualizado correctamente');
      } else {
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'eventos'), {
          ...eventoData,
          creadoEn: ahora,
        });
        alert('Evento creado correctamente');
      }

      cerrarModal();
      cargarEventos();
    } catch (error) {
      console.error('Error al guardar evento:', error);
      alert('Error al guardar el evento');
    }
  }

  async function cancelarEvento(evento: Evento) {
    const motivo = prompt('Motivo de cancelación:');
    if (!motivo) return;

    try {
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'eventos', evento.id), {
        estado: 'cancelada',
        motivoCancelacion: motivo,
        actualizadoEn: Timestamp.now(),
      });
      alert('Evento cancelado');
      cargarEventos();
      cerrarDetalleModal();
    } catch (error) {
      console.error('Error al cancelar evento:', error);
      alert('Error al cancelar el evento');
    }
  }

  function agregarItemPreparacion() {
    const item = prompt('Nuevo item de preparación:');
    if (item) {
      setFormData({
        ...formData,
        preparacion: [...formData.preparacion, { item, completado: false }],
      });
    }
  }

  function eliminarItemPreparacion(index: number) {
    setFormData({
      ...formData,
      preparacion: formData.preparacion.filter((_, i) => i !== index),
    });
  }

  function toggleCompletadoPreparacion(index: number) {
    const nuevaPreparacion = [...formData.preparacion];
    nuevaPreparacion[index].completado = !nuevaPreparacion[index].completado;
    setFormData({ ...formData, preparacion: nuevaPreparacion });
  }

  function agregarRecordatorio(tipo: string) {
    if (!formData.recordatorios.includes(tipo)) {
      setFormData({
        ...formData,
        recordatorios: [...formData.recordatorios, tipo],
      });
    }
  }

  function eliminarRecordatorio(tipo: string) {
    setFormData({
      ...formData,
      recordatorios: formData.recordatorios.filter((r) => r !== tipo),
    });
  }

  function handleSelectContacto(contactoId: string) {
    const contacto = contactos.find((c) => c.id === contactoId);
    if (contacto) {
      setFormData({
        ...formData,
        contactoId,
        ubicacion: contacto.direccion || formData.ubicacion,
        coordenadas: contacto.coordenadas || formData.coordenadas,
      });
    } else {
      setFormData({ ...formData, contactoId });
    }
  }

  // Convertir eventos para el calendario
  const eventosCalendario = eventos.map((evento) => {
    const tipoInfo = tiposEvento.find((t) => t.value === evento.tipo);
    return {
      id: evento.id,
      title: evento.titulo,
      start: evento.fechaInicio,
      end: evento.fechaFin,
      resource: evento,
      style: {
        backgroundColor: evento.estado === 'cancelada' ? '#9ca3af' : tipoInfo?.color || '#3b82f6',
      },
    };
  });

  const getTipoInfo = (tipo: TipoEvento) => {
    return tiposEvento.find((t) => t.value === tipo);
  };

  const getEstadoInfo = (estado: EstadoEvento) => {
    return estadosEvento.find((e) => e.value === estado);
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-8 flex justify-center items-center">
          <p className="text-gray-600">Cargando eventos...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📅 Calendario de Eventos</h1>
              <p className="text-gray-600 mt-2">Gestiona citas médicas, estudios y eventos</p>
            </div>
            <button
              onClick={() => abrirModal()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              + Nuevo Evento
            </button>
          </div>

          {/* Leyenda de colores */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tipos de Eventos:</h3>
            <div className="flex flex-wrap gap-3">
              {tiposEvento.map((tipo) => (
                <div key={tipo.value} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: tipo.color }}
                  ></div>
                  <span className="text-sm text-gray-700">{tipo.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-400"></div>
                <span className="text-sm text-gray-700">Cancelado</span>
              </div>
            </div>
          </div>

          {/* Calendario */}
          <div className="bg-white rounded-lg shadow p-6" style={{ height: '700px' }}>
            <Calendar
              localizer={localizer}
              events={eventosCalendario}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              onSelectEvent={(event) => abrirDetalleModal(event.resource)}
              onSelectSlot={(slotInfo) => abrirModal(undefined, slotInfo)}
              selectable
              culture="es"
              messages={{
                next: 'Siguiente',
                previous: 'Anterior',
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día',
                agenda: 'Agenda',
                date: 'Fecha',
                time: 'Hora',
                event: 'Evento',
                noEventsInRange: 'No hay eventos en este rango',
                showMore: (total) => `+ Ver más (${total})`,
              }}
              eventPropGetter={(event) => ({
                style: event.style,
              })}
            />
          </div>
        </div>
      </div>

      {/* Modal crear/editar evento */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {editando ? 'Editar Evento' : 'Nuevo Evento'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Información básica */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Información Básica</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Título del Evento *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.titulo}
                      onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                      placeholder="Ej: Consulta con Cardiólogo"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Evento *
                    </label>
                    <select
                      required
                      value={formData.tipo}
                      onChange={(e) =>
                        setFormData({ ...formData, tipo: e.target.value as TipoEvento })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {tiposEvento.map((tipo) => (
                        <option key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subtipo (opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.subtipo}
                      onChange={(e) => setFormData({ ...formData, subtipo: e.target.value })}
                      placeholder="Ej: Revisión anual"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estado
                    </label>
                    <select
                      value={formData.estado}
                      onChange={(e) =>
                        setFormData({ ...formData, estado: e.target.value as EstadoEvento })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {estadosEvento.map((estado) => (
                        <option key={estado.value} value={estado.value}>
                          {estado.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Fecha y hora */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Fecha y Hora</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha de Inicio *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.fechaInicio}
                      onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hora de Inicio *
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.horaInicio}
                      onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha de Fin
                    </label>
                    <input
                      type="date"
                      value={formData.fechaFin}
                      onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hora de Fin
                    </label>
                    <input
                      type="time"
                      value={formData.horaFin}
                      onChange={(e) => setFormData({ ...formData, horaFin: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Contacto</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar Contacto
                  </label>
                  <select
                    value={formData.contactoId}
                    onChange={(e) => handleSelectContacto(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin contacto</option>
                    {contactos.map((contacto) => (
                      <option key={contacto.id} value={contacto.id}>
                        {contacto.nombre} - {contacto.categoria}
                        {contacto.especialidad && ` (${contacto.especialidad})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ubicación */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Ubicación</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dirección
                    </label>
                    <textarea
                      value={formData.ubicacion}
                      onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Latitud (opcional)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.coordenadas.lat}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            coordenadas: {
                              ...formData.coordenadas,
                              lat: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Longitud (opcional)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.coordenadas.lng}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            coordenadas: {
                              ...formData.coordenadas,
                              lng: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Detalles */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Detalles</h3>
                <div className="space-y-4">
                  {formData.tipo === 'cita_medica' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Motivo de Consulta
                      </label>
                      <textarea
                        value={formData.motivoConsulta}
                        onChange={(e) =>
                          setFormData({ ...formData, motivoConsulta: e.target.value })
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descripción
                    </label>
                    <textarea
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Transporte
                      </label>
                      <input
                        type="text"
                        value={formData.transporte}
                        onChange={(e) => setFormData({ ...formData, transporte: e.target.value })}
                        placeholder="Ej: Auto, Taxi, Ambulancia"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Acompañante
                      </label>
                      <input
                        type="text"
                        value={formData.acompanante}
                        onChange={(e) =>
                          setFormData({ ...formData, acompanante: e.target.value })
                        }
                        placeholder="Nombre del acompañante"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Checklist de preparación */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Checklist de Preparación</h3>
                <div className="space-y-2">
                  {formData.preparacion.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.completado}
                        onChange={() => toggleCompletadoPreparacion(index)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className={`flex-1 text-sm ${item.completado ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {item.item}
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminarItemPreparacion(index)}
                        className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={agregarItemPreparacion}
                    className="w-full px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors"
                  >
                    + Agregar Item
                  </button>
                </div>
              </div>

              {/* Recordatorios */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Recordatorios</h3>
                <div className="flex flex-wrap gap-2">
                  {['1week', '3days', '1day', '12hours', '2hours', '1hour'].map((tipo) => {
                    const labels: Record<string, string> = {
                      '1week': '1 semana antes',
                      '3days': '3 días antes',
                      '1day': '1 día antes',
                      '12hours': '12 horas antes',
                      '2hours': '2 horas antes',
                      '1hour': '1 hora antes',
                    };
                    const activo = formData.recordatorios.includes(tipo);
                    return (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() =>
                          activo ? eliminarRecordatorio(tipo) : agregarRecordatorio(tipo)
                        }
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          activo
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {labels[tipo]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  {editando ? 'Actualizar' : 'Crear'} Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de detalle */}
      {showDetalleModal && eventoSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {eventoSeleccionado.titulo}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium text-white"
                      style={{
                        backgroundColor: getTipoInfo(eventoSeleccionado.tipo)?.color || '#3b82f6',
                      }}
                    >
                      {getTipoInfo(eventoSeleccionado.tipo)?.label}
                    </span>
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                      {getEstadoInfo(eventoSeleccionado.estado)?.label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={cerrarDetalleModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Fecha y hora */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Fecha y Hora</h3>
                <p className="text-gray-700">
                  📅 {format(eventoSeleccionado.fechaInicio, "dd 'de' MMMM yyyy", { locale: es })}
                </p>
                <p className="text-gray-700">
                  🕐 {format(eventoSeleccionado.fechaInicio, 'HH:mm')} -{' '}
                  {format(eventoSeleccionado.fechaFin, 'HH:mm')}
                </p>
              </div>

              {/* Contacto */}
              {eventoSeleccionado.contactoNombre && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Contacto</h3>
                  <p className="text-gray-700">👤 {eventoSeleccionado.contactoNombre}</p>
                </div>
              )}

              {/* Ubicación */}
              {eventoSeleccionado.ubicacion && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Ubicación</h3>
                  <p className="text-gray-700">📍 {eventoSeleccionado.ubicacion}</p>
                  {eventoSeleccionado.coordenadas && (eventoSeleccionado.coordenadas.lat !== 0 || eventoSeleccionado.coordenadas.lng !== 0) && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${eventoSeleccionado.coordenadas.lat},${eventoSeleccionado.coordenadas.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm block mt-1"
                    >
                      Ver en Google Maps →
                    </a>
                  )}
                </div>
              )}

              {/* Motivo */}
              {eventoSeleccionado.motivoConsulta && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Motivo de Consulta</h3>
                  <p className="text-gray-700">{eventoSeleccionado.motivoConsulta}</p>
                </div>
              )}

              {/* Descripción */}
              {eventoSeleccionado.descripcion && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
                  <p className="text-gray-700">{eventoSeleccionado.descripcion}</p>
                </div>
              )}

              {/* Transporte */}
              {eventoSeleccionado.transporte && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Transporte</h3>
                  <p className="text-gray-700">🚗 {eventoSeleccionado.transporte}</p>
                </div>
              )}

              {/* Acompañante */}
              {eventoSeleccionado.acompanante && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Acompañante</h3>
                  <p className="text-gray-700">👥 {eventoSeleccionado.acompanante}</p>
                </div>
              )}

              {/* Preparación */}
              {eventoSeleccionado.preparacion && eventoSeleccionado.preparacion.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Checklist de Preparación</h3>
                  <div className="space-y-2">
                    {eventoSeleccionado.preparacion.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-lg">
                          {item.completado ? '✅' : '⬜'}
                        </span>
                        <span className={item.completado ? 'line-through text-gray-500' : 'text-gray-900'}>
                          {item.item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recordatorios */}
              {eventoSeleccionado.recordatorios && eventoSeleccionado.recordatorios.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Recordatorios</h3>
                  <div className="flex flex-wrap gap-2">
                    {eventoSeleccionado.recordatorios.map((recordatorio, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        🔔 {recordatorio}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    cerrarDetalleModal();
                    abrirModal(eventoSeleccionado);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  ✏️ Editar
                </button>
                {eventoSeleccionado.estado !== 'cancelada' && (
                  <button
                    onClick={() => cancelarEvento(eventoSeleccionado)}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                  >
                    ❌ Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
