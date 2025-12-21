import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, Timestamp, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import { TurnoDetalle, TipoTurno, EstadoTurno, Gravedad, Usuario } from '../types';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, differenceInMinutes, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';

const PACIENTE_ID = 'paciente-principal';

const tiposTurno: { value: TipoTurno; label: string; horas: string }[] = [
  { value: 'matutino', label: 'Matutino', horas: '07:00 - 15:00' },
  { value: 'vespertino', label: 'Vespertino', horas: '15:00 - 23:00' },
  { value: 'nocturno', label: 'Nocturno', horas: '23:00 - 07:00' },
  { value: '24hrs', label: '24 Horas', horas: '09:00 - 08:59' },
  { value: 'especial', label: 'Especial', horas: 'Personalizado' }
];

const coloresTurno: Record<TipoTurno, string> = {
  matutino: 'bg-yellow-100 border-yellow-400 text-yellow-800',
  vespertino: 'bg-orange-100 border-orange-400 text-orange-800',
  nocturno: 'bg-indigo-100 border-indigo-400 text-indigo-800',
  '24hrs': 'bg-purple-100 border-purple-400 text-purple-800',
  especial: 'bg-gray-100 border-gray-400 text-gray-800'
};

const coloresEstado: Record<EstadoTurno, string> = {
  programado: 'bg-gray-200 text-gray-700',
  confirmado: 'bg-blue-200 text-blue-700',
  activo: 'bg-green-200 text-green-700',
  completado: 'bg-green-100 text-green-600',
  cancelado: 'bg-red-200 text-red-700'
};

