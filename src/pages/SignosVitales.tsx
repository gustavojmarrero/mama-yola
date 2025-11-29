import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SignoVital, Paciente } from '../types';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

const PACIENTE_ID = 'paciente-principal';

export default function SignosVitales() {
  const { userProfile } = useAuth();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [historial, setHistorial] = useState<SignoVital[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    temperatura: '',
    spo2: '',
    frecuenciaCardiaca: '',
    presionArterialSistolica: '',
    presionArterialDiastolica: '',
    notas: ''
  });

  const [alertas, setAlertas] = useState<{[key: string]: boolean}>({});

  // Hook para detectar cambios sin guardar
  const { isDirty, setIsDirty, markAsSaved } = useUnsavedChanges();
  const isInitialLoad = useRef(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  // Detectar cambios en el formulario
  useEffect(() => {
    if (!isInitialLoad.current) {
      // Verificar si hay algún valor en el formulario
      const tieneValores = formData.temperatura || formData.spo2 ||
        formData.frecuenciaCardiaca || formData.presionArterialSistolica ||
        formData.presionArterialDiastolica || formData.notas;
      setIsDirty(!!tieneValores);
    }
    isInitialLoad.current = false;
  }, [formData]);

  async function cargarDatos() {
    try {
      setLoading(true);

      // Cargar paciente
      const pacienteDoc = await getDoc(doc(db, 'pacientes', PACIENTE_ID));
      if (pacienteDoc.exists()) {
        setPaciente({ id: pacienteDoc.id, ...pacienteDoc.data() } as Paciente);
      }

      // Cargar historial (últimos 30 registros)
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'signosVitales'),
        orderBy('fecha', 'desc'),
        limit(30)
      );
      const querySnapshot = await getDocs(q);
      const signosData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fecha: data.fecha?.toDate() || new Date(),
          creadoEn: data.creadoEn?.toDate() || new Date()
        };
      }) as SignoVital[];
      setHistorial(signosData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  function validarSigno(campo: string, valor: number): boolean {
    if (!paciente?.rangoSignosVitales) return false;

    const rangos = paciente.rangoSignosVitales;
    let fueraDeRango = false;

    switch (campo) {
      case 'temperatura':
        fueraDeRango = valor < rangos.temperatura.min || valor > rangos.temperatura.max;
        break;
      case 'spo2':
        fueraDeRango = valor < rangos.saturacionO2.min || valor > rangos.saturacionO2.max;
        break;
      case 'frecuenciaCardiaca':
        fueraDeRango = valor < rangos.frecuenciaCardiaca.min || valor > rangos.frecuenciaCardiaca.max;
        break;
      case 'presionArterialSistolica':
        fueraDeRango = valor < rangos.presionSistolica.min || valor > rangos.presionSistolica.max;
        break;
      case 'presionArterialDiastolica':
        fueraDeRango = valor < rangos.presionDiastolica.min || valor > rangos.presionDiastolica.max;
        break;
    }

    return fueraDeRango;
  }

  function handleInputChange(campo: string, valor: string) {
    setFormData({ ...formData, [campo]: valor });

    // Validar en tiempo real
    if (valor && !isNaN(parseFloat(valor))) {
      const estaFuera = validarSigno(campo, parseFloat(valor));
      setAlertas({ ...alertas, [campo]: estaFuera });
    } else {
      const newAlertas = { ...alertas };
      delete newAlertas[campo];
      setAlertas(newAlertas);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!paciente) {
      alert('Primero debe crear el perfil del paciente');
      return;
    }

    try {
      setSaving(true);

      const ahora = new Date();
      const hora = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

      // Calcular si hay valores fuera de rango
      const fueraDeRango = Object.values(alertas).some(alerta => alerta);

      const signoVital: Partial<Omit<SignoVital, 'id'>> = {
        pacienteId: PACIENTE_ID,
        fecha: ahora,
        hora,
        fueraDeRango,
        alertaGenerada: fueraDeRango,
        registradoPor: userProfile?.id || '',
        creadoEn: ahora
      };

      // Solo agregar campos opcionales si tienen valor (Firebase no permite undefined)
      if (formData.temperatura) signoVital.temperatura = parseFloat(formData.temperatura);
      if (formData.spo2) signoVital.spo2 = parseFloat(formData.spo2);
      if (formData.frecuenciaCardiaca) signoVital.frecuenciaCardiaca = parseInt(formData.frecuenciaCardiaca);
      if (formData.presionArterialSistolica) signoVital.presionArterialSistolica = parseInt(formData.presionArterialSistolica);
      if (formData.presionArterialDiastolica) signoVital.presionArterialDiastolica = parseInt(formData.presionArterialDiastolica);
      if (formData.notas) signoVital.notas = formData.notas;

      await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'signosVitales'), signoVital);

      // Si está fuera de rango, crear notificación
      if (fueraDeRango) {
        const mensajeAlerta = [];
        if (alertas.temperatura) mensajeAlerta.push('temperatura');
        if (alertas.spo2) mensajeAlerta.push('saturación O2');
        if (alertas.frecuenciaCardiaca) mensajeAlerta.push('frecuencia cardíaca');
        if (alertas.presionArterialSistolica || alertas.presionArterialDiastolica) mensajeAlerta.push('presión arterial');

        await addDoc(collection(db, 'notificaciones'), {
          pacienteId: PACIENTE_ID,
          tipo: 'alerta_signos_vitales',
          titulo: '⚠️ Signos vitales fuera de rango',
          mensaje: `Los siguientes signos están fuera del rango normal: ${mensajeAlerta.join(', ')}`,
          severidad: 'alta',
          leida: false,
          fecha: ahora,
          creadoEn: ahora
        });
      }

      markAsSaved();
      alert('Signos vitales registrados exitosamente');

      // Limpiar formulario
      setFormData({
        temperatura: '',
        spo2: '',
        frecuenciaCardiaca: '',
        presionArterialSistolica: '',
        presionArterialDiastolica: '',
        notas: ''
      });
      setAlertas({});
      isInitialLoad.current = true; // Resetear flag para evitar marcar como dirty

      // Recargar historial
      cargarDatos();
    } catch (error) {
      console.error('Error guardando signos vitales:', error);
      alert('Error al guardar signos vitales');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="text-center py-12">
            <p className="text-gray-600">Cargando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!paciente) {
    return (
      <Layout>
        <div className="p-8">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Signos Vitales
            </h1>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <p className="text-yellow-800">
                Primero debe crear el perfil del paciente antes de registrar signos vitales.
              </p>
              <a
                href="/paciente"
                className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Ir a Perfil del Paciente
              </a>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Registro de Signos Vitales
            </h1>
            {/* Indicador de cambios sin guardar */}
            {isDirty && (
              <span className="text-sm text-orange-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                Cambios sin guardar
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulario de registro */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Nuevo Registro
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Temperatura */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Temperatura (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperatura}
                      onChange={(e) => handleInputChange('temperatura', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        alertas.temperatura ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder={paciente.rangoSignosVitales ?
                        `Normal: ${paciente.rangoSignosVitales.temperatura.min}-${paciente.rangoSignosVitales.temperatura.max}` :
                        ''
                      }
                    />
                    {alertas.temperatura && (
                      <p className="text-xs text-red-600 mt-1">⚠️ Fuera de rango normal</p>
                    )}
                  </div>

                  {/* Saturación O2 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Saturación O2 (%)
                    </label>
                    <input
                      type="number"
                      value={formData.spo2}
                      onChange={(e) => handleInputChange('spo2', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        alertas.spo2 ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder={paciente.rangoSignosVitales ?
                        `Normal: ${paciente.rangoSignosVitales.saturacionO2.min}-${paciente.rangoSignosVitales.saturacionO2.max}` :
                        ''
                      }
                    />
                    {alertas.spo2 && (
                      <p className="text-xs text-red-600 mt-1">⚠️ Fuera de rango normal</p>
                    )}
                  </div>

                  {/* Frecuencia Cardíaca */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frecuencia Cardíaca (bpm)
                    </label>
                    <input
                      type="number"
                      value={formData.frecuenciaCardiaca}
                      onChange={(e) => handleInputChange('frecuenciaCardiaca', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        alertas.frecuenciaCardiaca ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder={paciente.rangoSignosVitales ?
                        `Normal: ${paciente.rangoSignosVitales.frecuenciaCardiaca.min}-${paciente.rangoSignosVitales.frecuenciaCardiaca.max}` :
                        ''
                      }
                    />
                    {alertas.frecuenciaCardiaca && (
                      <p className="text-xs text-red-600 mt-1">⚠️ Fuera de rango normal</p>
                    )}
                  </div>

                  {/* Presión Sistólica */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Presión Sistólica (mmHg)
                    </label>
                    <input
                      type="number"
                      value={formData.presionArterialSistolica}
                      onChange={(e) => handleInputChange('presionArterialSistolica', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        alertas.presionArterialSistolica ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder={paciente.rangoSignosVitales ?
                        `Normal: ${paciente.rangoSignosVitales.presionSistolica.min}-${paciente.rangoSignosVitales.presionSistolica.max}` :
                        ''
                      }
                    />
                    {alertas.presionArterialSistolica && (
                      <p className="text-xs text-red-600 mt-1">⚠️ Fuera de rango normal</p>
                    )}
                  </div>

                  {/* Presión Diastólica */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Presión Diastólica (mmHg)
                    </label>
                    <input
                      type="number"
                      value={formData.presionArterialDiastolica}
                      onChange={(e) => handleInputChange('presionArterialDiastolica', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        alertas.presionArterialDiastolica ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder={paciente.rangoSignosVitales ?
                        `Normal: ${paciente.rangoSignosVitales.presionDiastolica.min}-${paciente.rangoSignosVitales.presionDiastolica.max}` :
                        ''
                      }
                    />
                    {alertas.presionArterialDiastolica && (
                      <p className="text-xs text-red-600 mt-1">⚠️ Fuera de rango normal</p>
                    )}
                  </div>
                </div>

                {/* Notas */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Observaciones adicionales..."
                  />
                </div>

                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                  >
                    {saving ? 'Guardando...' : 'Registrar Signos Vitales'}
                  </button>
                </div>
              </form>
            </div>

            {/* Rangos normales */}
            <div className="lg:col-span-1">
              <div className="bg-blue-50 rounded-lg shadow p-6 sticky top-8">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">
                  Rangos Normales
                </h3>
                {paciente.rangoSignosVitales && (
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-700">Temperatura</p>
                      <p className="text-blue-800">
                        {paciente.rangoSignosVitales.temperatura.min} - {paciente.rangoSignosVitales.temperatura.max} °C
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Saturación O2</p>
                      <p className="text-blue-800">
                        {paciente.rangoSignosVitales.saturacionO2.min} - {paciente.rangoSignosVitales.saturacionO2.max} %
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Frecuencia Cardíaca</p>
                      <p className="text-blue-800">
                        {paciente.rangoSignosVitales.frecuenciaCardiaca.min} - {paciente.rangoSignosVitales.frecuenciaCardiaca.max} bpm
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Presión Sistólica</p>
                      <p className="text-blue-800">
                        {paciente.rangoSignosVitales.presionSistolica.min} - {paciente.rangoSignosVitales.presionSistolica.max} mmHg
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Presión Diastólica</p>
                      <p className="text-blue-800">
                        {paciente.rangoSignosVitales.presionDiastolica.min} - {paciente.rangoSignosVitales.presionDiastolica.max} mmHg
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Historial */}
          <div className="mt-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Historial Reciente
              </h2>

              {historial.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No hay registros de signos vitales
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Fecha/Hora
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Temp
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          SpO2
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          FC
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          PA
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {historial.map((signo) => (
                        <tr key={signo.id} className={signo.fueraDeRango ? 'bg-red-50' : ''}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {new Date(signo.fecha).toLocaleDateString()}<br />
                            <span className="text-xs text-gray-500">{signo.hora}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {signo.temperatura ? `${signo.temperatura}°C` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {signo.spo2 ? `${signo.spo2}%` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {signo.frecuenciaCardiaca ? `${signo.frecuenciaCardiaca} bpm` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {signo.presionArterialSistolica && signo.presionArterialDiastolica
                              ? `${signo.presionArterialSistolica}/${signo.presionArterialDiastolica}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {signo.fueraDeRango ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                ⚠️ Alerta
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                ✓ Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
