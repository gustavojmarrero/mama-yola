import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Medicamento, RegistroMedicamento, EstadoMedicamento, DosisDelDia } from '../types';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import ViewToggle from '../components/common/ViewToggle';
import DosisCard from '../components/pastillero/DosisCard';
import HistorialCard from '../components/pastillero/HistorialCard';

const PACIENTE_ID = 'paciente-principal';

export default function PastilleroDiario() {
  const { usuario, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  /**
   * Descuenta 1 unidad del inventario operativo cuando se toma un medicamento
   */
  async function descontarInventarioMedicamento(
    medicamentoId: string,
    medicamentoNombre: string
  ): Promise<void> {
    try {
      // Buscar item de inventario vinculado a este medicamento
      const qInventario = query(
        collection(db, 'pacientes', PACIENTE_ID, 'inventario'),
        where('medicamentoId', '==', medicamentoId)
      );
      const snapshot = await getDocs(qInventario);

      if (snapshot.empty) {
        console.log(`No hay item de inventario vinculado al medicamento ${medicamentoNombre}`);
        return;
      }

      const itemDoc = snapshot.docs[0];
      const item = itemDoc.data();
      const nuevaCantidadOperativo = Math.max(0, (item.cantidadOperativo || 0) - 1);
      const ahora = Timestamp.now();

      // Actualizar cantidad en inventario
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'inventario', itemDoc.id), {
        cantidadOperativo: nuevaCantidadOperativo,
        actualizadoEn: ahora,
      });

      // Registrar movimiento de salida
      await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'movimientosInventario'), {
        pacienteId: PACIENTE_ID,
        tipo: 'salida',
        itemId: itemDoc.id,
        itemNombre: item.nombre,
        origen: 'operativo',
        destino: 'consumido',
        cantidad: 1,
        motivo: 'Consumo pastillero diario',
        usuarioId: usuario?.uid || '',
        usuarioNombre: userProfile?.nombre || 'Usuario',
        fecha: ahora,
        creadoEn: ahora,
      });

      console.log(`Descontado 1 unidad de ${item.nombre} del inventario operativo`);
    } catch (error) {
      console.error('Error al descontar inventario:', error);
    }
  }
  const [dosisDelDia, setDosisDelDia] = useState<DosisDelDia[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [dosisSeleccionada, setDosisSeleccionada] = useState<DosisDelDia | null>(null);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<EstadoMedicamento>('tomado');
  const [notas, setNotas] = useState('');
  const [vistaActual, setVistaActual] = useState<'hoy' | 'historial'>('hoy');
  const [historialRegistros, setHistorialRegistros] = useState<RegistroMedicamento[]>([]);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [filtroMedicamento, setFiltroMedicamento] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [vista, setVista] = useState<'grid' | 'list'>('list');

  useEffect(() => {
    cargarDosisDelDia();
  }, []);

  async function cargarDosisDelDia() {
    try {
      setLoading(true);

      // Obtener medicamentos activos
      const qMeds = query(
        collection(db, 'pacientes', PACIENTE_ID, 'medicamentos'),
        where('activo', '==', true)
      );
      const medSnapshot = await getDocs(qMeds);
      const medicamentosActivos: Medicamento[] = [];

      medSnapshot.forEach((doc) => {
        const data = doc.data();
        medicamentosActivos.push({
          id: doc.id,
          ...data,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Medicamento);
      });

      setMedicamentos(medicamentosActivos);

      // Obtener registros del día
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      const qRegs = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', hoy),
        where('fechaHoraProgramada', '<', manana)
      );
      const regSnapshot = await getDocs(qRegs);
      const registrosMap = new Map<string, RegistroMedicamento>();

      regSnapshot.forEach((doc) => {
        const data = doc.data();
        const registro: RegistroMedicamento = {
          id: doc.id,
          ...data,
          fechaHoraProgramada: data.fechaHoraProgramada?.toDate() || new Date(),
          fechaHoraReal: data.fechaHoraReal?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
        } as RegistroMedicamento;
        const key = `${registro.medicamentoId}-${data.horario}`;
        registrosMap.set(key, registro);
      });

      // Generar dosis del día
      const dosis: DosisDelDia[] = [];
      const ahora = new Date();

      for (const med of medicamentosActivos) {
        // Verificar si hoy es un día válido para este medicamento
        const diaHoy = hoy.getDay();
        // Si tiene días específicos configurados (array no vacío), verificar si hoy es uno de esos días
        // Si diasSemana está vacío o undefined, significa "todos los días"
        if (
          med.frecuencia.tipo === 'dias_especificos' &&
          med.frecuencia.diasSemana &&
          med.frecuencia.diasSemana.length > 0 &&
          !med.frecuencia.diasSemana.includes(diaHoy)
        ) {
          continue;
        }

        for (const horario of med.horarios) {
          const [hora, minuto] = horario.split(':').map(Number);
          const fechaHoraProgramada = new Date(hoy);
          fechaHoraProgramada.setHours(hora, minuto, 0, 0);

          const key = `${med.id}-${horario}`;
          const registro = registrosMap.get(key);

          // Calcular retraso si es necesario
          let retrasoMinutos: number | undefined;
          if (!registro && ahora > fechaHoraProgramada) {
            retrasoMinutos = Math.floor((ahora.getTime() - fechaHoraProgramada.getTime()) / 60000);
          }

          dosis.push({
            medicamento: med,
            horario,
            registro,
            retrasoMinutos,
          });
        }
      }

      // Ordenar por horario
      dosis.sort((a, b) => a.horario.localeCompare(b.horario));
      setDosisDelDia(dosis);
    } catch (error) {
      console.error('Error cargando dosis del día:', error);
      alert('Error al cargar medicamentos del día');
    } finally {
      setLoading(false);
    }
  }

  async function cargarHistorial() {
    try {
      setLoading(true);

      // Obtener registros de los últimos 30 días
      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);
      hace30Dias.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', hace30Dias),
        orderBy('fechaHoraProgramada', 'desc')
      );

      const snapshot = await getDocs(q);
      const registros: RegistroMedicamento[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        registros.push({
          id: doc.id,
          ...data,
          fechaHoraProgramada: data.fechaHoraProgramada?.toDate() || new Date(),
          fechaHoraReal: data.fechaHoraReal?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
        } as RegistroMedicamento);
      });

      setHistorialRegistros(registros);
    } catch (error) {
      console.error('Error cargando historial:', error);
      alert('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }

  async function abrirModal(dosis: DosisDelDia) {
    setDosisSeleccionada(dosis);
    setEstadoSeleccionado('tomado');
    setNotas('');
    setModalAbierto(true);
  }

  async function registrarAdministracion() {
    if (!dosisSeleccionada || !usuario) return;

    try {
      setLoading(true);

      const ahora = new Date();
      const [hora, minuto] = dosisSeleccionada.horario.split(':').map(Number);
      const fechaHoraProgramada = new Date();
      fechaHoraProgramada.setHours(hora, minuto, 0, 0);

      // Calcular retraso
      let retrasoMinutos: number | undefined;
      if (estadoSeleccionado === 'tomado') {
        retrasoMinutos = Math.floor((ahora.getTime() - fechaHoraProgramada.getTime()) / 60000);
      }

      const registroData = {
        pacienteId: PACIENTE_ID,
        medicamentoId: dosisSeleccionada.medicamento.id,
        medicamentoNombre: dosisSeleccionada.medicamento.nombre,
        fechaHoraProgramada,
        fechaHoraReal: estadoSeleccionado === 'tomado' ? ahora : undefined,
        estado: estadoSeleccionado,
        retrasoMinutos,
        notas: notas || undefined,
        administradoPor: usuario.uid,
        horario: dosisSeleccionada.horario,
        creadoEn: ahora,
      };

      if (dosisSeleccionada.registro) {
        // Actualizar registro existente
        const regRef = doc(
          db,
          'pacientes',
          PACIENTE_ID,
          'registroMedicamentos',
          dosisSeleccionada.registro.id
        );
        await updateDoc(regRef, {
          ...registroData,
          actualizadoEn: ahora,
        });
      } else {
        // Crear nuevo registro
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'), registroData);
      }

      // Descontar del inventario si el medicamento fue tomado
      if (estadoSeleccionado === 'tomado') {
        await descontarInventarioMedicamento(
          dosisSeleccionada.medicamento.id,
          dosisSeleccionada.medicamento.nombre
        );
      }

      alert('Administración registrada exitosamente');
      setModalAbierto(false);
      setDosisSeleccionada(null);
      setNotas('');
      cargarDosisDelDia();
    } catch (error) {
      console.error('Error registrando administración:', error);
      alert('Error al registrar administración');
    } finally {
      setLoading(false);
    }
  }

  function renderVistaDia() {
    if (dosisDelDia.length === 0) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
          </svg>
          <p className="text-gray-500 text-lg">No hay medicamentos programados para hoy</p>
        </div>
      );
    }

    return (
      <div
        className={
          vista === 'grid'
            ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
            : 'space-y-4'
        }
      >
        {dosisDelDia.map((dosis, index) => (
          <DosisCard
            key={`${dosis.medicamento.id}-${dosis.horario}-${index}`}
            dosis={dosis}
            viewMode={vista}
            onRegistrar={abrirModal}
          />
        ))}
      </div>
    );
  }

  function renderHistorial() {
    const registrosFiltrados = historialRegistros.filter((reg) => {
      if (filtroMedicamento !== 'todos' && reg.medicamentoId !== filtroMedicamento) return false;
      if (filtroEstado !== 'todos' && reg.estado !== filtroEstado) return false;
      return true;
    });

    return (
      <div className="space-y-6">
        {/* Filtros */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medicamento:</label>
              <select
                value={filtroMedicamento}
                onChange={(e) => setFiltroMedicamento(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos</option>
                {medicamentos.map((med) => (
                  <option key={med.id} value={med.id}>
                    {med.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado:</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos</option>
                <option value="tomado">Tomado</option>
                <option value="rechazado">Rechazado</option>
                <option value="omitido">Omitido</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista/Grid */}
        {registrosFiltrados.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-gray-500 text-lg">No hay registros en el historial</p>
          </div>
        ) : (
          <div
            className={
              vista === 'grid'
                ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                : 'space-y-4'
            }
          >
            {registrosFiltrados.map((reg) => (
              <HistorialCard key={reg.id} registro={reg} viewMode={vista} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pastillero Diario</h1>
            <p className="text-gray-600 mt-1">Control de administración de medicamentos</p>
          </div>
          <div className="flex items-center gap-3">
            <ViewToggle view={vista} onChange={setVista} />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setVistaActual('hoy');
                  cargarDosisDelDia();
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  vistaActual === 'hoy'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => {
                  setVistaActual('historial');
                  cargarHistorial();
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  vistaActual === 'historial'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Historial
              </button>
            </div>
          </div>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Cargando...</p>
          </div>
        ) : vistaActual === 'hoy' ? (
          renderVistaDia()
        ) : (
          renderHistorial()
        )}

        {/* Modal de Registro */}
        {modalAbierto && dosisSeleccionada && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Registrar Administración</h2>

              <div className="mb-4">
                <p className="text-lg font-semibold text-gray-900">
                  {dosisSeleccionada.medicamento.nombre}
                </p>
                <p className="text-gray-600">
                  {dosisSeleccionada.medicamento.dosis} - {dosisSeleccionada.horario}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado *</label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setEstadoSeleccionado('tomado')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      estadoSeleccionado === 'tomado'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Tomado
                  </button>
                  <button
                    onClick={() => setEstadoSeleccionado('rechazado')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      estadoSeleccionado === 'rechazado'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Rechazado
                  </button>
                  <button
                    onClick={() => setEstadoSeleccionado('omitido')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      estadoSeleccionado === 'omitido'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Omitido
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Observaciones o motivo..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={registrarAdministracion}
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => {
                    setModalAbierto(false);
                    setDosisSeleccionada(null);
                  }}
                  disabled={loading}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
