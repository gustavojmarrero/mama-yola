import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, Timestamp, updateDoc, doc, limit, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow, addDays, startOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import Layout from '../components/common/Layout';
import { DashboardSkeleton } from '../components/common/Skeleton';
import { useTransito } from '../hooks/useTransito';
import { useReportesDiferencia } from '../hooks/useReportesDiferencia';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Evento,
  Contacto,
  SignoVital,
  RegistroMedicamento,
  ChequeoDiario,
  Medicamento,
  Actividad,
  MenuTiempoComida,
  ConfiguracionHorarios,
  TiempoComidaConfig,
  ProcesoDelDia,
} from '../types';
import ProcesoCard, { ProcesoGrupo } from '../components/dashboard/ProcesoCard';
import { getBristolNombre } from '../constants/bristol';
import {
  calcularProcesosDelDia,
  agruparProcesosPorEstado,
  CONFIG_HORARIOS_DEFAULT,
} from '../utils/procesosDelDia';

const PACIENTE_ID = 'paciente-principal';

interface DashboardMetrics {
  adherenciaMedicamentos: number;
  signosVitalesHoy: SignoVital | null;
  medicamentosPendientes: number;
  ultimoChequeo: ChequeoDiario | null;
  alertasActivas: number;
}

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const { itemsTransito, itemsConStockBajo, loading: loadingTransito } = useTransito();
  const { reportesPendientes, contadorPendientes } = useReportesDiferencia();

  // Control de permisos
  const puedeResolverReportes = userProfile?.rol === 'familiar' || userProfile?.rol === 'supervisor';
  const [proximasCitas, setProximasCitas] = useState<Evento[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    adherenciaMedicamentos: 0,
    signosVitalesHoy: null,
    medicamentosPendientes: 0,
    ultimoChequeo: null,
    alertasActivas: 0
  });
  const [loading, setLoading] = useState(true);
  const [procesos, setProcesos] = useState<ProcesoDelDia[]>([]);
  const [horaActual, setHoraActual] = useState(new Date());

  // Datos del día para PDF
  const [datosDelDia, setDatosDelDia] = useState<{
    chequeos: ChequeoDiario[];
    signosVitales: SignoVital[];
    menus: MenuTiempoComida[];
    medicamentos: RegistroMedicamento[];
    actividades: Actividad[];
  }>({
    chequeos: [],
    signosVitales: [],
    menus: [],
    medicamentos: [],
    actividades: [],
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  // Actualizar hora cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setHoraActual(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  async function cargarDatos() {
    try {
      await Promise.all([
        cargarProximasCitas(),
        cargarContactos(),
        cargarMetricas(),
        cargarProcesosDelDia()
      ]);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  }

  async function cargarProcesosDelDia() {
    try {
      const hoy = startOfDay(new Date());
      const manana = addDays(hoy, 1);

      // 1. Cargar configuración de horarios
      const configDoc = await getDoc(doc(db, 'pacientes', PACIENTE_ID, 'configuracion', 'horarios'));
      const config: ConfiguracionHorarios = configDoc.exists()
        ? {
            chequeoDiario: configDoc.data().chequeoDiario || CONFIG_HORARIOS_DEFAULT.chequeoDiario,
            signosVitales: configDoc.data().signosVitales || CONFIG_HORARIOS_DEFAULT.signosVitales,
            kefir: configDoc.data().kefir || CONFIG_HORARIOS_DEFAULT.kefir,
            actualizadoEn: configDoc.data().actualizadoEn?.toDate() || new Date(),
          }
        : CONFIG_HORARIOS_DEFAULT;

      // 2. Cargar tiempos de comida config
      const tiemposComidaDoc = await getDoc(doc(db, 'pacientes', PACIENTE_ID, 'configuracion', 'tiemposComida'));
      const tiemposComida: TiempoComidaConfig[] = tiemposComidaDoc.exists()
        ? tiemposComidaDoc.data().tiempos || []
        : [];

      // 3. Cargar medicamentos activos
      const qMeds = query(
        collection(db, 'pacientes', PACIENTE_ID, 'medicamentos'),
        where('activo', '==', true)
      );
      const medsSnap = await getDocs(qMeds);
      const medicamentos: Medicamento[] = medsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Medicamento[];

      // 4. Cargar actividades del día
      const qActs = query(
        collection(db, 'pacientes', PACIENTE_ID, 'actividades'),
        where('fechaInicio', '>=', Timestamp.fromDate(hoy)),
        where('fechaInicio', '<', Timestamp.fromDate(manana))
      );
      const actsSnap = await getDocs(qActs);
      const actividades: Actividad[] = actsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          fechaInicio: data.fechaInicio?.toDate() || new Date(),
          fechaFin: data.fechaFin?.toDate() || new Date(),
          horaInicioReal: data.horaInicioReal?.toDate(),
          horaFinReal: data.horaFinReal?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Actividad;
      });

      // 5. Cargar registros del día: chequeos
      const qChequeos = query(
        collection(db, 'pacientes', PACIENTE_ID, 'chequeosDiarios'),
        where('fecha', '>=', Timestamp.fromDate(hoy)),
        where('fecha', '<', Timestamp.fromDate(manana))
      );
      const chequeosSnap = await getDocs(qChequeos);
      const chequeosDiarios: ChequeoDiario[] = chequeosSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          fecha: data.fecha?.toDate() || new Date(),
          horaRegistro: data.horaRegistro?.toDate() || new Date(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as ChequeoDiario;
      });

      // 6. Cargar signos vitales del día
      const qSignos = query(
        collection(db, 'pacientes', PACIENTE_ID, 'signosVitales'),
        where('fecha', '>=', Timestamp.fromDate(hoy)),
        where('fecha', '<', Timestamp.fromDate(manana))
      );
      const signosSnap = await getDocs(qSignos);
      const signosVitales: SignoVital[] = signosSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          fecha: data.fecha?.toDate() || new Date(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
        } as SignoVital;
      });

      // 7. Cargar menús del día
      const qMenus = query(
        collection(db, 'pacientes', PACIENTE_ID, 'menusDiarios'),
        where('fecha', '>=', Timestamp.fromDate(hoy)),
        where('fecha', '<', Timestamp.fromDate(manana))
      );
      const menusSnap = await getDocs(qMenus);
      const menusDiarios: MenuTiempoComida[] = menusSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          fecha: data.fecha?.toDate() || new Date(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as MenuTiempoComida;
      });

      // 8. Cargar registros de medicamentos del día
      const qRegMeds = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', Timestamp.fromDate(hoy)),
        where('fechaHoraProgramada', '<', Timestamp.fromDate(manana))
      );
      const regMedsSnap = await getDocs(qRegMeds);
      const registrosMedicamentos: RegistroMedicamento[] = regMedsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          fechaHoraProgramada: data.fechaHoraProgramada?.toDate() || new Date(),
          fechaHoraReal: data.fechaHoraReal?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
        } as RegistroMedicamento;
      });

      // Calcular procesos
      const procesosCalculados = calcularProcesosDelDia(new Date(), {
        config,
        tiemposComida,
        medicamentos,
        actividades,
        registros: {
          chequeosDiarios,
          signosVitales,
          menusDiarios,
          registrosMedicamentos,
        },
      });

      setProcesos(procesosCalculados);

      // Guardar datos del día para PDF
      setDatosDelDia({
        chequeos: chequeosDiarios,
        signosVitales,
        menus: menusDiarios,
        medicamentos: registrosMedicamentos,
        actividades,
      });
    } catch (error) {
      console.error('Error al cargar procesos del día:', error);
    }
  }

  async function cargarMetricas() {
    try {
      const hoy = startOfDay(new Date());
      const hace7Dias = subDays(hoy, 7);

      // Signos vitales de hoy
      const qSignos = query(
        collection(db, 'pacientes', PACIENTE_ID, 'signosVitales'),
        where('fecha', '>=', Timestamp.fromDate(hoy)),
        orderBy('fecha', 'desc'),
        limit(1)
      );
      const signosSnap = await getDocs(qSignos);
      const signoHoy = signosSnap.docs[0]?.data() as SignoVital | undefined;

      // Medicamentos de hoy
      const qMeds = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', Timestamp.fromDate(hoy)),
        where('fechaHoraProgramada', '<=', Timestamp.fromDate(addDays(hoy, 1)))
      );
      const medsSnap = await getDocs(qMeds);
      const pendientes = medsSnap.docs.filter(d => d.data().estado === 'pendiente').length;

      // Adherencia últimos 7 días
      const qAdherencia = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', Timestamp.fromDate(hace7Dias))
      );
      const adherenciaSnap = await getDocs(qAdherencia);
      const tomados = adherenciaSnap.docs.filter(d => d.data().estado === 'tomado').length;
      const total = adherenciaSnap.docs.filter(d => ['tomado', 'rechazado', 'omitido'].includes(d.data().estado)).length;
      const adherencia = total > 0 ? Math.round((tomados / total) * 100) : 100;

      // Último chequeo
      const qChequeo = query(
        collection(db, 'pacientes', PACIENTE_ID, 'chequeosDiarios'),
        orderBy('fecha', 'desc'),
        limit(1)
      );
      const chequeoSnap = await getDocs(qChequeo);
      const ultimoChequeo = chequeoSnap.docs[0]?.data() as ChequeoDiario | undefined;

      // Alertas (signos fuera de rango en últimos 7 días)
      const qAlertas = query(
        collection(db, 'pacientes', PACIENTE_ID, 'signosVitales'),
        where('fecha', '>=', Timestamp.fromDate(hace7Dias)),
        where('fueraDeRango', '==', true)
      );
      const alertasSnap = await getDocs(qAlertas);

      setMetrics({
        adherenciaMedicamentos: adherencia,
        signosVitalesHoy: signoHoy ? { ...signoHoy, fecha: signoHoy.fecha } as SignoVital : null,
        medicamentosPendientes: pendientes,
        ultimoChequeo: ultimoChequeo ? { ...ultimoChequeo, fecha: ultimoChequeo.fecha } as ChequeoDiario : null,
        alertasActivas: alertasSnap.docs.length
      });
    } catch (error) {
      console.error('Error al cargar métricas:', error);
    }
  }

  async function cargarProximasCitas() {
    try {
      const ahora = startOfDay(new Date());
      const enUnaSemana = addDays(ahora, 7);

      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'eventos'),
        where('fechaInicio', '>=', Timestamp.fromDate(ahora)),
        where('fechaInicio', '<=', Timestamp.fromDate(enUnaSemana)),
        where('estado', 'in', ['programada', 'confirmada']),
        orderBy('fechaInicio', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const eventos: Evento[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        eventos.push({
          id: doc.id,
          ...data,
          fechaInicio: data.fechaInicio?.toDate() || new Date(),
          fechaFin: data.fechaFin?.toDate() || new Date(),
          confirmadoEn: data.confirmadoEn?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Evento);
      });

      setProximasCitas(eventos);
    } catch (error) {
      console.error('Error al cargar próximas citas:', error);
    }
  }

  async function cargarContactos() {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'contactos'),
        where('activo', '==', true),
        where('favorito', '==', true)
      );

      const querySnapshot = await getDocs(q);
      const contactosData: Contacto[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        contactosData.push({
          id: doc.id,
          ...data,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Contacto);
      });

      setContactos(contactosData.slice(0, 5));
    } catch (error) {
      console.error('Error al cargar contactos:', error);
    }
  }

  async function confirmarCita(evento: Evento) {
    try {
      await updateDoc(doc(db, 'pacientes', PACIENTE_ID, 'eventos', evento.id), {
        estado: 'confirmada',
        confirmadoPor: currentUser?.uid,
        confirmadoEn: Timestamp.now(),
        actualizadoEn: Timestamp.now(),
      });
      cargarProximasCitas();
    } catch (error) {
      console.error('Error al confirmar cita:', error);
    }
  }

  function getFechaTexto(fecha: Date) {
    if (isToday(fecha)) {
      return 'Hoy';
    } else if (isTomorrow(fecha)) {
      return 'Mañana';
    } else {
      return format(fecha, "EEE d MMM", { locale: es });
    }
  }

  function getTipoIcono(tipo: string) {
    const iconos: Record<string, string> = {
      cita_medica: '🏥',
      estudio: '🔬',
      terapia: '💆',
      visita: '👨‍👩‍👧',
      evento_social: '🎉',
      tramite: '📄',
      otro: '📅',
    };
    return iconos[tipo] || '📅';
  }

  // Función para exportar resumen del día a PDF
  async function exportarResumenDia() {
    // Obtener medicamentos desde procesos (incluye pendientes y completados)
    const procesosMedicamentos = procesos.filter(p => p.tipo === 'medicamento');

    // Verificar si hay datos para exportar
    const hayDatos =
      datosDelDia.chequeos.length > 0 ||
      datosDelDia.signosVitales.length > 0 ||
      datosDelDia.menus.length > 0 ||
      procesosMedicamentos.length > 0 ||
      datosDelDia.actividades.length > 0;

    if (!hayDatos) {
      alert('No hay datos registrados para el día de hoy. Registra algún chequeo, medicamento, menú o actividad primero.');
      return;
    }

    const doc = new jsPDF();
    let yPos = 20;
    const hoy = new Date();

    // Helper para manejar paginación
    const checkPageBreak = (neededSpace: number = 40) => {
      if (yPos > 250 - neededSpace) {
        doc.addPage();
        yPos = 20;
      }
    };

    // === HEADER ===
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen del Día', 105, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(format(hoy, "EEEE d 'de' MMMM, yyyy", { locale: es }), 105, yPos, { align: 'center' });
    yPos += 15;

    // === SECCIÓN 1: SIGNOS VITALES ===
    if (datosDelDia.signosVitales.length > 0) {
      checkPageBreak(50);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Signos Vitales', 20, yPos);
      yPos += 8;

      const signosData = datosDelDia.signosVitales.map(sv => [
        format(sv.fecha, 'HH:mm'),
        sv.presionArterialSistolica && sv.presionArterialDiastolica
          ? `${sv.presionArterialSistolica}/${sv.presionArterialDiastolica}`
          : '--',
        sv.frecuenciaCardiaca ? `${sv.frecuenciaCardiaca} bpm` : '--',
        sv.spo2 ? `${sv.spo2}%` : '--',
        sv.temperatura ? `${sv.temperatura}°C` : '--',
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Hora', 'Presión Arterial', 'FC', 'SpO2', 'Temp']],
        body: signosData,
        theme: 'grid',
        headStyles: { fillColor: [66, 139, 202] },
        margin: { left: 20, right: 20 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // === SECCIÓN 2: CHEQUEO DIARIO ===
    if (datosDelDia.chequeos.length > 0) {
      const chequeo = datosDelDia.chequeos[0];
      checkPageBreak(60);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Chequeo Diario', 20, yPos);
      yPos += 8;

      const actitudMap: Record<string, string> = {
        positiva: 'Positiva',
        neutral: 'Neutral',
        irritable: 'Irritable',
        triste: 'Triste',
        ansiosa: 'Ansiosa',
      };

      const chequeoData = [
        ['Estado General', actitudMap[chequeo.actitud || ''] || chequeo.actitud || '--'],
        ['Nivel Actividad', chequeo.nivelActividad || '--'],
        ['Cooperación', chequeo.nivelCooperacion || '--'],
        ['Sueño', chequeo.suenoCalidad || '--'],
        ['Dolor', chequeo.dolorPresente ? `Sí - Nivel ${chequeo.dolorNivel || 0}/10` : 'No'],
      ];

      if (chequeo.dolorPresente && chequeo.dolorUbicacion) {
        chequeoData.push(['Ubicación dolor', chequeo.dolorUbicacion]);
      }

      autoTable(doc, {
        startY: yPos,
        head: [['Aspecto', 'Estado']],
        body: chequeoData,
        theme: 'grid',
        headStyles: { fillColor: [92, 184, 92] },
        margin: { left: 20, right: 20 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Funciones corporales
      if (chequeo.miccionesNumero !== undefined || chequeo.evacuacionesNumero !== undefined) {
        checkPageBreak(40);
        const funcionesData = [];
        if (chequeo.miccionesNumero !== undefined) {
          funcionesData.push(['Micciones', `${chequeo.miccionesNumero} - ${chequeo.miccionesCaracteristicas || 'Normal'}`]);
        }
        if (chequeo.evacuacionesNumero !== undefined) {
          const bristolTexto = chequeo.evacuacionesBristol?.length
            ? chequeo.evacuacionesBristol.map((b, i) =>
                b ? `${chequeo.evacuacionesBristol!.length > 1 ? `#${i+1}: ` : ''}${getBristolNombre(b)}` : ''
              ).filter(Boolean).join(', ')
            : '';
          funcionesData.push(['Evacuaciones', `${chequeo.evacuacionesNumero} - ${bristolTexto} ${chequeo.evacuacionesColor || ''}`.trim()]);
        }
        if (chequeo.dificultadEvacuar) {
          funcionesData.push(['Dificultad', 'Sí']);
        }

        if (funcionesData.length > 0) {
          autoTable(doc, {
            startY: yPos,
            head: [['Función Corporal', 'Detalle']],
            body: funcionesData,
            theme: 'grid',
            headStyles: { fillColor: [241, 196, 15] },
            margin: { left: 20, right: 20 },
          });
          yPos = (doc as any).lastAutoTable.finalY + 10;
        }
      }
    }

    // === SECCIÓN 3: MEDICAMENTOS ===
    if (procesosMedicamentos.length > 0) {
      checkPageBreak(50);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Medicamentos', 20, yPos);
      yPos += 8;

      const estadoLabel: Record<string, string> = {
        completado: 'Tomado',
        pendiente: 'Pendiente',
        vencido: 'Vencido',
      };

      const medsData = procesosMedicamentos
        .sort((a, b) => (a.horaProgramada || '').localeCompare(b.horaProgramada || ''))
        .map(med => [
          med.horaProgramada,
          med.nombre,
          estadoLabel[med.estado] || med.estado,
          med.detalle || '',
        ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Hora', 'Medicamento', 'Estado', 'Dosis']],
        body: medsData,
        theme: 'grid',
        headStyles: { fillColor: [217, 83, 79] },
        margin: { left: 20, right: 20 },
        columnStyles: {
          0: { cellWidth: 20 },
          2: { cellWidth: 25 },
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // === SECCIÓN 4: MENÚ DEL DÍA ===
    if (datosDelDia.menus.length > 0) {
      checkPageBreak(50);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Menú del Día', 20, yPos);
      yPos += 8;

      const tiempoLabel: Record<string, string> = {
        desayuno: 'Desayuno',
        colacion_am: 'Colación AM',
        almuerzo: 'Almuerzo',
        colacion_pm: 'Colación PM',
        cena: 'Cena',
      };

      const menusData = datosDelDia.menus
        .sort((a, b) => {
          const orden = ['desayuno', 'colacion_am', 'almuerzo', 'colacion_pm', 'cena'];
          return orden.indexOf(a.tiempoComidaId) - orden.indexOf(b.tiempoComidaId);
        })
        .map(menu => {
          const platillos = menu.platillos
            ?.map(p => p.recetaNombre || p.nombreCustom)
            .filter(Boolean)
            .join(', ') || '--';
          return [
            tiempoLabel[menu.tiempoComidaId] || menu.tiempoComidaId,
            platillos,
          ];
        });

      autoTable(doc, {
        startY: yPos,
        head: [['Tiempo', 'Platillos']],
        body: menusData,
        theme: 'grid',
        headStyles: { fillColor: [240, 173, 78] },
        margin: { left: 20, right: 20 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // === SECCIÓN 5: ACTIVIDADES ===
    if (datosDelDia.actividades.length > 0) {
      checkPageBreak(50);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Actividades', 20, yPos);
      yPos += 8;

      const estadoAct: Record<string, string> = {
        programada: 'Programada',
        en_progreso: 'En progreso',
        completada: 'Completada',
        cancelada: 'Cancelada',
      };

      const actsData = datosDelDia.actividades
        .sort((a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime())
        .map(act => [
          format(act.fechaInicio, 'HH:mm'),
          act.nombre || '--',
          act.tipo || '--',
          estadoAct[act.estado] || act.estado,
        ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Hora', 'Actividad', 'Tipo', 'Estado']],
        body: actsData,
        theme: 'grid',
        headStyles: { fillColor: [155, 89, 182] },
        margin: { left: 20, right: 20 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // === FOOTER ===
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
      doc.text('Generado con Mamá Yola - Sistema de Gestión de Cuidado', 105, 290, { align: 'center' });
    }

    // Guardar
    const fechaArchivo = format(hoy, 'dd-MM-yyyy');
    doc.save(`resumen-dia-${fechaArchivo}.pdf`);
  }

  if (loading) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header con saludo */}
      <div className="mb-8 animate-slide-up">
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex w-14 h-14 bg-gradient-to-br from-lavender-400 to-lavender-600 rounded-2xl items-center justify-center shadow-lg shadow-lavender-500/20">
              <span className="text-2xl">👋</span>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-warm-800 font-display tracking-tight">
                ¡Hola, {userProfile?.nombre?.split(' ')[0] || 'Usuario'}!
              </h1>
              <p className="text-warm-500 capitalize">
                {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
              </p>
            </div>
          </div>
          <button
            onClick={exportarResumenDia}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
            title="Exportar resumen del día en PDF"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">Resumen PDF</span>
          </button>
        </div>
      </div>

      {/* Métricas Resumen - Cards Premium */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* Medicamentos pendientes */}
        <Link
          to="/pastillero-diario"
          className="group bg-gradient-to-br from-white via-white to-warning-light/50 border-l-4 border-warning rounded-xl p-4 md:p-5 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-warning-light rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
              ⏰
            </div>
          </div>
          <div className={`text-2xl md:text-3xl font-bold font-display ${
            metrics.medicamentosPendientes === 0 ? 'text-success' : 'text-warning-dark'
          }`}>
            {metrics.medicamentosPendientes}
          </div>
          <div className="text-sm text-warm-500 font-medium">Pendientes hoy</div>
        </Link>

        {/* Signos vitales */}
        <Link
          to="/signos-vitales"
          className="group bg-gradient-to-br from-white via-white to-error-light/30 border-l-4 border-error rounded-xl p-4 md:p-5 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-error-light rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
              💓
            </div>
          </div>
          {metrics.signosVitalesHoy ? (
            <>
              <div className="text-xl md:text-2xl font-bold text-warm-800 font-display">
                {metrics.signosVitalesHoy.presionArterialSistolica || '--'}/{metrics.signosVitalesHoy.presionArterialDiastolica || '--'}
              </div>
              <div className="text-sm text-warm-500 font-medium">
                PA • SpO2: {metrics.signosVitalesHoy.spo2 || '--'}%
              </div>
            </>
          ) : (
            <>
              <div className="text-xl md:text-2xl font-bold text-warm-400 font-display">--/--</div>
              <div className="text-sm text-warm-500 font-medium">Sin registro hoy</div>
            </>
          )}
        </Link>

        {/* Chequeo */}
        <Link
          to="/chequeo-diario"
          className="group bg-gradient-to-br from-white via-white to-success-light/50 border-l-4 border-success rounded-xl p-4 md:p-5 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 bg-success-light rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
              📋
            </div>
          </div>
          {metrics.ultimoChequeo?.completado ? (
            <>
              <div className="text-xl md:text-2xl font-bold text-success font-display flex items-center gap-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Completo
              </div>
              <div className="text-sm text-warm-500 font-medium">Chequeo de hoy</div>
            </>
          ) : (
            <>
              <div className="text-xl md:text-2xl font-bold text-warning-dark font-display">Pendiente</div>
              <div className="text-sm text-warm-500 font-medium">Chequeo diario</div>
            </>
          )}
        </Link>
      </div>

      {/* Alertas de Tránsito */}
      {!loadingTransito && itemsConStockBajo().length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 border border-orange-200 rounded-2xl p-5 md:p-6 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-orange-200 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                📦
              </div>
              <div>
                <h3 className="font-bold text-orange-900 font-display">
                  Stock Bajo en Tránsito
                </h3>
                <p className="text-sm text-orange-700 mt-1">
                  {itemsConStockBajo().length} medicamento{itemsConStockBajo().length > 1 ? 's' : ''} necesita{itemsConStockBajo().length === 1 ? '' : 'n'} reposición
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {itemsConStockBajo().slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                        (item.cantidadTransito || 0) === 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-orange-200 text-orange-800'
                      }`}
                    >
                      {(item.cantidadTransito || 0) === 0 ? '🔴' : '🟡'} {item.nombre}
                    </span>
                  ))}
                  {itemsConStockBajo().length > 3 && (
                    <span className="inline-flex items-center px-2.5 py-1 bg-orange-200/50 text-orange-700 rounded-lg text-xs font-medium">
                      +{itemsConStockBajo().length - 3} más
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Link
              to="/pastillero-diario"
              className="flex-shrink-0 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              Ver Tránsito
            </Link>
          </div>
        </div>
      )}

      {/* Alertas de Reportes de Diferencias - Solo para Familiar/Supervisor */}
      {puedeResolverReportes && contadorPendientes > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-2xl p-5 md:p-6 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-amber-200 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                📋
              </div>
              <div>
                <h3 className="font-bold text-amber-900 font-display">
                  Reportes de Diferencias Pendientes
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  {contadorPendientes} reporte{contadorPendientes > 1 ? 's' : ''} requiere{contadorPendientes === 1 ? '' : 'n'} revisión
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {reportesPendientes.slice(0, 3).map((reporte) => (
                    <span
                      key={reporte.id}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                        reporte.diferencia < 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {reporte.diferencia < 0 ? '🔻' : '🔺'} {reporte.itemNombre}
                    </span>
                  ))}
                  {contadorPendientes > 3 && (
                    <span className="inline-flex items-center px-2.5 py-1 bg-amber-200/50 text-amber-700 rounded-lg text-xs font-medium">
                      +{contadorPendientes - 3} más
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Link
              to="/inventarios"
              className="flex-shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              Revisar
            </Link>
          </div>
        </div>
      )}

      {/* Accesos Rápidos */}
      <div className="bg-white rounded-2xl shadow-card p-5 md:p-6 mb-8 border border-warm-100">
        <h2 className="text-lg font-bold text-warm-800 mb-4 font-display flex items-center gap-2">
          <span className="text-xl">⚡</span> Acceso Rápido
        </h2>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-3">
          {[
            { path: '/chequeo-diario', icon: '📋', label: 'Chequeo' },
            { path: '/signos-vitales', icon: '💓', label: 'Signos' },
            { path: '/pastillero-diario', icon: '💊', label: 'Pastillero' },
            { path: '/menu-comida', icon: '🍽️', label: 'Menú' },
            { path: '/turnos', icon: '👥', label: 'Turnos' },
            { path: '/actividades', icon: '🎯', label: 'Actividades' },
            { path: '/configuracion-horarios', icon: '⏰', label: 'Horarios' },
            { path: '/analytics', icon: '📊', label: 'Analytics' },
          ].map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="group flex flex-col items-center justify-center p-3 md:p-4 bg-warm-50/50 border border-warm-100 rounded-xl hover:border-lavender-300 hover:bg-lavender-50 transition-all duration-200"
            >
              <span className="text-2xl md:text-3xl mb-1.5 group-hover:scale-110 transition-transform duration-200">
                {item.icon}
              </span>
              <span className="text-xs font-medium text-warm-600 text-center group-hover:text-lavender-700">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Procesos del Día */}
      {procesos.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card mb-8 border border-warm-100 overflow-hidden">
          <div className="p-5 md:p-6 border-b border-warm-100 bg-gradient-to-r from-warm-50/50 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-warm-800 font-display flex items-center gap-2">
                  <span className="text-xl">⚠️</span> Procesos Vencidos
                </h2>
                <p className="text-sm text-warm-500 mt-0.5">
                  Requieren atención inmediata
                </p>
              </div>
              <Link
                to="/configuracion-horarios"
                className="p-2.5 text-warm-500 hover:text-lavender-600 hover:bg-lavender-50 rounded-xl transition-all"
                title="Configurar horarios"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </div>
          </div>
          <div className="p-5 md:p-6">
            {(() => {
              const grupos = agruparProcesosPorEstado(procesos);
              if (grupos.vencidos.length === 0) {
                return (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 bg-success-light rounded-2xl mx-auto mb-3 flex items-center justify-center">
                      <span className="text-2xl">✓</span>
                    </div>
                    <p className="text-sm text-warm-600 font-medium">Sin procesos vencidos</p>
                    <p className="text-xs text-warm-400 mt-1">Todo al día</p>
                  </div>
                );
              }
              return (
                <ProcesoGrupo titulo="Vencidos" procesos={grupos.vencidos} horaActual={horaActual} />
              );
            })()}
          </div>
        </div>
      )}

      {/* Grid Citas y Contactos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Próximas Citas */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-card border border-warm-100 overflow-hidden">
          <div className="p-5 md:p-6 border-b border-warm-100 bg-gradient-to-r from-warm-50/50 to-transparent">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-warm-800 font-display flex items-center gap-2">
                <span className="text-xl">📅</span> Próximas Citas
              </h2>
              <Link
                to="/eventos"
                className="text-sm text-lavender-600 hover:text-lavender-700 font-semibold flex items-center gap-1 group"
              >
                Ver todas
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
          <div className="p-5 md:p-6">
            {proximasCitas.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-warm-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <span className="text-3xl">📅</span>
                </div>
                <p className="text-warm-500 mb-4">No hay citas en los próximos 7 días</p>
                <Link
                  to="/eventos"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-lavender-500 to-lavender-600 text-white font-semibold rounded-xl shadow-btn-primary hover:shadow-btn-primary-hover transition-all active:scale-[0.98]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Crear Cita
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {proximasCitas.slice(0, 4).map((cita) => (
                  <div
                    key={cita.id}
                    className="group bg-warm-50/50 border border-warm-100 rounded-xl p-4 hover:border-lavender-200 hover:bg-white transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                          {getTipoIcono(cita.tipo)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-warm-800 truncate">{cita.titulo}</h4>
                          <p className="text-sm text-warm-600 flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                              isToday(cita.fechaInicio)
                                ? 'bg-error-light text-error-dark'
                                : isTomorrow(cita.fechaInicio)
                                ? 'bg-warning-light text-warning-dark'
                                : 'bg-warm-100 text-warm-600'
                            }`}>
                              {getFechaTexto(cita.fechaInicio)}
                            </span>
                            <span className="text-warm-400">•</span>
                            {format(cita.fechaInicio, 'HH:mm')}
                          </p>
                          {cita.contactoNombre && (
                            <p className="text-xs text-warm-500 mt-1 flex items-center gap-1">
                              <span>👤</span> {cita.contactoNombre}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {cita.estado === 'programada' ? (
                          <button
                            onClick={() => confirmarCita(cita)}
                            className="px-3 py-1.5 bg-gradient-to-r from-success to-success-dark text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                          >
                            Confirmar
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 bg-success-light text-success-dark text-xs font-semibold rounded-lg flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Confirmada
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contactos Favoritos */}
        <div className="bg-white rounded-2xl shadow-card border border-warm-100 overflow-hidden">
          <div className="p-5 md:p-6 border-b border-warm-100 bg-gradient-to-r from-warm-50/50 to-transparent">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-warm-800 font-display flex items-center gap-2">
                <span className="text-xl">⭐</span> Contactos
              </h2>
              <Link
                to="/contactos"
                className="text-sm text-lavender-600 hover:text-lavender-700 font-semibold flex items-center gap-1 group"
              >
                Ver todos
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
          <div className="p-5 md:p-6">
            {contactos.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-warm-100 rounded-2xl mx-auto mb-3 flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <p className="text-sm text-warm-500 mb-3">Sin favoritos</p>
                <Link
                  to="/contactos"
                  className="text-sm text-lavender-600 hover:text-lavender-700 font-semibold"
                >
                  Agregar favoritos →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {contactos.map((contacto) => (
                  <div
                    key={contacto.id}
                    className="group flex items-center gap-3 p-3 rounded-xl hover:bg-lavender-50 transition-all"
                  >
                    <div className="w-11 h-11 bg-gradient-to-br from-lavender-100 to-lavender-200 rounded-xl flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                      {contacto.foto ? (
                        <img src={contacto.foto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lavender-600 font-bold">
                          {contacto.nombre.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-warm-800 text-sm truncate">{contacto.nombre}</p>
                      <p className="text-xs text-warm-500 truncate">{contacto.especialidad || contacto.categoria}</p>
                    </div>
                    {contacto.telefonoPrincipal && (
                      <a
                        href={`tel:${contacto.telefonoPrincipal}`}
                        className="p-2.5 bg-lavender-100 hover:bg-lavender-200 text-lavender-600 rounded-xl flex-shrink-0 transition-colors group-hover:scale-105"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
