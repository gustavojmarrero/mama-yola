// ===== TIPOS DE USUARIOS Y AUTENTICACIÓN =====

export type Rol = 'familiar' | 'supervisor' | 'cuidador';

export interface Usuario {
  id: string;
  uid: string; // Firebase Auth UID
  nombre: string;
  email: string;
  telefono?: string;
  rol: Rol;
  foto?: string;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

// ===== TIPOS DE PACIENTE =====

export interface RangoSignosVitales {
  temperaturaMin: number;
  temperaturaMax: number;
  spo2Min: number;
  frecuenciaCardiacaMin: number;
  frecuenciaCardiacaMax: number;
  presionSistolicaMin: number;
  presionSistolicaMax: number;
  presionDiastolicaMin: number;
  presionDiastolicaMax: number;
}

export interface Paciente {
  id: string;
  nombre: string;
  fechaNacimiento: Date;
  genero: 'masculino' | 'femenino' | 'otro';
  foto?: string;
  numeroIdentificacion?: string;
  numeroSeguro?: string;
  direccion?: string;
  telefonoEmergencia?: string;
  telefonoEmergencia2?: string;
  condicionesMedicas: string[];
  alergias: string[];
  grupoSanguineo?: string;
  peso?: number;
  altura?: number;
  nivelDependencia?: 'bajo' | 'medio' | 'alto';
  notas?: string;
  seguros?: string[];
  contactosEmergencia?: string[]; // IDs de contactos
  rangoSignosVitales?: {
    presionSistolica: { min: number; max: number };
    presionDiastolica: { min: number; max: number };
    frecuenciaCardiaca: { min: number; max: number };
    temperatura: { min: number; max: number };
    saturacionO2: { min: number; max: number };
  };
  rangoNormalSignosVitales?: RangoSignosVitales;
  activo?: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

// ===== TIPOS DE SIGNOS VITALES =====

export interface SignoVital {
  id: string;
  pacienteId: string;
  fecha: Date;
  hora: string; // "14:30"
  temperatura?: number; // °C
  spo2?: number; // %
  frecuenciaCardiaca?: number; // lpm
  presionArterialSistolica?: number; // mmHg
  presionArterialDiastolica?: number; // mmHg
  notas?: string;
  fueraDeRango: boolean; // calculado
  alertaGenerada: boolean;
  registradoPor: string; // userId
  creadoEn: Date;
}

// ===== TIPOS DE CHEQUEO DIARIO =====

export type Turno = 'matutino' | 'vespertino' | 'nocturno' | '24hrs';
export type NivelDolor = 'sin_dolor' | 'leve' | 'moderado' | 'severo';
export type Gravedad = 'leve' | 'moderada' | 'grave';

export interface ChequeoDiario {
  id: string;
  pacienteId: string;
  fecha: Date;
  turno: Turno;
  cuidadorId: string;
  cuidadorNombre: string;
  horaRegistro: Date;

  // Estado general
  estadoGeneral: {
    actitud: string[]; // ['tranquila', 'activa']
    nivelActividad: string;
    nivelCooperacion: string;
    estadoSueno: string;
    dolor?: {
      nivel: NivelDolor;
      ubicacion?: string;
      descripcion?: string;
    };
    notasGenerales?: string;
  };

  // Alimentación
  alimentacion: {
    kefir?: { hora: string; cantidad: string; notas?: string };
    desayuno?: { descripcion: string; cantidad: string };
    colacion1?: { descripcion: string; cantidad: string };
    almuerzo?: { descripcion: string; cantidad: string };
    colacion2?: { descripcion: string; cantidad: string };
    cena?: { descripcion: string; cantidad: string };
    consumoAguaLitros?: number;
    otrosLiquidos?: string;
    observacionesApetito?: string;
    alimentosRechazados?: string;
  };

  // Funciones corporales
  funcionesCorporales: {
    miccionesNumero: number;
    miccionesCaracteristicas?: string;
    evacuacionesNumero: number;
    evacuacionesConsistencia?: string;
    evacuacionesColor?: string;
    dificultadEvacuar?: boolean;
    laxantesUsados?: Array<{ nombre: string; cantidad: string }>;
  };

