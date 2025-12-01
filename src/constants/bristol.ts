// Escala de Bristol - Clasificación de consistencia de heces
// Desarrollada por Heaton y Lewis en la Universidad de Bristol (1997)

export type BristolType = 'bristol_1' | 'bristol_2' | 'bristol_3' | 'bristol_4' | 'bristol_5' | 'bristol_6' | 'bristol_7';

export type BristolCategoria = 'estrenimiento' | 'normal' | 'diarrea';

export interface BristolConfig {
  tipo: BristolType;
  numero: number;
  nombre: string;
  descripcion: string;
  categoria: BristolCategoria;
  indicador: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const BRISTOL_SCALE: BristolConfig[] = [
  {
    tipo: 'bristol_1',
    numero: 1,
    nombre: 'Bolitas duras',
    descripcion: 'Trozos duros separados, como nueces, difíciles de evacuar',
    categoria: 'estrenimiento',
    indicador: 'Estreñimiento severo',
    color: 'text-amber-700',
    bgColor: 'bg-amber-500',
    borderColor: 'border-amber-500',
  },
  {
    tipo: 'bristol_2',
    numero: 2,
    nombre: 'Salchicha grumosa',
    descripcion: 'Como una salchicha pero con bultos o grumos',
    categoria: 'estrenimiento',
    indicador: 'Estreñimiento leve',
    color: 'text-orange-600',
    bgColor: 'bg-orange-400',
    borderColor: 'border-orange-400',
  },
  {
    tipo: 'bristol_3',
    numero: 3,
    nombre: 'Salchicha agrietada',
    descripcion: 'Como salchicha con grietas en la superficie',
    categoria: 'normal',
    indicador: 'Normal',
    color: 'text-green-600',
    bgColor: 'bg-green-500',
    borderColor: 'border-green-500',
  },
  {
    tipo: 'bristol_4',
    numero: 4,
    nombre: 'Lisa y suave',
    descripcion: 'Como salchicha o serpiente, lisa y suave',
    categoria: 'normal',
    indicador: 'Normal ideal',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500',
    borderColor: 'border-emerald-500',
  },
  {
    tipo: 'bristol_5',
    numero: 5,
    nombre: 'Trozos blandos',
    descripcion: 'Trozos blandos con bordes definidos, fáciles de evacuar',
    categoria: 'diarrea',
    indicador: 'Falta de fibra',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-400',
    borderColor: 'border-yellow-400',
  },
  {
    tipo: 'bristol_6',
    numero: 6,
    nombre: 'Pastosa irregular',
    descripcion: 'Trozos pastosos con bordes irregulares, heces blandas',
    categoria: 'diarrea',
    indicador: 'Diarrea leve',
    color: 'text-orange-600',
    bgColor: 'bg-orange-500',
    borderColor: 'border-orange-500',
  },
  {
    tipo: 'bristol_7',
    numero: 7,
    nombre: 'Líquida',
    descripcion: 'Acuosa, sin piezas sólidas, completamente líquida',
    categoria: 'diarrea',
    indicador: 'Diarrea',
    color: 'text-red-600',
    bgColor: 'bg-red-500',
    borderColor: 'border-red-500',
  },
];

// Mapeo de valores antiguos a Bristol
export const MIGRACION_BRISTOL: Record<string, BristolType> = {
  'normal': 'bristol_4',
  'blanda': 'bristol_5',
  'dura': 'bristol_2',
  'liquida': 'bristol_7',
};

// Helper para obtener config por tipo
export function getBristolConfig(tipo: string): BristolConfig | undefined {
  return BRISTOL_SCALE.find(b => b.tipo === tipo);
}

// Helper para obtener nombre legible
export function getBristolNombre(tipo: string): string {
  const config = getBristolConfig(tipo);
  if (!config) return tipo || 'Sin registro';
  return `Tipo ${config.numero}: ${config.nombre}`;
}

// Helper para migrar valor antiguo a Bristol
export function migrarConsistenciaABristol(valor: string): BristolType | '' {
  if (!valor) return '';
  if (valor.startsWith('bristol_')) return valor as BristolType;
  return MIGRACION_BRISTOL[valor] || '';
}

// Helper para migrar a array Bristol
export function migrarABristolArray(
  consistenciaAntigua: string | undefined,
  bristolArray: string[] | undefined,
  numEvacuaciones: number
): string[] {
  // Si ya tiene el formato nuevo, usar ese
  if (bristolArray && bristolArray.length > 0) return bristolArray;

  // Si tiene formato antiguo, convertir
  if (consistenciaAntigua) {
    const bristolValue = migrarConsistenciaABristol(consistenciaAntigua);
    // Crear array con el mismo valor para todas las evacuaciones registradas
    return Array(numEvacuaciones || 1).fill(bristolValue);
  }

  return [];
}
