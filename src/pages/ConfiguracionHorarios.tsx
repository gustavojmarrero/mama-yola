import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Link } from 'react-router-dom';
import Layout from '../components/common/Layout';
import { ConfiguracionHorarios as ConfiguracionHorariosType } from '../types';
import { CONFIG_HORARIOS_DEFAULT } from '../utils/procesosDelDia';

const PACIENTE_ID = 'paciente-principal';

// Generar opciones de hora (cada 30 minutos)
function generarOpcionesHora(): string[] {
  const opciones: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      opciones.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opciones;
}

const OPCIONES_HORA = generarOpcionesHora();

interface HoraSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

function HoraSelector({ value, onChange, label }: HoraSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm text-gray-600 w-32">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {OPCIONES_HORA.map((hora) => (
          <option key={hora} value={hora}>
            {hora}
          </option>
        ))}
      </select>
    </div>
  );
}

interface HoraChipProps {
  hora: string;
  onRemove: () => void;
  onChange: (value: string) => void;
}

function HoraChip({ hora, onRemove, onChange }: HoraChipProps) {
  return (
    <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
      <select
        value={hora}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border-none text-sm font-medium text-blue-700 focus:ring-0 cursor-pointer"
      >
        {OPCIONES_HORA.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <button
        onClick={onRemove}
        className="text-blue-400 hover:text-red-500 transition-colors"
        title="Eliminar"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function ConfiguracionHorarios() {
  const [config, setConfig] = useState<ConfiguracionHorariosType>(CONFIG_HORARIOS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  async function cargarConfiguracion() {
    try {
      const docRef = doc(db, 'pacientes', PACIENTE_ID, 'configuracion', 'horarios');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig({
          chequeoDiario: data.chequeoDiario || CONFIG_HORARIOS_DEFAULT.chequeoDiario,
          signosVitales: data.signosVitales || CONFIG_HORARIOS_DEFAULT.signosVitales,
          kefir: data.kefir || CONFIG_HORARIOS_DEFAULT.kefir,
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        });
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
      setMensaje({ tipo: 'error', texto: 'Error al cargar la configuración' });
    } finally {
      setLoading(false);
    }
  }

  async function guardarConfiguracion() {
    setSaving(true);
    try {
      const docRef = doc(db, 'pacientes', PACIENTE_ID, 'configuracion', 'horarios');
      await setDoc(docRef, {
        ...config,
        actualizadoEn: Timestamp.now(),
      });
      setMensaje({ tipo: 'exito', texto: 'Configuración guardada correctamente' });
      setHasChanges(false);
      setTimeout(() => setMensaje(null), 3000);
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      setMensaje({ tipo: 'error', texto: 'Error al guardar la configuración' });
    } finally {
      setSaving(false);
    }
  }

  function actualizarChequeo(turno: 'matutino' | 'vespertino' | 'nocturno', hora: string) {
    setConfig((prev) => ({
      ...prev,
      chequeoDiario: {
        ...prev.chequeoDiario,
        [turno]: hora,
      },
    }));
    setHasChanges(true);
  }

  function agregarHora(campo: 'signosVitales' | 'kefir') {
    setConfig((prev) => ({
      ...prev,
      [campo]: [...prev[campo], '12:00'],
    }));
    setHasChanges(true);
  }

  function actualizarHora(campo: 'signosVitales' | 'kefir', index: number, hora: string) {
    setConfig((prev) => ({
      ...prev,
      [campo]: prev[campo].map((h, i) => (i === index ? hora : h)),
    }));
    setHasChanges(true);
  }

  function eliminarHora(campo: 'signosVitales' | 'kefir', index: number) {
    if (config[campo].length <= 1) {
      setMensaje({ tipo: 'error', texto: 'Debe haber al menos un horario' });
      setTimeout(() => setMensaje(null), 3000);
      return;
    }
    setConfig((prev) => ({
      ...prev,
      [campo]: prev[campo].filter((_, i) => i !== index),
    }));
    setHasChanges(true);
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-4 md:p-8">
          <div className="max-w-3xl mx-auto">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Configuración de Horarios
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Ajusta los horarios sugeridos para cada proceso de cuidado
              </p>
            </div>
            <button
              onClick={guardarConfiguracion}
              disabled={saving || !hasChanges}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                hasChanges
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          {/* Mensaje */}
          {mensaje && (
            <div
              className={`mb-4 p-3 rounded-lg ${
                mensaje.tipo === 'exito'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {mensaje.texto}
            </div>
          )}

          <div className="space-y-4">
            {/* Chequeo Diario */}
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">📋</span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Chequeo Diario</h2>
                  <p className="text-sm text-gray-500">Horarios sugeridos por turno</p>
                </div>
              </div>
              <div className="space-y-3">
                <HoraSelector
                  label="Turno Matutino:"
                  value={config.chequeoDiario.matutino}
                  onChange={(hora) => actualizarChequeo('matutino', hora)}
                />
                <HoraSelector
                  label="Turno Vespertino:"
                  value={config.chequeoDiario.vespertino}
                  onChange={(hora) => actualizarChequeo('vespertino', hora)}
                />
                <HoraSelector
                  label="Turno Nocturno:"
                  value={config.chequeoDiario.nocturno}
                  onChange={(hora) => actualizarChequeo('nocturno', hora)}
                />
              </div>
            </div>

            {/* Signos Vitales */}
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">💓</span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Signos Vitales</h2>
                  <p className="text-sm text-gray-500">Horarios de medición sugeridos</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {config.signosVitales.map((hora, index) => (
                  <HoraChip
                    key={index}
                    hora={hora}
                    onChange={(h) => actualizarHora('signosVitales', index, h)}
                    onRemove={() => eliminarHora('signosVitales', index)}
                  />
                ))}
                <button
                  onClick={() => agregarHora('signosVitales')}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  + Agregar
                </button>
              </div>
            </div>

            {/* Kéfir */}
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🥛</span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Kéfir</h2>
                  <p className="text-sm text-gray-500">Horarios de administración</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {config.kefir.map((hora, index) => (
                  <HoraChip
                    key={index}
                    hora={hora}
                    onChange={(h) => actualizarHora('kefir', index, h)}
                    onRemove={() => eliminarHora('kefir', index)}
                  />
                ))}
                <button
                  onClick={() => agregarHora('kefir')}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  + Agregar
                </button>
              </div>
            </div>

            {/* Sección informativa - Comidas */}
            <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-amber-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🍽️</span>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Comidas</h2>
                    <p className="text-sm text-gray-500">
                      Los horarios de comidas se configuran desde el módulo de Menú
                    </p>
                  </div>
                </div>
                <Link
                  to="/menu-comida"
                  className="px-3 py-2 text-sm bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors font-medium"
                >
                  Ir a Menú →
                </Link>
              </div>
            </div>

            {/* Sección informativa - Medicamentos */}
            <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-purple-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💊</span>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Medicamentos</h2>
                    <p className="text-sm text-gray-500">
                      Cada medicamento tiene sus propios horarios configurados
                    </p>
                  </div>
                </div>
                <Link
                  to="/medicamentos"
                  className="px-3 py-2 text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors font-medium"
                >
                  Ir a Medicamentos →
                </Link>
              </div>
            </div>

            {/* Sección informativa - Actividades */}
            <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-green-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Actividades</h2>
                    <p className="text-sm text-gray-500">
                      Cada actividad tiene su propio horario programado
                    </p>
                  </div>
                </div>
                <Link
                  to="/actividades"
                  className="px-3 py-2 text-sm bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors font-medium"
                >
                  Ir a Actividades →
                </Link>
              </div>
            </div>
          </div>

          {/* Botón inferior */}
          <div className="mt-6 flex justify-end">
            <Link
              to="/"
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Volver al Dashboard
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