  // Actividades realizadas
  actividadesRealizadas: {
    ejerciciosFisioterapia?: Array<{ cual: string; duracion: number }>;
    ejerciciosIntestinales?: { realizado: boolean; descripcion?: string };
    caminatas?: Array<{ tipo: 'matutina' | 'vespertina'; duracion: number }>;
    actividadesRecreativas?: string[];
    actividadesCognitivas?: string[];
    participacionActitud?: string;
  };

  // Medicación
  medicacion: {
    medicacionEnTiempoForma: boolean;
    medicamentosAdicionales?: Array<{
      nombre: string;
      dosis: string;
      motivo: string;
      hora: string;
    }>;
    medicamentosRechazados?: Array<{ nombre: string; motivo: string }>;
    observaciones?: string;
  };

  // Incidentes
  incidentes?: Array<{
    tipo: string;
    descripcion: string;
    hora: string;
    accionTomada: string;
    gravedad: Gravedad;
  }>;

  // Resumen
  resumen: {
    resumenGeneral?: string;
    observacionesImportantes?: string;
    recomendacionesSiguienteTurno?: string;
  };

  completado: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

// ===== TIPOS DE MEDICAMENTOS =====

export type EstadoMedicamento = 'pendiente' | 'tomado' | 'rechazado' | 'omitido';
export type FrecuenciaTipo = 'horas' | 'dias_especificos';

export interface Medicamento {
  id: string;
  pacienteId: string;
  nombre: string;
  dosis: string; // "500mg"
  presentacion: string; // "tableta", "jarabe", etc.
  frecuencia: {
    tipo: FrecuenciaTipo;
    valor: number; // cada 8 horas
    diasSemana?: number[]; // [1,3,5] = lun,mie,vie
  };
  horarios: string[]; // ["08:00", "16:00", "00:00"]
  instrucciones?: string; // "con alimentos"
  foto?: string;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface RegistroMedicamento {
  id: string;
  pacienteId: string;
  medicamentoId: string;
  medicamentoNombre: string;
  fechaHoraProgramada: Date;
  fechaHoraReal?: Date;
  estado: EstadoMedicamento;
  retrasoMinutos?: number; // calculado
  notas?: string;
  administradoPor?: string; // userId
  creadoEn: Date;
}

// ===== TIPOS DE NOTIFICACIONES =====

export type PrioridadNotificacion = 'alta' | 'media' | 'baja';
export type TipoNotificacion =
  | 'alerta_signos_vitales'
  | 'medicamento_pendiente'
  | 'medicamento_omitido'
  | 'inventario_bajo'
  | 'cita_proxima'
  | 'chequeo_completado'
  | 'turno_proximo'
  | 'general';

export interface Notificacion {
  id: string;
  pacienteId: string;
  usuarioId: string; // a quién va dirigida
  tipo: TipoNotificacion;
  prioridad: PrioridadNotificacion;
  titulo: string;
  mensaje: string;
  leida: boolean;
  accionUrl?: string; // URL para navegar al hacer click
  metadatos?: Record<string, unknown>; // datos adicionales
  creadoEn: Date;
}

// ===== TIPOS DE CONTACTOS =====

export type CategoriaContacto = 'medico' | 'cuidador' | 'familiar' | 'emergencia' | 'servicio' | 'otro';

export interface Contacto {
  id: string;
  pacienteId: string;
  nombre: string;
  categoria: CategoriaContacto;
  especialidad?: string; // para médicos
  cedulaProfesional?: string;
  telefonoPrincipal: string;
  telefonoAlternativo?: string;
  email?: string;
  direccion?: string;
  coordenadas?: { lat: number; lng: number };
  horarioAtencion?: string;
  consultorioHospital?: string;
  segurosAcepta?: string[];
  notas?: string;
  favorito: boolean;
  foto?: string;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

// ===== TIPOS DE EVENTOS =====

export type TipoEvento =
  | 'cita_medica'
  | 'estudio'
  | 'terapia'
  | 'visita'
  | 'evento_social'
  | 'tramite'
  | 'otro';

export type EstadoEvento =
  | 'programada'
  | 'confirmada'
  | 'en_curso'
  | 'completada'
  | 'cancelada'
  | 'reprogramada';

export interface Evento {
  id: string;
  pacienteId: string;
  titulo: string;
  tipo: TipoEvento;
  subtipo?: string;
  fechaInicio: Date;
  fechaFin: Date;
  ubicacion?: string;
  coordenadas?: { lat: number; lng: number };
  contactoId?: string; // vinculado a agenda
  contactoNombre?: string;
  descripcion?: string;
  motivoConsulta?: string;
  preparacion?: Array<{ item: string; completado: boolean }>;
  recordatorios: string[]; // ["1week", "1day", "2hours"]
  transporte?: string;
  acompanante?: string; // userId
  estado: EstadoEvento;
  confirmadoPor?: string;
  confirmadoEn?: Date;

