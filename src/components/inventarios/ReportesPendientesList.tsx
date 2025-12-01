import { useState } from 'react';
import { ReporteDiferencia } from '../../types';
import ResolucionReporteModal from './ResolucionReporteModal';

interface ReportesPendientesListProps {
  reportes: ReporteDiferencia[];
  puedeResolver: boolean;
  onAprobar: (
    reporteId: string,
    notas: string,
    ajustarInventario: boolean
  ) => Promise<void>;
  onRechazar: (reporteId: string, notas: string) => Promise<void>;
}

const LABELS_TIPO: Record<string, string> = {
  maestro: 'Maestro',
  transito: 'Tránsito',
  operativo: 'Operativo',
};

export default function ReportesPendientesList({
  reportes,
  puedeResolver,
  onAprobar,
  onRechazar,
}: ReportesPendientesListProps) {
  const [reporteSeleccionado, setReporteSeleccionado] =
    useState<ReporteDiferencia | null>(null);

  if (reportes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No hay reportes pendientes</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {reportes.map((reporte) => {
          const fechaReporte =
            reporte.creadoEn instanceof Date
              ? reporte.creadoEn.toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

          return (
            <div
              key={reporte.id}
              className={`border rounded-lg p-4 ${
                reporte.diferencia < 0
                  ? 'border-red-200 bg-red-50'
                  : 'border-green-200 bg-green-50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 truncate">
                      {reporte.itemNombre}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                      {LABELS_TIPO[reporte.tipoInventario]}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>
                      Sistema: <strong>{reporte.cantidadRegistrada}</strong>
                    </span>
                    <span>
                      Real: <strong>{reporte.cantidadReal}</strong>
                    </span>
                    <span
                      className={`font-bold ${
                        reporte.diferencia > 0
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}
                    >
                      {reporte.diferencia > 0 ? '+' : ''}
                      {reporte.diferencia}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mt-2 line-clamp-1">
                    {reporte.motivo}
                  </p>

                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    <span>{reporte.reportadoPorNombre}</span>
                    <span>&bull;</span>
                    <span>{fechaReporte}</span>
                  </div>
                </div>

                {puedeResolver && (
                  <button
                    onClick={() => setReporteSeleccionado(reporte)}
                    className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Resolver
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de resolución */}
      {reporteSeleccionado && (
        <ResolucionReporteModal
          isOpen={true}
          onClose={() => setReporteSeleccionado(null)}
          reporte={reporteSeleccionado}
          onAprobar={async (notas, ajustar) => {
            await onAprobar(reporteSeleccionado.id, notas, ajustar);
            setReporteSeleccionado(null);
          }}
          onRechazar={async (notas) => {
            await onRechazar(reporteSeleccionado.id, notas);
            setReporteSeleccionado(null);
          }}
        />
      )}
    </>
  );
}
