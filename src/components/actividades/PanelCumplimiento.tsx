import { useState, useEffect } from 'react';
import { getEstadisticasCumplimiento } from '../../services/instanciasActividades';
import { TIPOS_ACTIVIDAD_CONFIG } from '../../types/actividades';

interface PanelCumplimientoProps {
  fechaInicio: Date;
  fechaFin: Date;
  onRefresh?: () => void;
}

interface Estadisticas {
  total: number;
  completadas: number;
  omitidas: number;
  pendientes: number;
  porcentajeCumplimiento: number;
  porTipo: {
    fisica: { completadas: number; total: number };
    cognitiva: { completadas: number; total: number };
  };
}

export default function PanelCumplimiento({
  fechaInicio,
  fechaFin,
  onRefresh,
}: PanelCumplimientoProps) {
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargarEstadisticas();
  }, [fechaInicio, fechaFin]);

  const cargarEstadisticas = async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await getEstadisticasCumplimiento(fechaInicio, fechaFin);
      setEstadisticas(stats);
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
      setError('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    cargarEstadisticas();
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !estadisticas) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="text-center py-8">
          <p className="text-gray-500 mb-3">{error || 'Sin datos disponibles'}</p>
          <button
            onClick={handleRefresh}
            className="text-lavender-600 hover:text-lavender-700 font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const getColorPorcentaje = (pct: number) => {
    if (pct >= 80) return 'text-green-600';
    if (pct >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getBgColorPorcentaje = (pct: number) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const calcularPorcentajeTipo = (tipo: 'fisica' | 'cognitiva') => {
    const stats = estadisticas.porTipo[tipo];
    if (stats.total === 0) return 0;
    return Math.round((stats.completadas / stats.total) * 100);
  };

  const fechaRangoTexto = () => {
    const formatear = (d: Date) =>
      d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

    if (fechaInicio.toDateString() === fechaFin.toDateString()) {
      return formatear(fechaInicio);
    }
    return `${formatear(fechaInicio)} - ${formatear(fechaFin)}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            Actividades Opcionales
          </h3>
          <p className="text-sm text-gray-500">{fechaRangoTexto()}</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Actualizar"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Estadísticas principales */}
      <div className="p-6">
        {/* Porcentaje de cumplimiento central */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-32 h-32">
            {/* Círculo de fondo */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={estadisticas.porcentajeCumplimiento >= 80 ? '#22c55e' : estadisticas.porcentajeCumplimiento >= 50 ? '#f59e0b' : '#ef4444'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${estadisticas.porcentajeCumplimiento * 2.83} 283`}
              />
            </svg>
            {/* Texto central */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${getColorPorcentaje(estadisticas.porcentajeCumplimiento)}`}>
                {estadisticas.porcentajeCumplimiento}%
              </span>
              <span className="text-xs text-gray-500">Realizadas</span>
            </div>
          </div>
        </div>

        {/* Grid de estadísticas - Solo para actividades opcionales (slots) */}
        <div className="grid grid-cols-3 gap-3">
          {/* Total */}
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-700">
              {estadisticas.total}
            </div>
            <div className="text-xs text-purple-600">Opcionales</div>
          </div>

          {/* Realizadas */}
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {estadisticas.completadas}
            </div>
            <div className="text-xs text-green-700">Realizadas</div>
          </div>

          {/* Sin realizar */}
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">
              {estadisticas.pendientes + estadisticas.omitidas}
            </div>
            <div className="text-xs text-gray-500">Sin realizar</div>
          </div>
        </div>

        {/* Cumplimiento por tipo */}
        <div className="mt-6 space-y-4">
          <h4 className="text-sm font-medium text-gray-700">Por Tipo de Actividad</h4>

          {/* Físicas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{TIPOS_ACTIVIDAD_CONFIG.fisica.icon}</span>
                <span className="text-sm font-medium text-gray-700">Físicas</span>
              </div>
              <span className="text-sm text-gray-600">
                {estadisticas.porTipo.fisica.completadas}/{estadisticas.porTipo.fisica.total}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBgColorPorcentaje(calcularPorcentajeTipo('fisica'))}`}
                style={{ width: `${calcularPorcentajeTipo('fisica')}%` }}
              />
            </div>
          </div>

          {/* Cognitivas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{TIPOS_ACTIVIDAD_CONFIG.cognitiva.icon}</span>
                <span className="text-sm font-medium text-gray-700">Cognitivas</span>
              </div>
              <span className="text-sm text-gray-600">
                {estadisticas.porTipo.cognitiva.completadas}/{estadisticas.porTipo.cognitiva.total}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBgColorPorcentaje(calcularPorcentajeTipo('cognitiva'))}`}
                style={{ width: `${calcularPorcentajeTipo('cognitiva')}%` }}
              />
            </div>
          </div>
        </div>

        {/* Sin datos */}
        {estadisticas.total === 0 && (
          <div className="mt-6 text-center py-6 bg-gray-50 rounded-xl">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 text-sm">
              No hay actividades programadas para este período
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