  // Post-evento
  asistio?: boolean;
  horaLlegada?: Date;
  horaSalida?: Date;
  resultados?: string;
  diagnostico?: string;
  indicaciones?: string;
  recetaNueva?: boolean;
  cambioTratamiento?: boolean;
  proximaCita?: Date;
  costoConsulta?: number;

  creadoPor: string;
  creadoEn: Date;
  actualizadoEn: Date;
}

// ===== TIPOS DE INVENTARIO =====

export type CategoriaInventario = 'medicamento' | 'material' | 'consumible';

export interface ItemInventario {
  id: string;
  pacienteId: string;
  nombre: string;
  categoria: CategoriaInventario;

  // Cantidades por almacén
  cantidadMaestro: number;
  cantidadOperativo: number;

  // Para medicamentos
  presentacion?: string;
  fechaVencimiento?: Date;
  vinculadoPastillero?: boolean;
  medicamentoId?: string; // si está vinculado

  // Comunes
  unidad: string; // "piezas", "ml", "cajas"
  nivelMinimoMaestro: number;
  nivelMinimoOperativo: number;
  ubicacion?: string;
  notas?: string;

  creadoEn: Date;
  actualizadoEn: Date;
}

export type TipoMovimiento = 'entrada' | 'salida' | 'transferencia' | 'ajuste';
export type OrigenDestino = 'maestro' | 'operativo' | 'externo' | 'consumido';

export interface MovimientoInventario {
  id: string;
  pacienteId: string;
  tipo: TipoMovimiento;
  itemId: string;
  itemNombre: string;
  origen?: OrigenDestino;
  destino?: OrigenDestino;
  cantidad: number;
  motivo?: string;
  usuarioId: string;
  usuarioNombre: string;
  fecha: Date;
  notas?: string;
  creadoEn: Date;
}

// ===== TIPOS DE TURNOS =====

export type TipoTurno = 'matutino' | 'vespertino' | 'nocturno' | '24hrs' | 'especial';
export type EstadoTurno = 'programado' | 'confirmado' | 'activo' | 'completado' | 'cancelado';

export interface TurnoDetalle {
  id: string;
  pacienteId: string;
  cuidadorId: string;
  cuidadorNombre: string;
  fecha: Date;
  horaEntradaProgramada: string; // "07:00"
  horaSalidaProgramada: string; // "19:00"
  tipoTurno: TipoTurno;
  duracionHoras: number;
  estado: EstadoTurno;

  // Registro real
  horaEntradaReal?: Date;
  horaSalidaReal?: Date;
  horasReales?: number;
  retrasoMinutos?: number;

  // Entrega de turno
  notasEntrada?: string;
  notasSalida?: string;
  novedades?: Array<{
    tipo: string;
    descripcion: string;
    hora: string;
    gravedad: Gravedad;
  }>;
  tareasCompletadas?: Array<{ tarea: string; completado: boolean }>;

