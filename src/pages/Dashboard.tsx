import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, Timestamp, updateDoc, doc, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow, addDays, startOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import Layout from '../components/common/Layout';
import { DashboardSkeleton, CardSkeleton } from '../components/common/Skeleton';
import { Evento, Contacto, SignoVital, RegistroMedicamento, ChequeoDiario } from '../types';

const PACIENTE_ID = 'paciente-principal';

interface DashboardMetrics {
  adherenciaMedicamentos: number;
  signosVitalesHoy: SignoVital | null;
  medicamentosPendientes: number;
  ultimoChequeo: ChequeoDiario | null;
  alertasActivas: number;
}

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const [proximasCitas, setProximasCitas] = useState<Evento[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    adherenciaMedicamentos: 0,
    signosVitalesHoy: null,
    medicamentosPendientes: 0,
    ultimoChequeo: null,
    alertasActivas: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      await Promise.all([
        cargarProximasCitas(),
        cargarContactos(),
        cargarMetricas()
      ]);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  }

  async function cargarMetricas() {
    try {
      const hoy = startOfDay(new Date());
      const hace7Dias = subDays(hoy, 7);

      // Signos vitales de hoy
      const qSignos = query(
        collection(db, 'pacientes', PACIENTE_ID, 'signosVitales'),
        where('fecha', '>=', Timestamp.fromDate(hoy)),
        orderBy('fecha', 'desc'),
        limit(1)
      );
      const signosSnap = await getDocs(qSignos);
      const signoHoy = signosSnap.docs[0]?.data() as SignoVital | undefined;

      // Medicamentos de hoy
      const qMeds = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', Timestamp.fromDate(hoy)),
        where('fechaHoraProgramada', '<=', Timestamp.fromDate(addDays(hoy, 1)))
      );
      const medsSnap = await getDocs(qMeds);
      const pendientes = medsSnap.docs.filter(d => d.data().estado === 'pendiente').length;

      // Adherencia últimos 7 días
      const qAdherencia = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', Timestamp.fromDate(hace7Dias))
      );
      const adherenciaSnap = await getDocs(qAdherencia);
      const tomados = adherenciaSnap.docs.filter(d => d.data().estado === 'tomado').length;
      const total = adherenciaSnap.docs.filter(d => ['tomado', 'rechazado', 'omitido'].includes(d.data().estado)).length;
      const adherencia = total > 0 ? Math.round((tomados / total) * 100) : 100;

      // Último chequeo
      const qChequeo = query(
        collection(db, 'pacientes', PACIENTE_ID, 'chequeosDiarios'),
        orderBy('fecha', 'desc'),
        limit(1)
      );
      const chequeoSnap = await getDocs(qChequeo);
      const ultimoChequeo = chequeoSnap.docs[0]?.data() as ChequeoDiario | undefined;

      // Alertas (signos fuera de rango en últimos 7 días)
      const qAlertas = query(
        collection(db, 'pacientes', PACIENTE_ID, 'signosVitales'),
        where('fecha', '>=', Timestamp.fromDate(hace7Dias)),
        where('fueraDeRango', '==', true)
      );
      const alertasSnap = await getDocs(qAlertas);

      setMetrics({
        adherenciaMedicamentos: adherencia,
        signosVitalesHoy: signoHoy ? { ...signoHoy, fecha: signoHoy.fecha } as SignoVital : null,
        medicamentosPendientes: pendientes,
        ultimoChequeo: ultimoChequeo ? { ...ultimoChequeo, fecha: ultimoChequeo.fecha } as ChequeoDiario : null,
        alertasActivas: alertasSnap.docs.length
      });
    } catch (error) {
      console.error('Error al cargar métricas:', error);
    }
  }

  async function cargarProximasCitas() {
    try {
      const ahora = startOfDay(new Date());
      const enUnaSemana = addDays(ahora, 7);

      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'eventos'),
        where('fechaInicio', '>=', Timestamp.fromDate(ahora)),
        where('fechaInicio', '<=', Timestamp.fromDate(enUnaSemana)),
        where('estado', 'in', ['programada', 'confirmada']),
        orderBy('fechaInicio', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const eventos: Evento[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        eventos.push({
          id: doc.id,
          ...data,
          fechaInicio: data.fechaInicio?.toDate() || new Date(),
          fechaFin: data.fechaFin?.toDate() || new Date(),
          confirmadoEn: data.confirmadoEn?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Evento);
      });

      setProximasCitas(eventos);
    } catch (error) {
      console.error('Error al cargar próximas citas:', error);
    }
  }

  async function cargarContactos() {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'contactos'),
        where('activo', '==', true),
        where('favorito', '==', true)
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

      setContactos(contactosData.slice(0, 5));
    } catch (error) {
      console.error('Error al cargar contactos:', error);
    }
  }

  async function confirmarCita(evento: Evento) {
    try {
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'eventos', evento.id), {
        estado: 'confirmada',
        confirmadoPor: currentUser?.uid,
        confirmadoEn: Timestamp.now(),
        actualizadoEn: Timestamp.now(),
      });
      cargarProximasCitas();
    } catch (error) {
      console.error('Error al confirmar cita:', error);
    }
  }

  function getFechaTexto(fecha: Date) {
    if (isToday(fecha)) {
      return '🔴 Hoy';
    } else if (isTomorrow(fecha)) {
      return '🟡 Mañana';
    } else {
      return format(fecha, "EEE d MMM", { locale: es });
    }
  }

  function getTipoIcono(tipo: string) {
    const iconos: Record<string, string> = {
      cita_medica: '🏥',
      estudio: '🔬',
      terapia: '💆',
      visita: '👨‍👩‍👧',
      evento_social: '🎉',
      tramite: '📄',
      otro: '📅',
    };
    return iconos[tipo] || '📅';
  }

  if (loading) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              ¡Hola, {userProfile?.nombre?.split(' ')[0] || 'Usuario'}!
            </h2>
            <p className="text-gray-600 text-sm md:text-base">
              {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>

          {/* Métricas Resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            {/* Adherencia */}
            <Link to="/adherencia" className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">💊</span>
                {metrics.alertasActivas > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                    {metrics.alertasActivas} alertas
                  </span>
                )}
              </div>
              <div className={`text-2xl md:text-3xl font-bold ${
                metrics.adherenciaMedicamentos >= 90 ? 'text-green-600' :
                metrics.adherenciaMedicamentos >= 70 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {metrics.adherenciaMedicamentos}%
              </div>
              <div className="text-xs md:text-sm text-gray-500">Adherencia 7 días</div>
            </Link>

            {/* Medicamentos pendientes */}
            <Link to="/pastillero-diario" className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
              <div className="text-2xl mb-2">⏰</div>
              <div className={`text-2xl md:text-3xl font-bold ${
                metrics.medicamentosPendientes === 0 ? 'text-green-600' : 'text-orange-600'
              }`}>
                {metrics.medicamentosPendientes}
              </div>
              <div className="text-xs md:text-sm text-gray-500">Medicamentos hoy</div>
            </Link>

            {/* Signos vitales */}
            <Link to="/signos-vitales" className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
              <div className="text-2xl mb-2">💓</div>
              {metrics.signosVitalesHoy ? (
                <>
                  <div className="text-lg md:text-xl font-bold text-blue-600">
                    {metrics.signosVitalesHoy.presionArterialSistolica || '--'}/{metrics.signosVitalesHoy.presionArterialDiastolica || '--'}
                  </div>
                  <div className="text-xs md:text-sm text-gray-500">PA hoy • SpO2: {metrics.signosVitalesHoy.spo2 || '--'}%</div>
                </>
              ) : (
                <>
                  <div className="text-lg md:text-xl font-bold text-gray-400">--/--</div>
                  <div className="text-xs md:text-sm text-gray-500">Sin registro hoy</div>
                </>
              )}
            </Link>

            {/* Chequeo */}
            <Link to="/chequeo-diario" className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
              <div className="text-2xl mb-2">📋</div>
              {metrics.ultimoChequeo?.completado ? (
                <>
                  <div className="text-lg md:text-xl font-bold text-green-600">✓ Completo</div>
                  <div className="text-xs md:text-sm text-gray-500">Chequeo de hoy</div>
                </>
              ) : (
                <>
                  <div className="text-lg md:text-xl font-bold text-orange-600">Pendiente</div>
                  <div className="text-xs md:text-sm text-gray-500">Chequeo diario</div>
                </>
              )}
            </Link>
          </div>

          {/* Grid principal */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
            {/* Próximas Citas */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow">
              <div className="p-4 md:p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">📅 Próximas Citas</h3>
                  <Link
                    to="/eventos"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Ver todas →
                  </Link>
                </div>
              </div>
              <div className="p-4 md:p-6">
                {proximasCitas.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-gray-500 mb-4">No hay citas en los próximos 7 días</p>
                    <Link
                      to="/eventos"
                      className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                    >
                      + Crear Cita
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {proximasCitas.slice(0, 4).map((cita) => (
                      <div
                        key={cita.id}
                        className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span className="text-2xl flex-shrink-0">{getTipoIcono(cita.tipo)}</span>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-gray-900 truncate">{cita.titulo}</h4>
                              <p className="text-sm text-gray-600">
                                {getFechaTexto(cita.fechaInicio)} • {format(cita.fechaInicio, 'HH:mm')}
                              </p>
                              {cita.contactoNombre && (
                                <p className="text-xs text-gray-500 truncate">👤 {cita.contactoNombre}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {cita.estado === 'programada' ? (
                              <button
                                onClick={() => confirmarCita(cita)}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded"
                              >
                                ✓ Confirmar
                              </button>
                            ) : (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                                Confirmada
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Contactos Favoritos */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 md:p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">⭐ Contactos</h3>
                  <Link
                    to="/contactos"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Ver todos →
                  </Link>
                </div>
              </div>
              <div className="p-4 md:p-6">
                {contactos.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-3">Sin favoritos</p>
                    <Link
                      to="/contactos"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Agregar →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contactos.map((contacto) => (
                      <div
                        key={contacto.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                      >
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                          {contacto.foto ? (
                            <img src={contacto.foto} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : '👤'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{contacto.nombre}</p>
                          <p className="text-xs text-gray-500 truncate">{contacto.especialidad || contacto.categoria}</p>
                        </div>
                        {contacto.telefonoPrincipal && (
                          <a
                            href={`tel:${contacto.telefonoPrincipal}`}
                            className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full flex-shrink-0"
                          >
                            📞
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Accesos Rápidos */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4">⚡ Acceso Rápido</h3>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-3">
              {[
                { path: '/chequeo-diario', icon: '📋', label: 'Chequeo' },
                { path: '/signos-vitales', icon: '💓', label: 'Signos' },
                { path: '/pastillero-diario', icon: '💊', label: 'Pastillero' },
                { path: '/menu-comida', icon: '🍽️', label: 'Menú' },
                { path: '/turnos', icon: '👥', label: 'Turnos' },
                { path: '/actividades', icon: '🎯', label: 'Actividades' },
                { path: '/analytics', icon: '📊', label: 'Analytics' },
                { path: '/inventarios', icon: '📦', label: 'Inventario' },
              ].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex flex-col items-center justify-center p-3 md:p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <span className="text-2xl md:text-3xl mb-1">{item.icon}</span>
                  <span className="text-xs font-medium text-gray-700 text-center">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
