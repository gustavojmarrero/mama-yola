import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import Layout from '../components/common/Layout';
import { SignoVital, ChequeoDiario, RegistroMedicamento } from '../types';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

const PACIENTE_ID = 'paciente-principal';

const COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#6b7280'];

export default function Analytics() {
  const [signosVitales, setSignosVitales] = useState<SignoVital[]>([]);
  const [chequeos, setChequeos] = useState<ChequeoDiario[]>([]);
  const [registrosMedicamentos, setRegistrosMedicamentos] = useState<RegistroMedicamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<7 | 14 | 30>(30);

  const fechaInicio = subDays(new Date(), periodo);

  // Cargar signos vitales
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'signosVitales'),
      where('fecha', '>=', Timestamp.fromDate(fechaInicio)),
      orderBy('fecha', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha?.toDate(),
        creadoEn: doc.data().creadoEn?.toDate()
      })) as SignoVital[];
      setSignosVitales(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [periodo]);

  // Cargar chequeos
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'chequeosDiarios'),
      where('fecha', '>=', Timestamp.fromDate(fechaInicio)),
      orderBy('fecha', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha?.toDate(),
        creadoEn: doc.data().creadoEn?.toDate()
      })) as ChequeoDiario[];
      setChequeos(data);
    });

    return () => unsubscribe();
  }, [periodo]);

  // Cargar registros de medicamentos
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
      where('fechaHoraProgramada', '>=', Timestamp.fromDate(fechaInicio)),
      orderBy('fechaHoraProgramada', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fechaHoraProgramada: doc.data().fechaHoraProgramada?.toDate(),
        fechaHoraReal: doc.data().fechaHoraReal?.toDate(),
        creadoEn: doc.data().creadoEn?.toDate()
      })) as RegistroMedicamento[];
      setRegistrosMedicamentos(data);
    });

    return () => unsubscribe();
  }, [periodo]);

  // Preparar datos para gráficas de signos vitales
  function datosSignosVitales() {
    const porDia: Record<string, { fecha: string; temperatura?: number; spo2?: number; fc?: number; paS?: number; paD?: number; count: number }> = {};

    signosVitales.forEach(sv => {
      if (!sv.fecha) return;
      const key = format(sv.fecha, 'yyyy-MM-dd');
      if (!porDia[key]) {
        porDia[key] = { fecha: format(sv.fecha, 'dd/MM'), count: 0 };
      }
      if (sv.temperatura) {
        porDia[key].temperatura = sv.temperatura;
      }
      if (sv.spo2) {
        porDia[key].spo2 = sv.spo2;
      }
      if (sv.frecuenciaCardiaca) {
        porDia[key].fc = sv.frecuenciaCardiaca;
      }
      if (sv.presionArterialSistolica) {
        porDia[key].paS = sv.presionArterialSistolica;
      }
      if (sv.presionArterialDiastolica) {
        porDia[key].paD = sv.presionArterialDiastolica;
      }
      porDia[key].count++;
    });

    return Object.values(porDia).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  // Datos de adherencia a medicamentos
  function datosAdherencia() {
    const total = registrosMedicamentos.length;
    if (total === 0) return { porcentaje: 0, tomados: 0, rechazados: 0, omitidos: 0, pendientes: 0 };

    const tomados = registrosMedicamentos.filter(r => r.estado === 'tomado').length;
    const rechazados = registrosMedicamentos.filter(r => r.estado === 'rechazado').length;
    const omitidos = registrosMedicamentos.filter(r => r.estado === 'omitido').length;
    const pendientes = registrosMedicamentos.filter(r => r.estado === 'pendiente').length;

    const base = tomados + rechazados + omitidos;
    const porcentaje = base > 0 ? Math.round((tomados / base) * 100) : 0;

    return { porcentaje, tomados, rechazados, omitidos, pendientes };
  }

  // Datos para gráfica de pie de medicamentos
  function datosPieMedicamentos() {
    const adherencia = datosAdherencia();
    return [
      { name: 'Tomados', value: adherencia.tomados, color: '#22c55e' },
      { name: 'Rechazados', value: adherencia.rechazados, color: '#ef4444' },
      { name: 'Omitidos', value: adherencia.omitidos, color: '#f97316' },
      { name: 'Pendientes', value: adherencia.pendientes, color: '#6b7280' }
    ].filter(d => d.value > 0);
  }

  // Datos de chequeos por día
  function datosChequeos() {
    const completados = chequeos.filter(c => c.completado).length;
    const total = chequeos.length;
    return { completados, total, porcentaje: total > 0 ? Math.round((completados / total) * 100) : 0 };
  }

  // Datos de evacuaciones
  function datosEvacuaciones() {
    const data: { fecha: string; evacuaciones: number }[] = [];

    chequeos.forEach(c => {
      if (!c.fecha) return;
      data.push({
        fecha: format(c.fecha, 'dd/MM'),
        evacuaciones: c.funcionesCorporales?.evacuacionesNumero || 0
      });
    });

    return data;
  }

  // Datos de consumo de agua
  function datosAgua() {
    const data: { fecha: string; litros: number }[] = [];

    chequeos.forEach(c => {
      if (!c.fecha) return;
      data.push({
        fecha: format(c.fecha, 'dd/MM'),
        litros: c.alimentacion?.consumoAguaLitros || 0
      });
    });

    return data;
  }

  // Resumen de signos vitales
  function resumenSignos() {
    if (signosVitales.length === 0) return null;

    const ultimo = signosVitales[signosVitales.length - 1];
    const fueraDeRango = signosVitales.filter(sv => sv.fueraDeRango).length;

    return {
      ultimaFecha: ultimo.fecha ? format(ultimo.fecha, "d 'de' MMMM, HH:mm", { locale: es }) : '-',
      temperatura: ultimo.temperatura,
      spo2: ultimo.spo2,
      fc: ultimo.frecuenciaCardiaca,
      paS: ultimo.presionArterialSistolica,
      paD: ultimo.presionArterialDiastolica,
      fueraDeRango,
      total: signosVitales.length
    };
  }

  // Incidentes
  function contarIncidentes() {
    let leves = 0, moderados = 0, graves = 0;

    chequeos.forEach(c => {
      c.incidentes?.forEach(inc => {
        if (inc.gravedad === 'leve') leves++;
        else if (inc.gravedad === 'moderada') moderados++;
        else if (inc.gravedad === 'grave') graves++;
      });
    });

    return { leves, moderados, graves, total: leves + moderados + graves };
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex justify-center items-center h-64">
          <div className="text-gray-500">Cargando analytics...</div>
        </div>
      </Layout>
    );
  }

  const adherencia = datosAdherencia();
  const chequeosData = datosChequeos();
  const resumen = resumenSignos();
  const incidentes = contarIncidentes();
  const signosData = datosSignosVitales();

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📊 Analytics y Reportes</h1>
            <p className="text-gray-600">Métricas y tendencias de salud</p>
          </div>
          <div className="flex gap-2">
            {[7, 14, 30].map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p as 7 | 14 | 30)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  periodo === p ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {p} días
              </button>
            ))}
          </div>
        </div>

        {/* Resumen principal */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Chequeos Completados</div>
            <div className="text-3xl font-bold text-blue-600">{chequeosData.completados}</div>
            <div className="text-xs text-gray-400 mt-1">
              {chequeosData.porcentaje}% de {chequeosData.total} registrados
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Signos Fuera de Rango</div>
            <div className={`text-3xl font-bold ${resumen?.fueraDeRango === 0 ? 'text-green-600' : 'text-red-600'}`}>
              {resumen?.fueraDeRango || 0}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              de {resumen?.total || 0} mediciones
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Incidentes</div>
            <div className="text-3xl font-bold text-orange-600">{incidentes.total}</div>
            <div className="text-xs text-gray-400 mt-1">
              {incidentes.graves > 0 && <span className="text-red-600">{incidentes.graves} graves</span>}
              {incidentes.moderados > 0 && <span className="text-orange-500 ml-1">{incidentes.moderados} mod.</span>}
              {incidentes.leves > 0 && <span className="text-yellow-500 ml-1">{incidentes.leves} leves</span>}
            </div>
          </div>
        </div>

        {/* Últimos signos vitales */}
        {resumen && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">🩺 Últimos Signos Vitales</h3>
            <p className="text-sm text-gray-500 mb-3">Registrado: {resumen.ultimaFecha}</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{resumen.temperatura || '-'}°C</div>
                <div className="text-xs text-gray-500">Temperatura</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{resumen.spo2 || '-'}%</div>
                <div className="text-xs text-gray-500">SpO2</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{resumen.fc || '-'}</div>
                <div className="text-xs text-gray-500">FC (lpm)</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg col-span-2">
                <div className="text-2xl font-bold text-purple-600">
                  {resumen.paS || '-'}/{resumen.paD || '-'}
                </div>
                <div className="text-xs text-gray-500">Presión Arterial (mmHg)</div>
              </div>
            </div>
          </div>
        )}

        {/* Gráficas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Presión Arterial */}
          <div className="bg-white rounded-lg shadow p-4" style={{ minWidth: 300 }}>
            <h3 className="font-semibold text-gray-900 mb-4">📈 Presión Arterial</h3>
            {signosData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={signosData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                  <YAxis domain={[60, 180]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="paS" name="Sistólica" stroke="#ef4444" fill="#fecaca" />
                  <Area type="monotone" dataKey="paD" name="Diastólica" stroke="#3b82f6" fill="#bfdbfe" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                Sin datos disponibles
              </div>
            )}
          </div>

          {/* SpO2 y FC */}
          <div className="bg-white rounded-lg shadow p-4" style={{ minWidth: 300 }}>
            <h3 className="font-semibold text-gray-900 mb-4">📈 SpO2 y Frecuencia Cardíaca</h3>
            {signosData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={signosData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" domain={[85, 100]} tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[40, 120]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="spo2" name="SpO2 (%)" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
                  <Line yAxisId="right" type="monotone" dataKey="fc" name="FC (lpm)" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                Sin datos disponibles
              </div>
            )}
          </div>

          {/* Temperatura */}
          <div className="bg-white rounded-lg shadow p-4" style={{ minWidth: 300 }}>
            <h3 className="font-semibold text-gray-900 mb-4">🌡️ Temperatura</h3>
            {signosData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={signosData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                  <YAxis domain={[35, 39]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="temperatura" name="Temperatura (°C)" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
                  {/* Líneas de referencia */}
                  <Line type="monotone" dataKey={() => 36} stroke="#22c55e" strokeDasharray="5 5" name="Mín Normal" />
                  <Line type="monotone" dataKey={() => 37.5} stroke="#ef4444" strokeDasharray="5 5" name="Máx Normal" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                Sin datos disponibles
              </div>
            )}
          </div>

          {/* Adherencia a medicamentos */}
          <div className="bg-white rounded-lg shadow p-4" style={{ minWidth: 300 }}>
            <h3 className="font-semibold text-gray-900 mb-4">💊 Distribución de Medicamentos</h3>
            {datosPieMedicamentos().length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={datosPieMedicamentos()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {datosPieMedicamentos().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                Sin datos disponibles
              </div>
            )}
          </div>

          {/* Evacuaciones */}
          <div className="bg-white rounded-lg shadow p-4" style={{ minWidth: 300 }}>
            <h3 className="font-semibold text-gray-900 mb-4">🚽 Evacuaciones Diarias</h3>
            {datosEvacuaciones().length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={datosEvacuaciones()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="evacuaciones" name="Evacuaciones" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                Sin datos disponibles
              </div>
            )}
          </div>

          {/* Consumo de agua */}
          <div className="bg-white rounded-lg shadow p-4" style={{ minWidth: 300 }}>
            <h3 className="font-semibold text-gray-900 mb-4">💧 Consumo de Agua</h3>
            {datosAgua().length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={datosAgua()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 3]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="litros" name="Litros" stroke="#3b82f6" fill="#93c5fd" />
                  {/* Línea de referencia mínimo recomendado */}
                  <Line type="monotone" dataKey={() => 1.5} stroke="#ef4444" strokeDasharray="5 5" name="Mín Recomendado" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                Sin datos disponibles
              </div>
            )}
          </div>
        </div>

        {/* Resumen de alertas */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-900 mb-4">⚠️ Resumen de Alertas ({periodo} días)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg ${resumen?.fueraDeRango ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className="text-sm font-medium">Signos Vitales</div>
              <div className={`text-lg font-bold ${resumen?.fueraDeRango ? 'text-red-600' : 'text-green-600'}`}>
                {resumen?.fueraDeRango || 0} alertas
              </div>
            </div>
            <div className={`p-4 rounded-lg ${adherencia.porcentaje < 90 ? 'bg-yellow-50' : 'bg-green-50'}`}>
              <div className="text-sm font-medium">Medicamentos</div>
              <div className={`text-lg font-bold ${adherencia.porcentaje < 90 ? 'text-yellow-600' : 'text-green-600'}`}>
                {adherencia.omitidos + adherencia.rechazados} sin tomar
              </div>
            </div>
            <div className={`p-4 rounded-lg ${incidentes.graves > 0 ? 'bg-red-50' : incidentes.total > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
              <div className="text-sm font-medium">Incidentes</div>
              <div className={`text-lg font-bold ${incidentes.graves > 0 ? 'text-red-600' : incidentes.total > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                {incidentes.total} reportados
              </div>
            </div>
            <div className={`p-4 rounded-lg ${chequeosData.porcentaje < 100 ? 'bg-yellow-50' : 'bg-green-50'}`}>
              <div className="text-sm font-medium">Chequeos</div>
              <div className={`text-lg font-bold ${chequeosData.porcentaje < 100 ? 'text-yellow-600' : 'text-green-600'}`}>
                {chequeosData.porcentaje}% completados
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
