import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Medicamento, RegistroMedicamento } from '../types';
import Layout from '../components/common/Layout';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const PACIENTE_ID = 'paciente-principal';
const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6b7280'];

interface MetricasAdherencia {
  adherenciaTotal: number;
  dosisTotal: number;
  dosisTomadas: number;
  dosisRechazadas: number;
  dosisOmitidas: number;
  dosisPendientes: number;
}

interface AdherenciaPorMedicamento {
  medicamentoNombre: string;
  adherencia: number;
  total: number;
  tomadas: number;
  rechazadas: number;
  omitidas: number;
}

interface AdherenciaPorDia {
  fecha: string;
  adherencia: number;
  total: number;
  tomadas: number;
}

export default function DashboardAdherencia() {
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState<'semana' | 'mes'>('semana');
  const [metricas, setMetricas] = useState<MetricasAdherencia>({
    adherenciaTotal: 0,
    dosisTotal: 0,
    dosisTomadas: 0,
    dosisRechazadas: 0,
    dosisOmitidas: 0,
    dosisPendientes: 0,
  });
  const [adherenciaPorMedicamento, setAdherenciaPorMedicamento] = useState<AdherenciaPorMedicamento[]>([]);
  const [adherenciaPorDia, setAdherenciaPorDia] = useState<AdherenciaPorDia[]>([]);
  const [proximaDosis, setProximaDosis] = useState<{
    medicamento: string;
    horario: string;
    minutos: number;
  } | null>(null);

  useEffect(() => {
    cargarDatos();
  }, [periodo]);

  async function cargarDatos() {
    try {
      setLoading(true);

      // Calcular fechas según el período
      const ahora = new Date();
      const fechaInicio = new Date();
      if (periodo === 'semana') {
        fechaInicio.setDate(ahora.getDate() - 7);
      } else {
        fechaInicio.setDate(ahora.getDate() - 30);
      }
      fechaInicio.setHours(0, 0, 0, 0);

      // Obtener medicamentos activos
      const qMeds = query(
        collection(db, 'pacientes', PACIENTE_ID, 'medicamentos'),
        where('activo', '==', true)
      );
      const medSnapshot = await getDocs(qMeds);
      const medicamentos = new Map<string, Medicamento>();

      medSnapshot.forEach((doc) => {
        const data = doc.data();
        medicamentos.set(doc.id, {
          id: doc.id,
          ...data,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Medicamento);
      });

      // Obtener registros del período
      const qRegs = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', fechaInicio),
        orderBy('fechaHoraProgramada', 'asc')
      );
      const regSnapshot = await getDocs(qRegs);
      const registros: RegistroMedicamento[] = [];

      regSnapshot.forEach((doc) => {
        const data = doc.data();
        registros.push({
          id: doc.id,
          ...data,
          fechaHoraProgramada: data.fechaHoraProgramada?.toDate() || new Date(),
          fechaHoraReal: data.fechaHoraReal?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
        } as RegistroMedicamento);
      });

      // Calcular métricas generales
      const dosisTotal = registros.length;
      const dosisTomadas = registros.filter((r) => r.estado === 'tomado').length;
      const dosisRechazadas = registros.filter((r) => r.estado === 'rechazado').length;
      const dosisOmitidas = registros.filter((r) => r.estado === 'omitido').length;
      const dosisPendientes = registros.filter((r) => r.estado === 'pendiente').length;

      const adherenciaTotal =
        dosisTotal > 0
          ? Math.round((dosisTomadas / (dosisTomadas + dosisRechazadas + dosisOmitidas)) * 100)
          : 0;

      setMetricas({
        adherenciaTotal: isNaN(adherenciaTotal) ? 0 : adherenciaTotal,
        dosisTotal,
        dosisTomadas,
        dosisRechazadas,
        dosisOmitidas,
        dosisPendientes,
      });

      // Calcular adherencia por medicamento
      const adherenciaMed = new Map<string, { tomadas: number; rechazadas: number; omitidas: number }>();

      registros.forEach((reg) => {
        const current = adherenciaMed.get(reg.medicamentoNombre) || {
          tomadas: 0,
          rechazadas: 0,
          omitidas: 0,
        };

        if (reg.estado === 'tomado') current.tomadas++;
        if (reg.estado === 'rechazado') current.rechazadas++;
        if (reg.estado === 'omitido') current.omitidas++;

        adherenciaMed.set(reg.medicamentoNombre, current);
      });

      const adherenciaPorMed: AdherenciaPorMedicamento[] = Array.from(adherenciaMed.entries()).map(
        ([nombre, stats]) => {
          const total = stats.tomadas + stats.rechazadas + stats.omitidas;
          const adherencia = total > 0 ? Math.round((stats.tomadas / total) * 100) : 0;
          return {
            medicamentoNombre: nombre,
            adherencia,
            total,
            tomadas: stats.tomadas,
            rechazadas: stats.rechazadas,
            omitidas: stats.omitidas,
          };
        }
      );

      setAdherenciaPorMedicamento(adherenciaPorMed);

      // Calcular adherencia por día
      const adherenciaDia = new Map<string, { tomadas: number; total: number }>();

      registros.forEach((reg) => {
        const fechaStr = reg.fechaHoraProgramada.toLocaleDateString('es-MX');
        const current = adherenciaDia.get(fechaStr) || { tomadas: 0, total: 0 };

        if (reg.estado !== 'pendiente') {
          current.total++;
          if (reg.estado === 'tomado') current.tomadas++;
        }

        adherenciaDia.set(fechaStr, current);
      });

      const adherenciaPorDiaArr: AdherenciaPorDia[] = Array.from(adherenciaDia.entries())
        .map(([fecha, stats]) => ({
          fecha,
          adherencia: stats.total > 0 ? Math.round((stats.tomadas / stats.total) * 100) : 0,
          total: stats.total,
          tomadas: stats.tomadas,
        }))
        .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

      setAdherenciaPorDia(adherenciaPorDiaArr);

      // Calcular próxima dosis
      calcularProximaDosis(medicamentos);
    } catch (error) {
      console.error('Error cargando datos de adherencia:', error);
    } finally {
      setLoading(false);
    }
  }

  function calcularProximaDosis(medicamentos: Map<string, Medicamento>) {
    const ahora = new Date();
    const diaHoy = ahora.getDay();
    let proximaDosisInfo: { medicamento: string; horario: string; minutos: number } | null = null;
    let menorDiferencia = Infinity;

    medicamentos.forEach((med) => {
      // Verificar si hoy es un día válido para este medicamento
      if (med.frecuencia.tipo === 'dias_especificos' && !med.frecuencia.diasSemana?.includes(diaHoy)) {
        return;
      }

      med.horarios.forEach((horario) => {
        const [hora, minuto] = horario.split(':').map(Number);
        const fechaHorario = new Date();
        fechaHorario.setHours(hora, minuto, 0, 0);

        if (fechaHorario > ahora) {
          const diferencia = Math.floor((fechaHorario.getTime() - ahora.getTime()) / 60000);
          if (diferencia < menorDiferencia) {
            menorDiferencia = diferencia;
            proximaDosisInfo = {
              medicamento: med.nombre,
              horario,
              minutos: diferencia,
            };
          }
        }
      });
    });

    setProximaDosis(proximaDosisInfo);
  }

  const dataPie = [
    { name: 'Tomadas', value: metricas.dosisTomadas, color: COLORS[0] },
    { name: 'Rechazadas', value: metricas.dosisRechazadas, color: COLORS[1] },
    { name: 'Omitidas', value: metricas.dosisOmitidas, color: COLORS[2] },
    { name: 'Pendientes', value: metricas.dosisPendientes, color: COLORS[3] },
  ].filter((item) => item.value > 0);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard de Adherencia</h1>
            <p className="text-gray-600 mt-1">Métricas y análisis de medicamentos</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPeriodo('semana')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                periodo === 'semana'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Última Semana
            </button>
            <button
              onClick={() => setPeriodo('mes')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                periodo === 'mes'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Último Mes
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cards de Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Adherencia Total */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Adherencia Total</h3>
                  <span className="text-2xl">📊</span>
                </div>
                <p className="text-3xl font-bold text-blue-600">{metricas.adherenciaTotal}%</p>
                <p className="text-sm text-gray-500 mt-1">
                  {metricas.dosisTomadas} de {metricas.dosisTomadas + metricas.dosisRechazadas + metricas.dosisOmitidas} dosis
                </p>
              </div>

              {/* Dosis Omitidas */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Dosis Omitidas</h3>
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-3xl font-bold text-yellow-600">{metricas.dosisOmitidas}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {periodo === 'semana' ? 'Esta semana' : 'Este mes'}
                </p>
              </div>

              {/* Dosis Rechazadas */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Dosis Rechazadas</h3>
                  <span className="text-2xl">❌</span>
                </div>
                <p className="text-3xl font-bold text-red-600">{metricas.dosisRechazadas}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {periodo === 'semana' ? 'Esta semana' : 'Este mes'}
                </p>
              </div>

              {/* Próxima Dosis */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Próxima Dosis</h3>
                  <span className="text-2xl">⏰</span>
                </div>
                {proximaDosis ? (
                  <>
                    <p className="text-xl font-bold text-gray-900">{proximaDosis.horario}</p>
                    <p className="text-sm text-gray-500 mt-1">{proximaDosis.medicamento}</p>
                    <p className="text-xs text-blue-600 mt-1">En {proximaDosis.minutos} minutos</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No hay dosis programadas hoy</p>
                )}
              </div>
            </div>

            {/* Gráficas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribución de Dosis */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución de Dosis</h3>
                {dataPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={dataPie}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {dataPie.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-gray-500 py-12">No hay datos disponibles</p>
                )}
              </div>

              {/* Adherencia por Medicamento */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Adherencia por Medicamento</h3>
                {adherenciaPorMedicamento.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={adherenciaPorMedicamento}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="medicamentoNombre" angle={-45} textAnchor="end" height={100} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="adherencia" fill="#3b82f6" name="Adherencia %" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-gray-500 py-12">No hay datos disponibles</p>
                )}
              </div>

              {/* Tendencia de Adherencia */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencia de Adherencia Diaria</h3>
                {adherenciaPorDia.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={adherenciaPorDia}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="fecha" angle={-45} textAnchor="end" height={100} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="adherencia"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Adherencia %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-gray-500 py-12">No hay datos disponibles</p>
                )}
              </div>
            </div>

            {/* Tabla Detallada */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalle por Medicamento</h3>
              {adherenciaPorMedicamento.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Medicamento</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Adherencia</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Tomadas</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Rechazadas</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Omitidas</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {adherenciaPorMedicamento.map((med, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{med.medicamentoNombre}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                med.adherencia >= 95
                                  ? 'bg-green-100 text-green-800'
                                  : med.adherencia >= 80
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {med.adherencia}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">{med.tomadas}</td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">{med.rechazadas}</td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">{med.omitidas}</td>
                          <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">{med.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No hay datos disponibles</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