export default function Turnos() {
  const { userProfile } = useAuth();
  const [turnos, setTurnos] = useState<TurnoDetalle[]>([]);
  const [cuidadores, setCuidadores] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [semanaActual, setSemanaActual] = useState(new Date());
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalCheckIn, setModalCheckIn] = useState(false);
  const [modalEntrega, setModalEntrega] = useState(false);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<TurnoDetalle | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null);
  const [vistaReporte, setVistaReporte] = useState(false);

  const [formTurno, setFormTurno] = useState({
    cuidadorId: '',
    tipoTurno: 'matutino' as TipoTurno,
    horaEntradaProgramada: '07:00',
    horaSalidaProgramada: '15:00',
    notasEntrada: ''
  });

  const [formEntrega, setFormEntrega] = useState({
    notasSalida: '',
    novedades: [] as { tipo: string; descripcion: string; hora: string; gravedad: Gravedad }[],
    tareasCompletadas: [] as { tarea: string; completado: boolean }[]
  });

  // Obtener inicio y fin de semana
  const inicioSemana = startOfWeek(semanaActual, { weekStartsOn: 1 });
  const finSemana = endOfWeek(semanaActual, { weekStartsOn: 1 });
  const diasSemana = eachDayOfInterval({ start: inicioSemana, end: finSemana });

  // Cargar turnos
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'turnos'),
      orderBy('fecha', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const turnosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha?.toDate(),
        horaEntradaReal: doc.data().horaEntradaReal?.toDate(),
        horaSalidaReal: doc.data().horaSalidaReal?.toDate(),
        creadoEn: doc.data().creadoEn?.toDate(),
        actualizadoEn: doc.data().actualizadoEn?.toDate()
      })) as TurnoDetalle[];
      setTurnos(turnosData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cargar cuidadores desde la colección principal de usuarios
  useEffect(() => {
    const q = query(
      collection(db, 'usuarios'),
      where('rol', '==', 'cuidador'),
      where('activo', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cuidadoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Usuario[];
      setCuidadores(cuidadoresData);
    });

    return () => unsubscribe();
  }, []);

  // Obtener turnos de un día específico
  function turnosDelDia(fecha: Date): TurnoDetalle[] {
    return turnos.filter(t => t.fecha && isSameDay(t.fecha, fecha));
  }

  // Verificar si hay un turno de 24 horas en un día específico
  function tieneTurno24Horas(fecha: Date): TurnoDetalle | undefined {
    return turnos.find(t =>
      t.fecha &&
      isSameDay(t.fecha, fecha) &&
      t.tipoTurno === '24hrs' &&
      t.estado !== 'cancelado'
    );
  }

  // Obtener turno de 24 horas del día anterior que afecta a este día
  function turno24HorasDiaAnterior(fecha: Date): TurnoDetalle | undefined {
    const ayer = new Date(fecha);
    ayer.setDate(ayer.getDate() - 1);
    return turnos.find(t =>
      t.fecha &&
      isSameDay(t.fecha, ayer) &&
      t.tipoTurno === '24hrs' &&
      t.estado !== 'cancelado'
    );
  }

  // Verificar si un día ya está completamente ocupado
  function diaOcupado(fecha: Date): boolean {
    // Solo ocupado si hay turno de 24hrs hoy (el día siguiente puede tener turnos después de las 08:59)
    return !!tieneTurno24Horas(fecha);
  }

  // Horas del timeline (de 00:00 a 23:00)
  const horasTimeline = Array.from({ length: 24 }, (_, i) => i);

  // Calcular posición y altura del turno en el timeline
  function calcularPosicionTurno(turno: TurnoDetalle): { top: number; height: number; continua: boolean } {
    const [horaEntrada, minEntrada] = turno.horaEntradaProgramada.split(':').map(Number);
    const [horaSalida, minSalida] = turno.horaSalidaProgramada.split(':').map(Number);

    const minutosEntrada = horaEntrada * 60 + minEntrada;
    let minutosSalida = horaSalida * 60 + minSalida;

    // Si la hora de salida es menor que la de entrada, el turno cruza medianoche
    const cruzaMedianoche = minutosSalida <= minutosEntrada;
    if (cruzaMedianoche) {
      minutosSalida = 24 * 60; // Mostrar hasta el final del día
    }

    const top = (minutosEntrada / (24 * 60)) * 100;
    const height = ((minutosSalida - minutosEntrada) / (24 * 60)) * 100;

    return { top, height, continua: cruzaMedianoche };
  }

  // Calcular posición para continuación del día anterior
  function calcularPosicionContinuacion(turno: TurnoDetalle): { top: number; height: number } {
    const [horaSalida, minSalida] = turno.horaSalidaProgramada.split(':').map(Number);
    const minutosSalida = horaSalida * 60 + minSalida;

    const top = 0; // Empieza a las 00:00
    const height = (minutosSalida / (24 * 60)) * 100;

    return { top, height };
  }

  // Crear turno
  async function crearTurno() {
    if (!fechaSeleccionada || !formTurno.cuidadorId) return;

    const cuidador = cuidadores.find(c => c.id === formTurno.cuidadorId);
    if (!cuidador) return;

    const horaEntrada = formTurno.horaEntradaProgramada.split(':').map(Number);
    const horaSalida = formTurno.horaSalidaProgramada.split(':').map(Number);
    let duracion = (horaSalida[0] * 60 + horaSalida[1]) - (horaEntrada[0] * 60 + horaEntrada[1]);
    if (duracion <= 0) duracion += 24 * 60; // Si cruza medianoche

    const nuevoTurno = {
      pacienteId: PACIENTE_ID,
      cuidadorId: formTurno.cuidadorId,
      cuidadorNombre: cuidador.nombre,
      fecha: Timestamp.fromDate(fechaSeleccionada),
      horaEntradaProgramada: formTurno.horaEntradaProgramada,
      horaSalidaProgramada: formTurno.horaSalidaProgramada,
      tipoTurno: formTurno.tipoTurno,
      duracionHoras: Math.round(duracion / 60 * 10) / 10,
      estado: 'programado' as EstadoTurno,
      notasEntrada: formTurno.notasEntrada || null,
      creadoEn: Timestamp.now(),
      actualizadoEn: Timestamp.now()
    };

    await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'turnos'), nuevoTurno);
    cerrarModal();
  }

  // Check-in
  async function hacerCheckIn() {
    if (!turnoSeleccionado) return;

    const ahora = new Date();
    const [horaP, minP] = turnoSeleccionado.horaEntradaProgramada.split(':').map(Number);
    const horaProgramada = new Date(turnoSeleccionado.fecha);
    horaProgramada.setHours(horaP, minP, 0, 0);

    const retraso = differenceInMinutes(ahora, horaProgramada);

    await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'turnos', turnoSeleccionado.id), {
      estado: 'activo',
      horaEntradaReal: Timestamp.fromDate(ahora),
      retrasoMinutos: retraso > 0 ? retraso : 0,
      actualizadoEn: Timestamp.now()
    });

    setModalCheckIn(false);
    setTurnoSeleccionado(null);
  }

  // Check-out con entrega de turno
  async function hacerCheckOut() {
    if (!turnoSeleccionado) return;

    const ahora = new Date();
    const horasReales = turnoSeleccionado.horaEntradaReal
      ? differenceInHours(ahora, turnoSeleccionado.horaEntradaReal)
      : turnoSeleccionado.duracionHoras;

    await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'turnos', turnoSeleccionado.id), {
      estado: 'completado',
      horaSalidaReal: Timestamp.fromDate(ahora),
      horasReales: Math.round(horasReales * 10) / 10,
      notasSalida: formEntrega.notasSalida || null,
      novedades: formEntrega.novedades.length > 0 ? formEntrega.novedades : null,
      tareasCompletadas: formEntrega.tareasCompletadas.length > 0 ? formEntrega.tareasCompletadas : null,
      actualizadoEn: Timestamp.now()
    });

    setModalEntrega(false);
    setTurnoSeleccionado(null);
    setFormEntrega({ notasSalida: '', novedades: [], tareasCompletadas: [] });
  }

  // Confirmar turno
  async function confirmarTurno(turno: TurnoDetalle) {
    await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'turnos', turno.id), {
      estado: 'confirmado',
      actualizadoEn: Timestamp.now()
    });
  }

  // Cancelar turno
  async function cancelarTurno(turno: TurnoDetalle) {
    if (!confirm('¿Cancelar este turno?')) return;
    await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'turnos', turno.id), {
      estado: 'cancelado',
      actualizadoEn: Timestamp.now()
    });
  }

  // Agregar novedad
  function agregarNovedad() {
    setFormEntrega({
      ...formEntrega,
      novedades: [...formEntrega.novedades, { tipo: '', descripcion: '', hora: format(new Date(), 'HH:mm'), gravedad: 'leve' }]
    });
  }

  // Agregar tarea
  function agregarTarea() {
    setFormEntrega({
      ...formEntrega,
      tareasCompletadas: [...formEntrega.tareasCompletadas, { tarea: '', completado: false }]
    });
  }

  function cerrarModal() {
    setModalAbierto(false);
    setFechaSeleccionada(null);
    setFormTurno({
      cuidadorId: '',
      tipoTurno: 'matutino',
      horaEntradaProgramada: '07:00',
      horaSalidaProgramada: '15:00',
      notasEntrada: ''
    });
  }

  // Calcular horas por cuidador en la semana
  function calcularHorasSemana(): { cuidador: string; horasProgramadas: number; horasReales: number; turnos: number }[] {
    const turnosSemana = turnos.filter(t =>
      t.fecha && t.fecha >= inicioSemana && t.fecha <= finSemana && t.estado !== 'cancelado'
    );

    const porCuidador: Record<string, { nombre: string; horasProgramadas: number; horasReales: number; turnos: number }> = {};

    turnosSemana.forEach(t => {
      if (!porCuidador[t.cuidadorId]) {
        porCuidador[t.cuidadorId] = { nombre: t.cuidadorNombre, horasProgramadas: 0, horasReales: 0, turnos: 0 };
      }
      porCuidador[t.cuidadorId].horasProgramadas += t.duracionHoras;
      porCuidador[t.cuidadorId].horasReales += t.horasReales || 0;
      porCuidador[t.cuidadorId].turnos += 1;
    });

    return Object.values(porCuidador).map(c => ({
      cuidador: c.nombre,
      horasProgramadas: Math.round(c.horasProgramadas * 10) / 10,
      horasReales: Math.round(c.horasReales * 10) / 10,
      turnos: c.turnos
    }));
  }

  // Verificar si el usuario actual puede hacer check-in en un turno
  function puedeHacerCheckIn(turno: TurnoDetalle): boolean {
    if (turno.estado !== 'programado' && turno.estado !== 'confirmado') return false;
    if (userProfile?.rol === 'cuidador' && turno.cuidadorId !== userProfile.id) return false;
    return true;
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex justify-center items-center h-64">
          <div className="text-gray-500">Cargando turnos...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">👥 Turnos de Cuidadores</h1>
            <p className="text-gray-600">Gestión de horarios y check-in/check-out</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setVistaReporte(!vistaReporte)}
              className={`px-4 py-2 rounded-lg font-medium ${
                vistaReporte ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              📊 Reporte
            </button>
          </div>
        </div>

        {/* Navegación de semana */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-lg shadow">
          <button
            onClick={() => setSemanaActual(subWeeks(semanaActual, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            ← Anterior
          </button>
          <div className="text-center">
            <h2 className="font-semibold text-lg">
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

        {vistaReporte ? (
          /* Vista de Reporte */
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">📊 Reporte de Horas - Semana Actual</h3>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Cuidador</th>
                  <th className="text-center p-3">Turnos</th>
                  <th className="text-center p-3">Horas Programadas</th>
                  <th className="text-center p-3">Horas Reales</th>
                  <th className="text-center p-3">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {calcularHorasSemana().map((row, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-3 font-medium">{row.cuidador}</td>
                    <td className="text-center p-3">{row.turnos}</td>
                    <td className="text-center p-3">{row.horasProgramadas}h</td>
                    <td className="text-center p-3">{row.horasReales}h</td>
                    <td className={`text-center p-3 ${
                      row.horasReales - row.horasProgramadas >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {row.horasReales - row.horasProgramadas >= 0 ? '+' : ''}
                      {Math.round((row.horasReales - row.horasProgramadas) * 10) / 10}h
                    </td>
                  </tr>
                ))}
                {calcularHorasSemana().length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-500">
                      No hay turnos programados esta semana
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Calendario semanal */
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Header de días - con espacio para columna de horas */}
            <div className="flex border-b">
              {/* Espacio para alinear con columna de horas */}
              <div className="w-12 flex-shrink-0 border-r bg-gray-50" />
              {/* Días de la semana */}
              <div className="flex-1 grid grid-cols-7">
                {diasSemana.map((dia, idx) => {
                  const esHoy = isSameDay(dia, new Date());
                  return (
                    <div
                      key={idx}
                      className={`p-3 text-center border-r last:border-r-0 ${
                        esHoy ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="text-sm text-gray-500">
                        {format(dia, 'EEE', { locale: es })}
                      </div>
                      <div className={`text-lg font-semibold ${esHoy ? 'text-blue-600' : ''}`}>
                        {format(dia, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline con horas */}
            <div className="flex">
              {/* Columna de horas */}
              <div className="w-12 flex-shrink-0 border-r bg-gray-50">
                {horasTimeline.filter(h => h % 3 === 0).map(hora => (
                  <div
                    key={hora}
                    className="h-[50px] text-xs text-gray-400 text-right pr-2 border-b border-gray-100"
                    style={{ marginTop: hora === 0 ? 0 : undefined }}
                  >
                    {hora.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Columnas de días con timeline */}
              <div className="flex-1 grid grid-cols-7">
                {diasSemana.map((dia, idx) => {
                  const turnosDia = turnosDelDia(dia);
                  const esHoy = isSameDay(dia, new Date());
                  const turnoAnterior = turno24HorasDiaAnterior(dia);
                  const estaOcupado = diaOcupado(dia);

                  return (
                    <div
                      key={idx}
                      className={`border-r last:border-r-0 relative ${esHoy ? 'bg-blue-50/30' : ''}`}
                      style={{ height: `${8 * 50}px` }} // 8 slots de 3 horas = 24 horas
                    >
                      {/* Líneas de hora */}
                      {horasTimeline.filter(h => h % 3 === 0).map(hora => (
                        <div
                          key={hora}
                          className="absolute w-full border-b border-gray-100"
                          style={{ top: `${(hora / 24) * 100}%` }}
                        />
                      ))}

                      {/* Continuación del día anterior */}
                      {turnoAnterior && (() => {
                        const pos = calcularPosicionContinuacion(turnoAnterior);
                        return (
                          <div
                            className="absolute left-1 right-1 rounded bg-purple-100/80 border-l-4 border-purple-400 p-1 cursor-pointer hover:bg-purple-200/80 transition-colors overflow-hidden"
                            style={{
                              top: `${pos.top}%`,
                              height: `${pos.height}%`,
                              minHeight: '24px'
                            }}
                            onClick={() => {
                              setTurnoSeleccionado(turnoAnterior);
                              setModalCheckIn(true);
                            }}
                          >
                            <div className="text-xs text-purple-600 font-medium">← Continúa</div>
                            <div className="text-xs text-purple-800 truncate">{turnoAnterior.cuidadorNombre}</div>
                            <div className="text-xs text-purple-500">hasta {turnoAnterior.horaSalidaProgramada}</div>
                          </div>
                        );
                      })()}

                      {/* Turnos del día */}
                      {turnosDia.map(turno => {
                        const pos = calcularPosicionTurno(turno);
                        const bgColor = turno.tipoTurno === 'matutino' ? 'bg-yellow-100/90 border-yellow-400'
                          : turno.tipoTurno === 'vespertino' ? 'bg-orange-100/90 border-orange-400'
                          : turno.tipoTurno === 'nocturno' ? 'bg-indigo-100/90 border-indigo-400'
                          : turno.tipoTurno === '24hrs' ? 'bg-purple-100/90 border-purple-400'
                          : 'bg-gray-100/90 border-gray-400';

                        return (
                          <div
                            key={turno.id}
                            className={`absolute left-1 right-1 rounded border-l-4 p-1 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden ${bgColor}`}
                            style={{
                              top: `${pos.top}%`,
                              height: `${pos.height}%`,
                              minHeight: '40px'
                            }}
                            onClick={() => {
                              setTurnoSeleccionado(turno);
                              if (turno.estado === 'activo') {
                                setModalEntrega(true);
                              } else if (puedeHacerCheckIn(turno)) {
                                setModalCheckIn(true);
                              }
                            }}
                          >
                            <div className="text-xs font-medium truncate">{turno.cuidadorNombre}</div>
                            <div className="text-xs opacity-75">
                              {turno.horaEntradaProgramada} - {turno.horaSalidaProgramada}
                            </div>
                            <span className={`inline-block mt-0.5 px-1 py-0.5 text-xs rounded ${coloresEstado[turno.estado]}`}>
                              {turno.estado === 'activo' ? '🟢' : turno.estado.slice(0, 4)}
                            </span>
                            {pos.continua && (
                              <div className="text-xs text-purple-600 font-medium">→ sigue</div>
                            )}
                          </div>
                        );
                      })}

                      {/* Botón agregar - posicionado en zona sin turnos */}
                      {(userProfile?.rol === 'familiar' || userProfile?.rol === 'supervisor') && !estaOcupado && (
                        <button
                          onClick={() => {
                            setFechaSeleccionada(dia);
                            setModalAbierto(true);
                          }}
                          className="absolute bottom-2 left-1 right-1 p-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded border border-dashed border-gray-300 bg-white/80"
                        >
                          + Agregar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Leyenda */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {tiposTurno.map(tipo => (
            <div key={tipo.value} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded border-l-4 ${coloresTurno[tipo.value]}`}></div>
              <span>{tipo.label} ({tipo.horas})</span>
            </div>
          ))}
        </div>

        {/* Modal Crear Turno */}
        {modalAbierto && fechaSeleccionada && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">
                Nuevo Turno - {format(fechaSeleccionada, "EEEE d 'de' MMMM", { locale: es })}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cuidador *
                  </label>
                  <select
                    value={formTurno.cuidadorId}
                    onChange={(e) => setFormTurno({ ...formTurno, cuidadorId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Seleccionar cuidador</option>
                    {cuidadores.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Turno
                  </label>
                  <select
                    value={formTurno.tipoTurno}
                    onChange={(e) => {
                      const tipo = e.target.value as TipoTurno;
                      const config = tiposTurno.find(t => t.value === tipo);
                      if (config && tipo !== 'especial') {
                        const [entrada, salida] = config.horas.split(' - ');
                        setFormTurno({
                          ...formTurno,
                          tipoTurno: tipo,
                          horaEntradaProgramada: entrada,
                          horaSalidaProgramada: salida
                        });
                      } else {
                        setFormTurno({ ...formTurno, tipoTurno: tipo });
                      }
                    }}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {tiposTurno.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hora Entrada
                    </label>
                    <input
                      type="time"
                      value={formTurno.horaEntradaProgramada}
                      onChange={(e) => {
                        const nuevaHoraEntrada = e.target.value;
                        // Si es turno de 24 horas, recalcular hora de salida automáticamente
                        if (formTurno.tipoTurno === '24hrs') {
                          const [hora, minuto] = nuevaHoraEntrada.split(':').map(Number);
                          // Calcular 23:59 después (1 minuto antes de la hora de entrada)
                          let horaSalida = hora;
                          let minutoSalida = minuto - 1;
                          if (minutoSalida < 0) {
                            minutoSalida = 59;
                            horaSalida = horaSalida - 1;
                            if (horaSalida < 0) {
                              horaSalida = 23;
                            }
                          }
                          const nuevaHoraSalida = `${horaSalida.toString().padStart(2, '0')}:${minutoSalida.toString().padStart(2, '0')}`;
                          setFormTurno({
                            ...formTurno,
                            horaEntradaProgramada: nuevaHoraEntrada,
                            horaSalidaProgramada: nuevaHoraSalida
                          });
                        } else {
                          setFormTurno({ ...formTurno, horaEntradaProgramada: nuevaHoraEntrada });
                        }
                      }}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hora Salida
                    </label>
                    <input
                      type="time"
                      value={formTurno.horaSalidaProgramada}
                      onChange={(e) => setFormTurno({ ...formTurno, horaSalidaProgramada: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas de entrada
                  </label>
                  <textarea
                    value={formTurno.notasEntrada}
                    onChange={(e) => setFormTurno({ ...formTurno, notasEntrada: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Instrucciones o notas para el cuidador..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={cerrarModal}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={crearTurno}
                  disabled={!formTurno.cuidadorId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Crear Turno
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Check-in */}
        {modalCheckIn && turnoSeleccionado && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">📍 Iniciar Turno</h2>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p><strong>Cuidador:</strong> {turnoSeleccionado.cuidadorNombre}</p>
                <p><strong>Fecha:</strong> {turnoSeleccionado.fecha && format(turnoSeleccionado.fecha, "EEEE d 'de' MMMM", { locale: es })}</p>
                <p><strong>Horario:</strong> {turnoSeleccionado.horaEntradaProgramada} - {turnoSeleccionado.horaSalidaProgramada}</p>
                <p><strong>Hora actual:</strong> {format(new Date(), 'HH:mm')}</p>
              </div>

              {turnoSeleccionado.notasEntrada && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg mb-4">
                  <p className="text-sm font-medium text-yellow-800">📝 Notas del turno:</p>
                  <p className="text-sm text-yellow-700">{turnoSeleccionado.notasEntrada}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setModalCheckIn(false);
                    setTurnoSeleccionado(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                {turnoSeleccionado.estado === 'programado' && (
                  <button
                    onClick={() => confirmarTurno(turnoSeleccionado)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    ✓ Confirmar
                  </button>
                )}
                <button
                  onClick={hacerCheckIn}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  🚀 Iniciar Turno
                </button>
                <button
                  onClick={() => cancelarTurno(turnoSeleccionado)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Cancelar Turno
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Entrega de Turno */}
        {modalEntrega && turnoSeleccionado && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
              <h2 className="text-xl font-bold mb-4">📋 Entrega de Turno</h2>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p><strong>Cuidador:</strong> {turnoSeleccionado.cuidadorNombre}</p>
                <p><strong>Entrada:</strong> {turnoSeleccionado.horaEntradaReal && format(turnoSeleccionado.horaEntradaReal, 'HH:mm')}</p>
                <p><strong>Hora actual:</strong> {format(new Date(), 'HH:mm')}</p>
              </div>

              <div className="space-y-4">
                {/* Notas de salida */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas de salida / Resumen del turno
                  </label>
                  <textarea
                    value={formEntrega.notasSalida}
                    onChange={(e) => setFormEntrega({ ...formEntrega, notasSalida: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={3}
                    placeholder="Resumen del turno, estado del paciente..."
                  />
                </div>

                {/* Novedades */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Novedades</label>
                    <button
                      type="button"
                      onClick={agregarNovedad}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Agregar novedad
                    </button>
                  </div>
                  {formEntrega.novedades.map((nov, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-lg mb-2">
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Tipo"
                          value={nov.tipo}
                          onChange={(e) => {
                            const novedades = [...formEntrega.novedades];
                            novedades[idx].tipo = e.target.value;
                            setFormEntrega({ ...formEntrega, novedades });
                          }}
                          className="border rounded px-2 py-1 text-sm"
                        />
                        <input
                          type="time"
                          value={nov.hora}
                          onChange={(e) => {
                            const novedades = [...formEntrega.novedades];
                            novedades[idx].hora = e.target.value;
                            setFormEntrega({ ...formEntrega, novedades });
                          }}
                          className="border rounded px-2 py-1 text-sm"
                        />
                        <select
                          value={nov.gravedad}
                          onChange={(e) => {
                            const novedades = [...formEntrega.novedades];
                            novedades[idx].gravedad = e.target.value as Gravedad;
                            setFormEntrega({ ...formEntrega, novedades });
                          }}
                          className="border rounded px-2 py-1 text-sm"
                        >
                          <option value="leve">Leve</option>
                          <option value="moderada">Moderada</option>
                          <option value="grave">Grave</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Descripción"
                          value={nov.descripcion}
                          onChange={(e) => {
                            const novedades = [...formEntrega.novedades];
                            novedades[idx].descripcion = e.target.value;
                            setFormEntrega({ ...formEntrega, novedades });
                          }}
                          className="flex-1 border rounded px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => {
                            const novedades = formEntrega.novedades.filter((_, i) => i !== idx);
                            setFormEntrega({ ...formEntrega, novedades });
                          }}
                          className="text-red-500 hover:text-red-700 px-2"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tareas completadas */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Tareas completadas</label>
                    <button
                      type="button"
                      onClick={agregarTarea}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Agregar tarea
                    </button>
                  </div>
                  {formEntrega.tareasCompletadas.map((tarea, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={tarea.completado}
                        onChange={(e) => {
                          const tareas = [...formEntrega.tareasCompletadas];
                          tareas[idx].completado = e.target.checked;
                          setFormEntrega({ ...formEntrega, tareasCompletadas: tareas });
                        }}
                        className="w-4 h-4"
                      />
                      <input
                        type="text"
                        placeholder="Descripción de la tarea"
                        value={tarea.tarea}
                        onChange={(e) => {
                          const tareas = [...formEntrega.tareasCompletadas];
                          tareas[idx].tarea = e.target.value;
                          setFormEntrega({ ...formEntrega, tareasCompletadas: tareas });
                        }}
                        className="flex-1 border rounded px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => {
                          const tareas = formEntrega.tareasCompletadas.filter((_, i) => i !== idx);
                          setFormEntrega({ ...formEntrega, tareasCompletadas: tareas });
                        }}
                        className="text-red-500 hover:text-red-700 px-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setModalEntrega(false);
                    setTurnoSeleccionado(null);
                    setFormEntrega({ notasSalida: '', novedades: [], tareasCompletadas: [] });
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={hacerCheckOut}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  ✓ Finalizar Turno
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