  creadoEn: Date;
  actualizadoEn: Date;
}

// ===== TIPOS DE ACTIVIDADES =====

export type TipoActividad = 'salida' | 'recreativa' | 'terapeutica' | 'social' | 'cognitiva' | 'fisica';
export type EstadoActividad = 'programada' | 'en_progreso' | 'completada' | 'cancelada';
export type NivelEnergia = 'bajo' | 'medio' | 'alto';
export type ParticipacionActividad = 'activa' | 'pasiva' | 'minima';

export interface Actividad {
  id: string;
  pacienteId: string;
  nombre: string;
  tipo: TipoActividad;
  fechaInicio: Date;
  fechaFin: Date;
  duracion: number; // minutos
  ubicacion?: string;
  descripcion?: string;
  materialesNecesarios?: string[];
  responsable?: string; // userId
  estado: EstadoActividad;
  motivoCancelacion?: string;
  nivelEnergia: NivelEnergia;

  // Post-actividad
  completadaPor?: string;
  horaInicioReal?: Date;
  horaFinReal?: Date;
  participacion?: ParticipacionActividad;
  estadoAnimo?: string;
  notas?: string;
  fotos?: string[]; // URLs Firebase Storage

  frecuencia?: {
    tipo: 'unica' | 'diaria' | 'semanal' | 'mensual';
    diasSemana?: number[];
  };

  creadoEn: Date;
  actualizadoEn: Date;
}

// ===== TIPOS DE PLANTILLAS DE ACTIVIDADES =====

export interface PlantillaActividad {
  id: string;
  pacienteId: string;
  nombre: string;
  tipo: TipoActividad;
  descripcion: string;
  duracion: number; // minutos
  ubicacion?: string;
  materialesNecesarios: string[];
  nivelEnergia: NivelEnergia;
  responsableDefault?: string;
  etiquetas: string[];
  favorita: boolean;
  foto?: string;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

// ===== TIPOS DE MENÚ =====

// Tipos legacy (mantener por compatibilidad)
export type TipoComida = 'desayuno' | 'colacion1' | 'comida' | 'colacion2' | 'cena';
export type CategoriaComida = 'entrada' | 'plato_fuerte' | 'postre' | 'bebida' | 'snack';
export type NivelConsumo = 'todo' | 'mayor_parte' | 'mitad' | 'poco' | 'nada';

// ===== NUEVOS TIPOS DE MENÚ (v2) =====

// Identificadores de tiempos de comida
export type TiempoComidaId = 'desayuno' | 'colacion_am' | 'almuerzo' | 'colacion_pm' | 'cena';

// Identificadores de componentes
export type ComponenteId = 'primer_plato' | 'segundo_plato' | 'complemento' | 'postre' | 'snack' | 'bebida';

// Configuración de un componente dentro de un tiempo de comida
export interface ComponenteConfig {
  id: ComponenteId;
  nombre: string;
  obligatorio: boolean;  // true solo para bebida
  orden: number;
}

// Configuración de un tiempo de comida con sus componentes
export interface TiempoComidaConfig {
  id: TiempoComidaId;
  nombre: string;
  horaDefault: string;
  icono: string;
  componentes: ComponenteConfig[];
  orden: number;
  activo: boolean;
}

// Habilitación flexible de receta: tiempo + componente
export interface RecetaHabilitacion {
  tiempoComidaId: TiempoComidaId;
  componenteId: ComponenteId;
}

// Platillo asignado a un componente específico
export interface PlatilloAsignado {
  componenteId: ComponenteId;
  recetaId?: string;
  recetaNombre?: string;
  nombreCustom?: string;  // Si no usa receta
  notas?: string;
  consumo?: {
    nivel: NivelConsumo;
    porcentaje: number;
    motivoRechazo?: string;
    horaServida?: Date;
    satisfaccion?: number;  // 1-5
  };
}

// Menú de un tiempo de comida para un día específico
export interface MenuTiempoComida {
  id: string;  // formato: "2025-01-15_almuerzo"
  pacienteId: string;
  fecha: Date;
  tiempoComidaId: TiempoComidaId;
  horaProgramada: string;
  platillos: PlatilloAsignado[];
  estado: 'pendiente' | 'en_preparacion' | 'servido' | 'completado';
  preparadoPor?: string;
  notas?: string;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface ValorNutricional {
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  fibra?: number;
  sodio?: number;
}

export interface ComidaProgramada {
  id: string;
  pacienteId: string;
  fecha: Date;
  tipoComida: TipoComida;
  horaProgramada: string;

