import {
  ConfiguracionHorarios,
  ProcesoDelDia,
  EstadoProceso,
  TipoProceso,
  Medicamento,
  RegistroMedicamento,
  ChequeoDiario,
  SignoVital,
  MenuTiempoComida,
  Actividad,
  TiempoComidaConfig,
} from '../types';

// ===== UTILIDAD TIMEZONE =====

/**
 * Obtiene la fecha en formato YYYY-MM-DD usando la zona horaria local
 * (en lugar de toISOString que convierte a UTC)
 */
function fechaLocalString(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ===== CONFIGURACIÓN DEFAULT =====

export const CONFIG_HORARIOS_DEFAULT: ConfiguracionHorarios = {
  chequeoDiario: {
    matutino: '07:00',
    vespertino: '14:00',
    nocturno: '21:00',
  },
  signosVitales: ['08:00', '18:00'],
  actualizadoEn: new Date(),
};

// ===== ICONOS POR TIPO DE PROCESO =====

const ICONOS_PROCESO: Record<TipoProceso, string> = {
  medicamento: '💊',
  chequeo: '📋',
  signosVitales: '💓',
  comida: '🍽️',
  actividad: '🎯',
};

// ===== ENLACES POR TIPO DE PROCESO =====

const ENLACES_PROCESO: Record<TipoProceso, string> = {
  medicamento: '/pastillero-diario',
  chequeo: '/chequeo-diario',
  signosVitales: '/signos-vitales',
  comida: '/menu-comida',
  actividad: '/actividades',
};

// ===== UTILIDADES DE TIEMPO =====

/**
 * Convierte una hora en formato "HH:mm" a un objeto Date para hoy
 */
export function horaStringADate(hora: string, fechaBase?: Date): Date {
  const [hh, mm] = hora.split(':').map(Number);
  const date = fechaBase ? new Date(fechaBase) : new Date();
  date.setHours(hh, mm, 0, 0);
  return date;
}

/**
 * Calcula la diferencia en minutos entre dos fechas
 */
function diferenciaMinutos(fecha1: Date, fecha2: Date): number {
  return Math.round((fecha1.getTime() - fecha2.getTime()) / (1000 * 60));
}

/**
 * Formatea la diferencia de tiempo de forma legible
 */
export function formatearDiferenciaTiempo(minutos: number): string {
  const abs = Math.abs(minutos);
  if (abs < 60) {
    return minutos > 0 ? `En ${abs} min` : `Hace ${abs} min`;
  }
  const horas = Math.floor(abs / 60);
  const mins = abs % 60;
  const horasStr = horas === 1 ? '1 hora' : `${horas} horas`;
  if (mins === 0) {
    return minutos > 0 ? `En ${horasStr}` : `Hace ${horasStr}`;
  }
  return minutos > 0 ? `En ${horasStr}` : `Hace ${horasStr}`;
}

/**
 * Determina el estado de un proceso basado en la hora actual y si está completado
 *
 * Estados:
 * - vencido: Pasó hora + 30min y no completado
 * - activo: Dentro del rango ±30min
 * - proximo: Dentro de próximos 60min
 * - pendiente: Más de 60min para la hora
 * - completado: Ya registrado
 */
export function calcularEstadoProceso(
  horaActual: Date,
  horaProgramada: Date,
  completado: boolean
): EstadoProceso {
  if (completado) {
    return 'completado';
  }

  const diff = diferenciaMinutos(horaProgramada, horaActual);

  // Si la hora programada ya pasó hace más de 30 minutos
  if (diff < -30) {
    return 'vencido';
  }

  // Si está dentro de ±30 minutos de la hora programada
  if (diff >= -30 && diff <= 30) {
    return 'activo';
  }

  // Si está dentro de los próximos 60 minutos
  if (diff > 30 && diff <= 60) {
    return 'proximo';
  }

  // Más de 60 minutos para la hora
  return 'pendiente';
}

// ===== VERIFICADORES DE COMPLETADO =====

/**
 * Verifica si los signos vitales fueron registrados para una hora específica
 * Un registro es válido si fue hecho desde 30 min antes de la hora programada en adelante
 */
function signosVitalesCompletado(
  signos: SignoVital[],
  horaProgramada: string,
  fecha: Date
): { completado: boolean; horaCompletado?: Date } {
  const hoy = fechaLocalString(fecha);
  const horaProg = horaStringADate(horaProgramada, fecha);

  // Buscar un registro de signos vitales que sea:
  // 1. Del mismo día
  // 2. Registrado desde 30 min antes de la hora programada en adelante
  const signo = signos.find(s => {
    const fechaSigno = s.fecha instanceof Date ? s.fecha : new Date(s.fecha);
    if (fechaLocalString(fechaSigno) !== hoy) return false;

    const horaSigno = horaStringADate(s.hora, fecha);
    const diffConProgramada = diferenciaMinutos(horaSigno, horaProg);

    // El registro es válido si fue hecho desde 30 min antes de la hora programada en adelante
    return diffConProgramada >= -30;
  });

  if (signo) {
    const horaSigno = horaStringADate(signo.hora, fecha);
    return { completado: true, horaCompletado: horaSigno };
  }
  return { completado: false };
}

/**
 * Verifica si un medicamento fue procesado a una hora específica
 * Un medicamento se considera procesado si su estado es 'tomado', 'rechazado' u 'omitido'
 */
function medicamentoCompletado(
  registros: RegistroMedicamento[],
  medicamentoId: string,
  horaProgramada: string,
  fecha: Date
): { completado: boolean; horaCompletado?: Date } {
  const hoy = fechaLocalString(fecha);

  // Estados que indican que el medicamento ya fue procesado (no está pendiente)
  const estadosProcesados = ['tomado', 'rechazado', 'omitido'];

  const registro = registros.find(r => {
    if (r.medicamentoId !== medicamentoId) return false;

    const fechaProg = r.fechaHoraProgramada instanceof Date
      ? r.fechaHoraProgramada
      : new Date(r.fechaHoraProgramada);
    if (fechaLocalString(fechaProg) !== hoy) return false;

    // Comparar directamente el horario si está disponible (más preciso)
    // o usar la hora de fechaHoraProgramada
    const horarioRegistro = r.horario ||
      `${String(fechaProg.getHours()).padStart(2, '0')}:${String(fechaProg.getMinutes()).padStart(2, '0')}`;

    return horarioRegistro === horaProgramada && estadosProcesados.includes(r.estado);
  });

  if (registro?.fechaHoraReal) {
    const horaReal = registro.fechaHoraReal instanceof Date
      ? registro.fechaHoraReal
      : new Date(registro.fechaHoraReal);
    return { completado: true, horaCompletado: horaReal };
  }
  if (registro) {
    return { completado: true };
  }
  return { completado: false };
}

/**
 * Verifica si una comida fue servida/completada
 */
function comidaCompletada(
  menus: MenuTiempoComida[],
  tiempoComidaId: string,
  fecha: Date
): { completado: boolean; horaCompletado?: Date } {
  const hoy = fechaLocalString(fecha);

  const menu = menus.find(m => {
    const fechaMenu = m.fecha instanceof Date ? m.fecha : new Date(m.fecha);
    // Considerar completada si tiene platillos asignados O si el estado es servido/completado
    const tienePlatillos = m.platillos && m.platillos.length > 0;
    return fechaLocalString(fechaMenu) === hoy &&
           m.tiempoComidaId === tiempoComidaId &&
           (tienePlatillos || m.estado === 'servido' || m.estado === 'completado');
  });

  if (menu) {
    const actualizado = menu.actualizadoEn instanceof Date
      ? menu.actualizadoEn
      : new Date(menu.actualizadoEn);
    return { completado: true, horaCompletado: actualizado };
  }
  return { completado: false };
}

/**
 * Verifica si una actividad fue completada
 */
function actividadCompletada(
  actividad: Actividad
): { completado: boolean; horaCompletado?: Date } {
  if (actividad.estado === 'completada') {
    const horaFin = actividad.horaFinReal instanceof Date
      ? actividad.horaFinReal
      : actividad.horaFinReal
        ? new Date(actividad.horaFinReal)
        : undefined;
    return { completado: true, horaCompletado: horaFin };
  }
  return { completado: false };
}

// ===== FUNCIÓN PRINCIPAL =====

export interface DatosParaProcesos {
  config: ConfiguracionHorarios;
  tiemposComida: TiempoComidaConfig[];
  medicamentos: Medicamento[];
  actividades: Actividad[];
  registros: {
    chequeosDiarios: ChequeoDiario[];
    signosVitales: SignoVital[];
    menusDiarios: MenuTiempoComida[];
    registrosMedicamentos: RegistroMedicamento[];
  };
}

/**
 * Calcula todos los procesos del día con sus estados
 */
export function calcularProcesosDelDia(
  horaActual: Date,
  datos: DatosParaProcesos
): ProcesoDelDia[] {
  const { config, tiemposComida, medicamentos, actividades, registros } = datos;
  const procesos: ProcesoDelDia[] = [];
  const fechaHoy = new Date(horaActual);
  fechaHoy.setHours(0, 0, 0, 0);

  // 1. SIGNOS VITALES
  config.signosVitales.forEach((hora, index) => {
    const { completado, horaCompletado } = signosVitalesCompletado(
      registros.signosVitales,
      hora,
      fechaHoy
    );
    const horaDate = horaStringADate(hora, fechaHoy);
    const estado = calcularEstadoProceso(horaActual, horaDate, completado);

    procesos.push({
      id: `signos-${index}`,
      tipo: 'signosVitales',
      nombre: 'Signos Vitales',
      detalle: `Medición ${index === 0 ? 'matutina' : 'vespertina'}`,
      horaProgramada: hora,
      horaDate,
      estado,
      horaCompletado,
      icono: ICONOS_PROCESO.signosVitales,
      enlace: ENLACES_PROCESO.signosVitales,
    });
  });

  // 3. COMIDAS
  const tiemposActivos = tiemposComida.filter(t => t.activo);
  for (const tiempo of tiemposActivos) {
    const { completado, horaCompletado } = comidaCompletada(
      registros.menusDiarios,
      tiempo.id,
      fechaHoy
    );
    const horaDate = horaStringADate(tiempo.horaDefault, fechaHoy);
    const estado = calcularEstadoProceso(horaActual, horaDate, completado);

    procesos.push({
      id: `comida-${tiempo.id}`,
      tipo: 'comida',
      nombre: tiempo.nombre,
      detalle: tiempo.icono,
      horaProgramada: tiempo.horaDefault,
      horaDate,
      estado,
      horaCompletado,
      icono: ICONOS_PROCESO.comida,
      enlace: ENLACES_PROCESO.comida,
    });
  }

  // 4. MEDICAMENTOS
  const medicamentosActivos = medicamentos.filter(m => m.activo);
  for (const med of medicamentosActivos) {
    // Verificar si el medicamento aplica hoy (por días de la semana)
    if (med.frecuencia.diasSemana && med.frecuencia.diasSemana.length > 0) {
      const diaSemana = horaActual.getDay(); // 0=domingo, 1=lunes, etc
      if (!med.frecuencia.diasSemana.includes(diaSemana)) {
        continue; // Este medicamento no aplica hoy
      }
    }

    for (const hora of med.horarios) {
      const { completado, horaCompletado } = medicamentoCompletado(
        registros.registrosMedicamentos,
        med.id,
        hora,
        fechaHoy
      );
      const horaDate = horaStringADate(hora, fechaHoy);
      const estado = calcularEstadoProceso(horaActual, horaDate, completado);

      procesos.push({
        id: `med-${med.id}-${hora}`,
        tipo: 'medicamento',
        nombre: med.nombre,
        detalle: `${med.dosis} - ${med.presentacion}`,
        horaProgramada: hora,
        horaDate,
        estado,
        horaCompletado,
        icono: ICONOS_PROCESO.medicamento,
        enlace: ENLACES_PROCESO.medicamento,
      });
    }
  }

  // 5. ACTIVIDADES (solo las del día)
  const actividadesHoy = actividades.filter(a => {
    const fechaInicio = a.fechaInicio instanceof Date ? a.fechaInicio : new Date(a.fechaInicio);
    return fechaLocalString(fechaInicio) === fechaLocalString(fechaHoy) &&
           a.estado !== 'cancelada';
  });

  for (const act of actividadesHoy) {
    const { completado, horaCompletado } = actividadCompletada(act);
    const fechaInicio = act.fechaInicio instanceof Date ? act.fechaInicio : new Date(act.fechaInicio);
    const hora = `${String(fechaInicio.getHours()).padStart(2, '0')}:${String(fechaInicio.getMinutes()).padStart(2, '0')}`;
    const estado = calcularEstadoProceso(horaActual, fechaInicio, completado);

    procesos.push({
      id: `act-${act.id}`,
      tipo: 'actividad',
      nombre: act.nombre,
      detalle: act.tipo,
      horaProgramada: hora,
      horaDate: fechaInicio,
      estado,
      horaCompletado,
      icono: ICONOS_PROCESO.actividad,
      enlace: ENLACES_PROCESO.actividad,
    });
  }

  // Ordenar por hora programada
  procesos.sort((a, b) => a.horaDate.getTime() - b.horaDate.getTime());

  return procesos;
}

/**
 * Agrupa los procesos por estado para mostrar en el dashboard
 */
export function agruparProcesosPorEstado(procesos: ProcesoDelDia[]): {
  vencidos: ProcesoDelDia[];
  activos: ProcesoDelDia[];
  proximos: ProcesoDelDia[];
  pendientes: ProcesoDelDia[];
  completados: ProcesoDelDia[];
} {
  return {
    vencidos: procesos.filter(p => p.estado === 'vencido'),
    activos: procesos.filter(p => p.estado === 'activo'),
    proximos: procesos.filter(p => p.estado === 'proximo'),
    pendientes: procesos.filter(p => p.estado === 'pendiente'),
    completados: procesos.filter(p => p.estado === 'completado'),
  };
}

/**
 * Calcula estadísticas de los procesos del día
 */
export function calcularEstadisticasProcesos(procesos: ProcesoDelDia[]): {
  total: number;
  completados: number;
  pendientes: number;
  vencidos: number;
  porcentajeCompletado: number;
} {
  const total = procesos.length;
  const completados = procesos.filter(p => p.estado === 'completado').length;
  const pendientes = procesos.filter(p => p.estado !== 'completado' && p.estado !== 'vencido').length;
  const vencidos = procesos.filter(p => p.estado === 'vencido').length;
  const porcentajeCompletado = total > 0 ? Math.round((completados / total) * 100) : 0;

  return { total, completados, pendientes, vencidos, porcentajeCompletado };
}