  platillo: string;
  categoria: CategoriaComida;
  ingredientes?: string[];
  valorNutricional?: ValorNutricional;
  instruccionesPreparacion?: string;
  recetaId?: string; // vinculado a banco de recetas

  // Servido
  preparadoPor?: string;
  horaServida?: Date;
  temperaturaAdecuada?: boolean;
  foto?: string;

  // Consumo
  nivelConsumo?: NivelConsumo;
  porcentajeConsumido?: number;
  motivoRechazo?: string;
  notasConsumo?: string;
  satisfaccion?: number; // 1-5

  creadoEn: Date;
  actualizadoEn: Date;
}

export type TexturaComida = 'normal' | 'blanda' | 'molida' | 'licuada';

export interface RestriccionDietetica {
  pacienteId: string;
  condiciones: string[]; // ['diabetes', 'hipertension']
  alergias: string[];
  texturaRequerida: TexturaComida;
  restriccionLiquidos: boolean;
  maximoLiquidosMl?: number;
  alimentosEvitar: string[];
  alimentosConsumir: string[];
  suplementos?: Array<{ nombre: string; horario: string; cantidad: string }>;
}

// ===== TIPOS DE RECETAS =====

export interface Receta {
  id: string;
  pacienteId: string;
  nombre: string;
  // Campo legacy - mantener para compatibilidad
  categoria?: CategoriaComida;
  // Nuevo campo: habilitaciones flexibles por tiempo+componente
  habilitaciones?: RecetaHabilitacion[];
  ingredientes: string[];
  instrucciones: string;
  etiquetas: string[];
  favorita: boolean;
  foto?: string;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

// ===== TIPOS DE AUDITORÍA =====

export interface LogAuditoria {
  id: string;
  pacienteId: string;
  usuarioId: string;
  usuarioNombre: string;
  accion: string; // "crear", "editar", "eliminar", "leer"
  coleccion: string; // nombre de la colección afectada
  documentoId: string;
  cambios?: Record<string, unknown>; // qué cambió
  metadatos?: Record<string, unknown>;
  timestamp: Date;
}

// ===== TIPOS DE CONFIGURACIÓN DE HORARIOS =====

// Configuración de horarios para procesos que NO tienen horarios propios
export interface ConfiguracionHorarios {
  // Chequeo Diario - horarios por turno
  chequeoDiario: {
    matutino: string;   // "07:00"
    vespertino: string; // "14:00"
    nocturno: string;   // "21:00"
  };

  // Signos Vitales - array de horarios sugeridos
  signosVitales: string[]; // ["08:00", "18:00"]

  // Kéfir - array de horarios
  kefir: string[]; // ["06:30", "18:00"]

  actualizadoEn: Date;
}

// ===== TIPOS DE PROCESOS DEL DÍA (DASHBOARD) =====

export type EstadoProceso = 'pendiente' | 'proximo' | 'activo' | 'vencido' | 'completado';

export type TipoProceso = 'medicamento' | 'chequeo' | 'signosVitales' | 'comida' | 'kefir' | 'actividad';

// Proceso unificado para mostrar en Dashboard
export interface ProcesoDelDia {
  id: string;
  tipo: TipoProceso;
  nombre: string;
  detalle?: string;
  horaProgramada: string;
  horaDate: Date;
  estado: EstadoProceso;
  horaCompletado?: Date;
  icono: string;
  enlace: string;
}
