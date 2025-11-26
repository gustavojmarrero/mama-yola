import { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ChequeoDiario, RegistroMedicamento } from '../types';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

const PACIENTE_ID = 'paciente-principal';

export default function ChequeoDiarioPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chequeoActual, setChequeoActual] = useState<ChequeoDiario | null>(null);
  const [ultimoGuardado, setUltimoGuardado] = useState<Date | null>(null);

  // Estados para historial
  const [vistaActual, setVistaActual] = useState<'hoy' | 'historial' | 'detalle'>('hoy');
  const [historialChequeos, setHistorialChequeos] = useState<ChequeoDiario[]>([]);
  const [filtroCuidador, setFiltroCuidador] = useState<string>('todos');
  const [chequeoSeleccionado, setChequeoSeleccionado] = useState<ChequeoDiario | null>(null);

  // Estados para adherencia de medicamentos
  const [registrosMedicamentos, setRegistrosMedicamentos] = useState<RegistroMedicamento[]>([]);
  const [adherenciaAutomatica, setAdherenciaAutomatica] = useState(false);

  // Hook para detectar cambios sin guardar
  const { isDirty, setIsDirty, markAsSaved, confirmNavigation, setOriginalData } = useUnsavedChanges();

  const [formData, setFormData] = useState({
    // Estado general
    actitud: [] as string[],
    nivelActividad: '',
    nivelCooperacion: '',
    estadoSueno: '',
    dolorNivel: 'sin_dolor' as 'sin_dolor' | 'leve' | 'moderado' | 'severo',
    dolorUbicacion: '',
    dolorDescripcion: '',
    notasGenerales: '',

    // Alimentación
    kefirHora: '',
    kefirCantidad: '',
    kefirNotas: '',
    desayunoDescripcion: '',
    desayunoCantidad: '',
    colacion1Descripcion: '',
    colacion1Cantidad: '',
    almuerzoDescripcion: '',
    almuerzoCantidad: '',
    colacion2Descripcion: '',
    colacion2Cantidad: '',
    cenaDescripcion: '',
    cenaCantidad: '',
    consumoAguaLitros: '',
    otrosLiquidos: '',
    observacionesApetito: '',
    alimentosRechazados: '',

    // Funciones corporales
    miccionesNumero: 0,
    miccionesCaracteristicas: '',
    evacuacionesNumero: 0,
    evacuacionesConsistencia: '',
    evacuacionesColor: '',
    dificultadEvacuar: false,
    laxantes: [] as Array<{ nombre: string; cantidad: string }>,

    // Actividades
    actividadesRealizadas: [] as string[],
    participacionActitud: '',

    // Medicación
    medicacionEnTiempoForma: true,
    medicamentosAdicionales: [] as Array<{ nombre: string; dosis: string; motivo: string; hora: string }>,
    medicamentosRechazados: [] as Array<{ nombre: string; motivo: string }>,
    observacionesMedicacion: '',

    // Incidentes
    incidentes: [] as Array<{
      tipo: string;
      descripcion: string;
      hora: string;
      accionTomada: string;
      gravedad: 'leve' | 'moderada' | 'grave';
    }>,

    // Resumen
    resumenGeneral: '',
    observacionesImportantes: '',
    recomendacionesSiguienteTurno: ''
  });

  useEffect(() => {
    cargarChequeoDelDia();
    verificarAdherenciaMedicamentos();
  }, []);

  // Detectar cambios en el formulario para marcar como dirty
  useEffect(() => {
    // Solo marcar como dirty si no es el estado inicial y no está completado
    if (!loading && chequeoActual && !chequeoActual.completado) {
      setIsDirty(true);
    }
  }, [formData]);

  // Guardado automático cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (chequeoActual && !chequeoActual.completado) {
        guardarBorrador();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [chequeoActual, formData]);

  async function cargarChequeoDelDia() {
    try {
      setLoading(true);

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'chequeosDiarios'),
        where('fecha', '>=', hoy),
        orderBy('fecha', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const chequeoDoc = querySnapshot.docs[0];
        const chequeoData = { id: chequeoDoc.id, ...chequeoDoc.data() } as ChequeoDiario;
        setChequeoActual(chequeoData);

        // Cargar datos del chequeo en el formulario
        setFormData({
          actitud: chequeoData.estadoGeneral?.actitud || [],
          nivelActividad: chequeoData.estadoGeneral?.nivelActividad || '',
          nivelCooperacion: chequeoData.estadoGeneral?.nivelCooperacion || '',
          estadoSueno: chequeoData.estadoGeneral?.estadoSueno || '',
          dolorNivel: chequeoData.estadoGeneral?.dolor?.nivel || 'sin_dolor',
          dolorUbicacion: chequeoData.estadoGeneral?.dolor?.ubicacion || '',
          dolorDescripcion: chequeoData.estadoGeneral?.dolor?.descripcion || '',
          notasGenerales: chequeoData.estadoGeneral?.notasGenerales || '',

          kefirHora: chequeoData.alimentacion?.kefir?.hora || '',
          kefirCantidad: chequeoData.alimentacion?.kefir?.cantidad || '',
          kefirNotas: chequeoData.alimentacion?.kefir?.notas || '',
          desayunoDescripcion: chequeoData.alimentacion?.desayuno?.descripcion || '',
          desayunoCantidad: chequeoData.alimentacion?.desayuno?.cantidad || '',
          colacion1Descripcion: chequeoData.alimentacion?.colacion1?.descripcion || '',
          colacion1Cantidad: chequeoData.alimentacion?.colacion1?.cantidad || '',
          almuerzoDescripcion: chequeoData.alimentacion?.almuerzo?.descripcion || '',
          almuerzoCantidad: chequeoData.alimentacion?.almuerzo?.cantidad || '',
          colacion2Descripcion: chequeoData.alimentacion?.colacion2?.descripcion || '',
          colacion2Cantidad: chequeoData.alimentacion?.colacion2?.cantidad || '',
          cenaDescripcion: chequeoData.alimentacion?.cena?.descripcion || '',
          cenaCantidad: chequeoData.alimentacion?.cena?.cantidad || '',
          consumoAguaLitros: chequeoData.alimentacion?.consumoAguaLitros?.toString() || '',
          otrosLiquidos: chequeoData.alimentacion?.otrosLiquidos || '',
          observacionesApetito: chequeoData.alimentacion?.observacionesApetito || '',
          alimentosRechazados: chequeoData.alimentacion?.alimentosRechazados || '',

          miccionesNumero: chequeoData.funcionesCorporales?.miccionesNumero || 0,
          miccionesCaracteristicas: chequeoData.funcionesCorporales?.miccionesCaracteristicas || '',
          evacuacionesNumero: chequeoData.funcionesCorporales?.evacuacionesNumero || 0,
          evacuacionesConsistencia: chequeoData.funcionesCorporales?.evacuacionesConsistencia || '',
          evacuacionesColor: chequeoData.funcionesCorporales?.evacuacionesColor || '',
          dificultadEvacuar: chequeoData.funcionesCorporales?.dificultadEvacuar || false,
          laxantes: chequeoData.funcionesCorporales?.laxantesUsados || [],

          actividadesRealizadas: chequeoData.actividadesRealizadas?.actividadesRealizadas || [],
          participacionActitud: chequeoData.actividadesRealizadas?.participacionActitud || '',

          medicacionEnTiempoForma: chequeoData.medicacion?.medicacionEnTiempoForma || false,
          medicamentosAdicionales: chequeoData.medicacion?.medicamentosAdicionales || [],
          medicamentosRechazados: chequeoData.medicacion?.medicamentosRechazados || [],
          observacionesMedicacion: chequeoData.medicacion?.observaciones || '',

          incidentes: chequeoData.incidentes || [],

          resumenGeneral: chequeoData.resumen?.resumenGeneral || '',
          observacionesImportantes: chequeoData.resumen?.observacionesImportantes || '',
          recomendacionesSiguienteTurno: chequeoData.resumen?.recomendacionesSiguienteTurno || ''
        });
      }
    } catch (error) {
      console.error('Error cargando chequeo del día:', error);
    } finally {
      setLoading(false);
    }
  }

  async function verificarAdherenciaMedicamentos() {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'registroMedicamentos'),
        where('fechaHoraProgramada', '>=', hoy),
        where('fechaHoraProgramada', '<', manana)
      );

      const querySnapshot = await getDocs(q);
      const registros: RegistroMedicamento[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        registros.push({
          id: doc.id,
          ...data,
          fechaHoraProgramada: data.fechaHoraProgramada?.toDate() || new Date(),
          fechaHoraReal: data.fechaHoraReal?.toDate(),
          creadoEn: data.creadoEn?.toDate() || new Date(),
        } as RegistroMedicamento);
      });

      setRegistrosMedicamentos(registros);

      // Verificar adherencia 100%
      if (registros.length > 0) {
        const todosTomados = registros.every((r) => r.estado === 'tomado');
        setAdherenciaAutomatica(todosTomados);

        // Auto-marcar checkbox si hay 100% adherencia
        if (todosTomados && !formData.medicacionEnTiempoForma) {
          setFormData(prev => ({ ...prev, medicacionEnTiempoForma: true }));
        }
      }
    } catch (error) {
      console.error('Error verificando adherencia de medicamentos:', error);
    }
  }

  async function cargarHistorialChequeos() {
    try {
      setLoading(true);

      // Obtener chequeos de los últimos 30 días
      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);
      hace30Dias.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'chequeosDiarios'),
        where('fecha', '>=', hace30Dias),
        where('completado', '==', true),
        orderBy('fecha', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const chequeos: ChequeoDiario[] = [];

      querySnapshot.forEach((doc) => {
        chequeos.push({ id: doc.id, ...doc.data() } as ChequeoDiario);
      });

      setHistorialChequeos(chequeos);
    } catch (error) {
      console.error('Error cargando historial de chequeos:', error);
    } finally {
      setLoading(false);
    }
  }

  async function exportarAPDF(chequeo: ChequeoDiario) {
    const doc = new jsPDF();
    let yPos = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Chequeo Diario - Mama Yola', 105, yPos, { align: 'center' });
    yPos += 10;

    // Fecha y cuidador
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const fecha = chequeo.fecha instanceof Date
      ? chequeo.fecha.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'Fecha no disponible';
    doc.text(`Fecha: ${fecha}`, 20, yPos);
    yPos += 7;
    doc.text(`Cuidador: ${chequeo.cuidadorNombre || 'No especificado'}`, 20, yPos);
    yPos += 7;
    doc.text(`Hora de registro: ${chequeo.horaRegistro instanceof Date ? chequeo.horaRegistro.toLocaleTimeString('es-MX') : 'No disponible'}`, 20, yPos);
    yPos += 12;

    // Sección 1: Estado General
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Estado General', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
      startY: yPos,
      head: [['Campo', 'Valor']],
      body: [
        ['Actitud', chequeo.actitud?.join(', ') || 'No registrado'],
        ['Nivel de Actividad', chequeo.nivelActividad || 'No registrado'],
        ['Nivel de Cooperación', chequeo.nivelCooperacion || 'No registrado'],
        ['Estado del Sueño', chequeo.estadoSueno || 'No registrado'],
        ['Dolor', chequeo.dolor || 'Sin dolor'],
        ['Notas Generales', chequeo.notasGenerales || 'Ninguna']
      ],
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: 20, right: 20 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Sección 2: Alimentación
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Alimentación', 20, yPos);
    yPos += 8;

    const comidas = [
      ['Desayuno', chequeo.desayunoDescripcion || 'No registrado', chequeo.desayunoCantidad || 'N/A'],
      ['Almuerzo', chequeo.almuerzoDescripcion || 'No registrado', chequeo.almuerzoCantidad || 'N/A'],
      ['Cena', chequeo.cenaDescripcion || 'No registrado', chequeo.cenaCantidad || 'N/A'],
      ['Agua consumida', `${chequeo.consumoAguaLitros || 0} litros`, ''],
      ['Alimentos rechazados', chequeo.alimentosRechazados || 'Ninguno', '']
    ];

    doc.setFontSize(10);
    autoTable(doc, {
      startY: yPos,
      head: [['Comida', 'Descripción', 'Cantidad']],
      body: comidas,
      theme: 'grid',
      headStyles: { fillColor: [92, 184, 92] },
      margin: { left: 20, right: 20 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Sección 3: Funciones Corporales
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Funciones Corporales', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    autoTable(doc, {
      startY: yPos,
      head: [['Campo', 'Valor']],
      body: [
        ['Número de micciones', `${chequeo.miccionesNumero || 0}`],
        ['Características micciones', chequeo.miccionesCaracteristicas || 'Normal'],
        ['Número de evacuaciones', `${chequeo.evacuacionesNumero || 0}`],
        ['Consistencia evacuaciones', chequeo.evacuacionConsistencia || 'No registrada'],
        ['Dificultad para evacuar', chequeo.dificultadEvacuar ? 'Sí' : 'No']
      ],
      theme: 'grid',
      headStyles: { fillColor: [240, 173, 78] },
      margin: { left: 20, right: 20 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Sección 4: Actividades
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Actividades Realizadas', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    autoTable(doc, {
      startY: yPos,
      head: [['Actividades']],
      body: [
        [chequeo.actividades?.join(', ') || 'No registradas'],
        ['Participación: ' + (chequeo.participacionActividades || 'No registrada')]
      ],
      theme: 'grid',
      headStyles: { fillColor: [91, 192, 222] },
      margin: { left: 20, right: 20 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Sección 5: Medicación
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Medicación', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    autoTable(doc, {
      startY: yPos,
      head: [['Estado']],
      body: [
        [chequeo.medicacionAdministrada ? '✓ Medicación administrada en tiempo y forma' : '✗ Medicación NO administrada correctamente'],
        ['Observaciones: ' + (chequeo.observacionesMedicacion || 'Ninguna')]
      ],
      theme: 'grid',
      headStyles: { fillColor: [217, 83, 79] },
      margin: { left: 20, right: 20 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Sección 7: Resumen
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('7. Resumen del Día', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const resumen = chequeo.resumenGeneral || 'No se proporcionó resumen';
    const splitResumen = doc.splitTextToSize(resumen, 170);
    doc.text(splitResumen, 20, yPos);
    yPos += splitResumen.length * 5 + 8;

    if (chequeo.observacionesImportantes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Observaciones Importantes:', 20, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      const splitObs = doc.splitTextToSize(chequeo.observacionesImportantes, 170);
      doc.text(splitObs, 20, yPos);
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
      doc.text('Generado con Mama Yola - Sistema de Gestión de Cuidado', 105, 290, { align: 'center' });
    }

    // Guardar PDF
    const nombreArchivo = `chequeo-${fecha.replace(/,/g, '').replace(/ /g, '-')}.pdf`;
    doc.save(nombreArchivo);
  }

  async function guardarBorrador() {
    try {
      setSaving(true);

      const datosChequeo = construirDatosChequeo(false);

      if (chequeoActual) {
        // Actualizar chequeo existente
        await updateDoc(
          doc(db, 'pacientes', PACIENTE_ID, 'chequeosDiarios', chequeoActual.id),
          {
            ...datosChequeo,
            actualizadoEn: new Date()
          }
        );
      } else {
        // Crear nuevo chequeo
        const nuevoChequeo = await addDoc(
          collection(db, 'pacientes', PACIENTE_ID, 'chequeosDiarios'),
          datosChequeo
        );
        setChequeoActual({
          id: nuevoChequeo.id,
          ...datosChequeo
        } as ChequeoDiario);
      }

      setUltimoGuardado(new Date());
      markAsSaved();
    } catch (error) {
      console.error('Error guardando borrador:', error);
    } finally {
      setSaving(false);
    }
  }

  function construirDatosChequeo(completado: boolean) {
    return {
      pacienteId: PACIENTE_ID,
      fecha: new Date(),
      turno: 'matutino' as const,
      cuidadorId: userProfile?.id || '',
      cuidadorNombre: userProfile?.nombre || '',
      horaRegistro: new Date(),

      estadoGeneral: {
        actitud: formData.actitud,
        nivelActividad: formData.nivelActividad,
        nivelCooperacion: formData.nivelCooperacion,
        estadoSueno: formData.estadoSueno,
        ...(formData.dolorNivel !== 'sin_dolor' && {
          dolor: {
            nivel: formData.dolorNivel,
            ubicacion: formData.dolorUbicacion,
            descripcion: formData.dolorDescripcion
          }
        }),
        notasGenerales: formData.notasGenerales
      },

      alimentacion: {
        ...(formData.kefirHora && {
          kefir: {
            hora: formData.kefirHora,
            cantidad: formData.kefirCantidad,
            notas: formData.kefirNotas
          }
        }),
        ...(formData.desayunoDescripcion && {
          desayuno: {
            descripcion: formData.desayunoDescripcion,
            cantidad: formData.desayunoCantidad
          }
        }),
        ...(formData.colacion1Descripcion && {
          colacion1: {
            descripcion: formData.colacion1Descripcion,
            cantidad: formData.colacion1Cantidad
          }
        }),
        ...(formData.almuerzoDescripcion && {
          almuerzo: {
            descripcion: formData.almuerzoDescripcion,
            cantidad: formData.almuerzoCantidad
          }
        }),
        ...(formData.colacion2Descripcion && {
          colacion2: {
            descripcion: formData.colacion2Descripcion,
            cantidad: formData.colacion2Cantidad
          }
        }),
        ...(formData.cenaDescripcion && {
          cena: {
            descripcion: formData.cenaDescripcion,
            cantidad: formData.cenaCantidad
          }
        }),
        ...(formData.consumoAguaLitros && {
          consumoAguaLitros: parseFloat(formData.consumoAguaLitros)
        }),
        otrosLiquidos: formData.otrosLiquidos,
        observacionesApetito: formData.observacionesApetito,
        alimentosRechazados: formData.alimentosRechazados
      },

      funcionesCorporales: {
        miccionesNumero: formData.miccionesNumero,
        miccionesCaracteristicas: formData.miccionesCaracteristicas,
        evacuacionesNumero: formData.evacuacionesNumero,
        evacuacionesConsistencia: formData.evacuacionesConsistencia,
        evacuacionesColor: formData.evacuacionesColor,
        dificultadEvacuar: formData.dificultadEvacuar,
        laxantesUsados: formData.laxantes
      },

      actividadesRealizadas: {
        actividadesRealizadas: formData.actividadesRealizadas,
        participacionActitud: formData.participacionActitud
      },

      medicacion: {
        medicacionEnTiempoForma: formData.medicacionEnTiempoForma,
        ...(formData.medicamentosAdicionales.length > 0 && {
          medicamentosAdicionales: formData.medicamentosAdicionales
        }),
        ...(formData.medicamentosRechazados.length > 0 && {
          medicamentosRechazados: formData.medicamentosRechazados
        }),
        observaciones: formData.observacionesMedicacion
      },

      ...(formData.incidentes.length > 0 && {
        incidentes: formData.incidentes
      }),

      resumen: {
        resumenGeneral: formData.resumenGeneral,
        observacionesImportantes: formData.observacionesImportantes,
        recomendacionesSiguienteTurno: formData.recomendacionesSiguienteTurno
      },

      completado,
      creadoEn: chequeoActual?.creadoEn || new Date(),
      actualizadoEn: new Date()
    };
  }

  function validarChequeo(): { valido: boolean; errores: string[] } {
    const errores: string[] = [];

    // Validar estado general
    if (formData.actitud.length === 0) {
      errores.push('Debes seleccionar al menos una actitud');
    }
    if (!formData.nivelActividad) {
      errores.push('Debes seleccionar el nivel de actividad');
    }
    if (!formData.nivelCooperacion) {
      errores.push('Debes seleccionar el nivel de cooperación');
    }
    if (!formData.estadoSueno) {
      errores.push('Debes seleccionar el estado del sueño');
    }

    // Validar al menos una comida registrada
    const hayAlgunaComida = formData.desayunoDescripcion ||
                           formData.colacion1Descripcion ||
                           formData.almuerzoDescripcion ||
                           formData.colacion2Descripcion ||
                           formData.cenaDescripcion;
    if (!hayAlgunaComida) {
      errores.push('Debes registrar al menos una comida del día');
    }

    // Validar resumen general
    if (!formData.resumenGeneral || formData.resumenGeneral.trim() === '') {
      errores.push('Debes incluir un resumen general del día');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  async function generarAlertas() {
    const alertas: Array<{ tipo: string; mensaje: string; gravedad: 'leve' | 'moderada' | 'grave' }> = [];

    // Alerta: No evacuaciones
    if (formData.evacuacionesNumero === 0) {
      alertas.push({
        tipo: 'sin_evacuacion',
        mensaje: 'El paciente no tuvo evacuaciones hoy',
        gravedad: 'moderada'
      });
    }

    // Alerta: Consumo de agua bajo
    const consumoAgua = parseFloat(formData.consumoAguaLitros || '0');
    if (consumoAgua < 1.5) {
      alertas.push({
        tipo: 'agua_baja',
        mensaje: `Consumo de agua bajo: ${consumoAgua}L (recomendado: >1.5L)`,
        gravedad: 'leve'
      });
    }

    // Alerta: Múltiples incidentes
    if (formData.incidentes.length >= 2) {
      alertas.push({
        tipo: 'multiples_incidentes',
        mensaje: `Se registraron ${formData.incidentes.length} incidentes en el día`,
        gravedad: 'moderada'
      });
    }

    // Alerta: Incidente grave
    const hayIncidenteGrave = formData.incidentes.some(inc => inc.gravedad === 'grave');
    if (hayIncidenteGrave) {
      alertas.push({
        tipo: 'incidente_grave',
        mensaje: 'Se registró un incidente de gravedad GRAVE',
        gravedad: 'grave'
      });
    }

    // Alerta: Rechazó múltiples comidas
    const comidasRechazadas = [
      formData.desayunoCantidad === 'nada',
      formData.colacion1Cantidad === 'nada',
      formData.almuerzoCantidad === 'nada',
      formData.colacion2Cantidad === 'nada',
      formData.cenaCantidad === 'nada'
    ].filter(Boolean).length;

    if (comidasRechazadas >= 2) {
      alertas.push({
        tipo: 'comidas_rechazadas',
        mensaje: `Rechazó ${comidasRechazadas} comidas del día`,
        gravedad: 'moderada'
      });
    }

    // Alerta: Medicamentos rechazados
    if (formData.medicamentosRechazados.length > 0) {
      alertas.push({
        tipo: 'medicamentos_rechazados',
        mensaje: `Rechazó ${formData.medicamentosRechazados.length} medicamento(s)`,
        gravedad: 'moderada'
      });
    }

    // Guardar alertas en Firestore
    for (const alerta of alertas) {
      try {
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'notificaciones'), {
          tipo: alerta.tipo,
          mensaje: alerta.mensaje,
          gravedad: alerta.gravedad,
          fecha: new Date(),
          leida: false,
          creadoEn: new Date()
        });
      } catch (error) {
        console.error('Error creando alerta:', error);
      }
    }

    return alertas;
  }

  async function crearNotificacionChequeoCompletado() {
    try {
      // Crear notificación para familiares y supervisores
      await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'notificaciones'), {
        tipo: 'chequeo_completado',
        mensaje: `Chequeo diario completado por ${userProfile?.nombre || 'Cuidador'}`,
        fecha: new Date(),
        leida: false,
        creadoEn: new Date()
      });
    } catch (error) {
      console.error('Error creando notificación:', error);
    }
  }

  async function handleCompletarChequeo() {
    // Validar el chequeo
    const { valido, errores } = validarChequeo();
    if (!valido) {
      alert('No se puede completar el chequeo:\n\n' + errores.join('\n'));
      return;
    }

    if (!confirm('¿Estás seguro de completar el chequeo? No podrás modificarlo después.')) {
      return;
    }

    try {
      setSaving(true);

      const datosChequeo = construirDatosChequeo(true);

      // Guardar o actualizar el chequeo
      if (chequeoActual) {
        await updateDoc(
          doc(db, 'pacientes', PACIENTE_ID, 'chequeosDiarios', chequeoActual.id),
          {
            ...datosChequeo,
            actualizadoEn: new Date()
          }
        );
      } else {
        await addDoc(
          collection(db, 'pacientes', PACIENTE_ID, 'chequeosDiarios'),
          datosChequeo
        );
      }

      // Generar alertas automáticas
      const alertas = await generarAlertas();

      // Crear notificación de chequeo completado
      await crearNotificacionChequeoCompletado();

      let mensajeExito = 'Chequeo completado exitosamente';
      if (alertas.length > 0) {
        mensajeExito += `\n\nSe generaron ${alertas.length} alerta(s) que requieren atención.`;
      }

      alert(mensajeExito);
      cargarChequeoDelDia();
    } catch (error) {
      console.error('Error completando chequeo:', error);
      alert('Error al completar chequeo');
    } finally {
      setSaving(false);
    }
  }

  function toggleActitud(valor: string) {
    if (formData.actitud.includes(valor)) {
      setFormData({
        ...formData,
        actitud: formData.actitud.filter(a => a !== valor)
      });
    } else {
      setFormData({
        ...formData,
        actitud: [...formData.actitud, valor]
      });
    }
  }

  function agregarLaxante() {
    setFormData({
      ...formData,
      laxantes: [...formData.laxantes, { nombre: '', cantidad: '' }]
    });
  }

  function eliminarLaxante(index: number) {
    setFormData({
      ...formData,
      laxantes: formData.laxantes.filter((_, i) => i !== index)
    });
  }

  function updateLaxante(index: number, campo: 'nombre' | 'cantidad', valor: string) {
    const nuevosLaxantes = [...formData.laxantes];
    nuevosLaxantes[index][campo] = valor;
    setFormData({ ...formData, laxantes: nuevosLaxantes });
  }

  // Funciones para Actividades
  function toggleActividad(actividad: string) {
    if (formData.actividadesRealizadas.includes(actividad)) {
      setFormData({
        ...formData,
        actividadesRealizadas: formData.actividadesRealizadas.filter(a => a !== actividad)
      });
    } else {
      setFormData({
        ...formData,
        actividadesRealizadas: [...formData.actividadesRealizadas, actividad]
      });
    }
  }

  // Funciones para Medicamentos
  function agregarMedicamentoAdicional() {
    setFormData({
      ...formData,
      medicamentosAdicionales: [...formData.medicamentosAdicionales, { nombre: '', dosis: '', motivo: '', hora: '' }]
    });
  }

  function eliminarMedicamentoAdicional(index: number) {
    setFormData({
      ...formData,
      medicamentosAdicionales: formData.medicamentosAdicionales.filter((_, i) => i !== index)
    });
  }

  function updateMedicamentoAdicional(index: number, campo: 'nombre' | 'dosis' | 'motivo' | 'hora', valor: string) {
    const nuevosMedicamentos = [...formData.medicamentosAdicionales];
    nuevosMedicamentos[index][campo] = valor;
    setFormData({ ...formData, medicamentosAdicionales: nuevosMedicamentos });
  }

  function agregarMedicamentoRechazado() {
    setFormData({
      ...formData,
      medicamentosRechazados: [...formData.medicamentosRechazados, { nombre: '', motivo: '' }]
    });
  }

  function eliminarMedicamentoRechazado(index: number) {
    setFormData({
      ...formData,
      medicamentosRechazados: formData.medicamentosRechazados.filter((_, i) => i !== index)
    });
  }

  function updateMedicamentoRechazado(index: number, campo: 'nombre' | 'motivo', valor: string) {
    const nuevosMedicamentos = [...formData.medicamentosRechazados];
    nuevosMedicamentos[index][campo] = valor;
    setFormData({ ...formData, medicamentosRechazados: nuevosMedicamentos });
  }

  // Funciones para Incidentes
  function agregarIncidente() {
    setFormData({
      ...formData,
      incidentes: [...formData.incidentes, { tipo: '', descripcion: '', hora: '', accionTomada: '', gravedad: 'leve' }]
    });
  }

  function eliminarIncidente(index: number) {
    setFormData({
      ...formData,
      incidentes: formData.incidentes.filter((_, i) => i !== index)
    });
  }

  function updateIncidente(index: number, campo: 'tipo' | 'descripcion' | 'hora' | 'accionTomada' | 'gravedad', valor: string) {
    const nuevosIncidentes = [...formData.incidentes];
    nuevosIncidentes[index][campo as any] = valor;
    setFormData({ ...formData, incidentes: nuevosIncidentes });
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

  const yaCompletado = chequeoActual?.completado;

  // Vista de historial de chequeos
  function renderHistorial() {
    const chequeosFiltrados = filtroCuidador === 'todos'
      ? historialChequeos
      : historialChequeos.filter(c => c.cuidadorEmail === filtroCuidador);

    // Obtener lista única de cuidadores para el filtro
    const cuidadores = Array.from(new Set(historialChequeos.map(c => c.cuidadorEmail || '')))
      .filter(email => email !== '');

    return (
      <div className="space-y-6">
        {/* Filtros */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filtrar por cuidador:</label>
            <select
              value={filtroCuidador}
              onChange={(e) => setFiltroCuidador(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos los cuidadores</option>
              {cuidadores.map(email => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de chequeos */}
        {chequeosFiltrados.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
            <p className="text-gray-500 text-lg">No hay chequeos completados en los últimos 30 días</p>
          </div>
        ) : (
          <div className="space-y-4">
            {chequeosFiltrados.map(chequeo => (
              <div
                key={chequeo.id}
                onClick={() => {
                  setChequeoSeleccionado(chequeo);
                  setVistaActual('detalle');
                }}
                className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {chequeo.fecha instanceof Date
                        ? chequeo.fecha.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                        : 'Fecha no disponible'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {chequeo.cuidadorNombre || 'Cuidador desconocido'} • {chequeo.horaRegistro instanceof Date
                        ? chequeo.horaRegistro.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    Completado
                  </span>
                </div>

                {/* Resumen del chequeo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Actitud</p>
                    <p className="text-sm font-medium text-gray-900">
                      {chequeo.actitud?.join(', ') || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Actividad</p>
                    <p className="text-sm font-medium text-gray-900">
                      {chequeo.nivelActividad || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Evacuaciones</p>
                    <p className="text-sm font-medium text-gray-900">
                      {chequeo.evacuacionesNumero || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Agua (L)</p>
                    <p className="text-sm font-medium text-gray-900">
                      {chequeo.consumoAguaLitros || '0'}
                    </p>
                  </div>
                </div>

                {/* Resumen general */}
                {chequeo.resumenGeneral && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {chequeo.resumenGeneral}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <span className="text-sm text-blue-600 font-medium">
                    Ver detalle →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Vista de detalle de un chequeo seleccionado
  function renderDetalleChequeo() {
    if (!chequeoSeleccionado) return null;

    // Reutilizar la vista de lectura pero con el chequeo seleccionado
    const chequeoTemp = chequeoActual;
    setChequeoActual(chequeoSeleccionado);
    const vista = renderVistaLectura();
    setChequeoActual(chequeoTemp);
    return vista;
  }

  // Vista de lectura del chequeo completado
  function renderVistaLectura() {
    if (!chequeoActual) return null;

    return (
      <div className="space-y-6">
        {/* Header con información del cuidador */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {chequeoActual.cuidadorNombre}
              </h2>
              <p className="text-sm text-gray-600">
                {new Date(chequeoActual.horaRegistro).toLocaleString('es-MX', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => exportarAPDF(chequeoActual)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar PDF
              </button>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Completado
              </span>
            </div>
          </div>
        </div>

        {/* 1. Estado General */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">1. Estado General</h3>

          {formData.actitud.length > 0 && (
            <div className="mb-3">
              <span className="text-sm font-medium text-gray-700">Actitud:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {formData.actitud.map(act => (
                  <span key={act} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {act}
                  </span>
                ))}
              </div>
            </div>
          )}

          {formData.nivelActividad && (
            <p className="mb-2"><span className="font-medium">Nivel de Actividad:</span> {formData.nivelActividad}</p>
          )}
          {formData.nivelCooperacion && (
            <p className="mb-2"><span className="font-medium">Nivel de Cooperación:</span> {formData.nivelCooperacion}</p>
          )}
          {formData.estadoSueno && (
            <p className="mb-2"><span className="font-medium">Estado del Sueño:</span> {formData.estadoSueno}</p>
          )}

          {formData.dolorNivel !== 'sin_dolor' && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
              <p className="font-medium text-red-900">Dolor: {formData.dolorNivel}</p>
              {formData.dolorUbicacion && <p className="text-sm text-red-800">Ubicación: {formData.dolorUbicacion}</p>}
              {formData.dolorDescripcion && <p className="text-sm text-red-800 mt-1">{formData.dolorDescripcion}</p>}
            </div>
          )}

          {formData.notasGenerales && (
            <div className="mt-3 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{formData.notasGenerales}</p>
            </div>
          )}
        </div>

        {/* 2. Alimentación */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">2. Alimentación</h3>

          {formData.kefirHora && (
            <div className="mb-3">
              <p className="font-medium text-gray-700">Kefir</p>
              <p className="text-sm text-gray-600">Hora: {formData.kefirHora} - {formData.kefirCantidad}</p>
              {formData.kefirNotas && <p className="text-sm text-gray-600">{formData.kefirNotas}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {formData.desayunoDescripcion && (
              <div className="p-3 bg-gray-50 rounded">
                <p className="font-medium text-sm text-gray-700">Desayuno</p>
                <p className="text-sm text-gray-600">{formData.desayunoDescripcion}</p>
                <p className="text-xs text-gray-500 mt-1">Consumió: {formData.desayunoCantidad || 'No especificado'}</p>
              </div>
            )}
            {formData.colacion1Descripcion && (
              <div className="p-3 bg-gray-50 rounded">
                <p className="font-medium text-sm text-gray-700">Colación 1</p>
                <p className="text-sm text-gray-600">{formData.colacion1Descripcion}</p>
                <p className="text-xs text-gray-500 mt-1">Consumió: {formData.colacion1Cantidad || 'No especificado'}</p>
              </div>
            )}
            {formData.almuerzoDescripcion && (
              <div className="p-3 bg-gray-50 rounded">
                <p className="font-medium text-sm text-gray-700">Almuerzo</p>
                <p className="text-sm text-gray-600">{formData.almuerzoDescripcion}</p>
                <p className="text-xs text-gray-500 mt-1">Consumió: {formData.almuerzoCantidad || 'No especificado'}</p>
              </div>
            )}
            {formData.colacion2Descripcion && (
              <div className="p-3 bg-gray-50 rounded">
                <p className="font-medium text-sm text-gray-700">Colación 2</p>
                <p className="text-sm text-gray-600">{formData.colacion2Descripcion}</p>
                <p className="text-xs text-gray-500 mt-1">Consumió: {formData.colacion2Cantidad || 'No especificado'}</p>
              </div>
            )}
            {formData.cenaDescripcion && (
              <div className="p-3 bg-gray-50 rounded">
                <p className="font-medium text-sm text-gray-700">Cena</p>
                <p className="text-sm text-gray-600">{formData.cenaDescripcion}</p>
                <p className="text-xs text-gray-500 mt-1">Consumió: {formData.cenaCantidad || 'No especificado'}</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            {formData.consumoAguaLitros && (
              <p className="text-sm text-gray-700 mb-2">💧 Agua: {formData.consumoAguaLitros}L</p>
            )}
            {formData.otrosLiquidos && (
              <p className="text-sm text-gray-700 mb-2">Otros líquidos: {formData.otrosLiquidos}</p>
            )}
            {formData.observacionesApetito && (
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-700">Observaciones de apetito:</p>
                <p className="text-sm text-gray-600 mt-1">{formData.observacionesApetito}</p>
              </div>
            )}
            {formData.alimentosRechazados && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm font-medium text-yellow-900">Alimentos rechazados:</p>
                <p className="text-sm text-yellow-800">{formData.alimentosRechazados}</p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Funciones Corporales */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">3. Funciones Corporales</h3>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Micciones</p>
              <p className="text-2xl font-bold text-gray-900">{formData.miccionesNumero}</p>
              {formData.miccionesCaracteristicas && (
                <p className="text-xs text-gray-600 mt-1">{formData.miccionesCaracteristicas}</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Evacuaciones</p>
              <p className="text-2xl font-bold text-gray-900">{formData.evacuacionesNumero}</p>
              {formData.evacuacionesConsistencia && (
                <p className="text-xs text-gray-600 mt-1">Consistencia: {formData.evacuacionesConsistencia}</p>
              )}
              {formData.evacuacionesColor && (
                <p className="text-xs text-gray-600">Color: {formData.evacuacionesColor}</p>
              )}
            </div>
          </div>

          {formData.dificultadEvacuar && (
            <div className="p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
              ⚠️ Presentó dificultad para evacuar
            </div>
          )}

          {formData.laxantes.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Laxantes utilizados:</p>
              <div className="space-y-1">
                {formData.laxantes.map((lax, idx) => (
                  <p key={idx} className="text-sm text-gray-600">• {lax.nombre} - {lax.cantidad}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 4. Actividades Realizadas */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">4. Actividades Realizadas</h3>

          {formData.actividadesRealizadas.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.actividadesRealizadas.map(act => (
                <span key={act} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                  {act}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-3">No se registraron actividades</p>
          )}

          {formData.participacionActitud && (
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-sm font-medium text-gray-700 mb-1">Participación y Actitud:</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{formData.participacionActitud}</p>
            </div>
          )}
        </div>

        {/* 5. Medicación */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">5. Medicación</h3>

          <div className="mb-3">
            {formData.medicacionEnTiempoForma ? (
              <p className="text-green-700">✓ Medicación administrada en tiempo y forma</p>
            ) : (
              <p className="text-red-700">✗ Medicación NO administrada en tiempo y forma</p>
            )}
          </div>

          {formData.medicamentosAdicionales.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Medicamentos adicionales:</p>
              <div className="space-y-2">
                {formData.medicamentosAdicionales.map((med, idx) => (
                  <div key={idx} className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    <p className="font-medium text-blue-900">{med.nombre} - {med.dosis}</p>
                    <p className="text-blue-800">Hora: {med.hora} | Motivo: {med.motivo}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.medicamentosRechazados.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Medicamentos rechazados:</p>
              <div className="space-y-2">
                {formData.medicamentosRechazados.map((med, idx) => (
                  <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                    <p className="font-medium text-red-900">{med.nombre}</p>
                    <p className="text-red-800">Motivo: {med.motivo}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.observacionesMedicacion && (
            <div className="mt-3 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{formData.observacionesMedicacion}</p>
            </div>
          )}
        </div>

        {/* 6. Incidentes */}
        {formData.incidentes.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">6. Incidentes</h3>

            <div className="space-y-3">
              {formData.incidentes.map((inc, idx) => (
                <div
                  key={idx}
                  className={`p-4 border-l-4 rounded ${
                    inc.gravedad === 'grave' ? 'bg-red-50 border-red-500' :
                    inc.gravedad === 'moderada' ? 'bg-orange-50 border-orange-500' :
                    'bg-yellow-50 border-yellow-500'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-gray-900">{inc.tipo}</p>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      inc.gravedad === 'grave' ? 'bg-red-200 text-red-900' :
                      inc.gravedad === 'moderada' ? 'bg-orange-200 text-orange-900' :
                      'bg-yellow-200 text-yellow-900'
                    }`}>
                      {inc.gravedad.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{inc.descripcion}</p>
                  <p className="text-xs text-gray-600 mb-1">Hora: {inc.hora}</p>
                  <div className="mt-2 p-2 bg-white rounded">
                    <p className="text-xs font-medium text-gray-700">Acción tomada:</p>
                    <p className="text-sm text-gray-600">{inc.accionTomada}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Resumen del Día */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">7. Resumen del Día</h3>

          {formData.resumenGeneral && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Resumen General:</p>
              <p className="text-gray-700 whitespace-pre-wrap">{formData.resumenGeneral}</p>
            </div>
          )}

          {formData.observacionesImportantes && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm font-medium text-yellow-900 mb-2">⚠️ Observaciones Importantes:</p>
              <p className="text-yellow-800 whitespace-pre-wrap">{formData.observacionesImportantes}</p>
            </div>
          )}

          {formData.recomendacionesSiguienteTurno && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm font-medium text-blue-900 mb-2">📋 Recomendaciones para el siguiente turno:</p>
              <p className="text-blue-800 whitespace-pre-wrap">{formData.recomendacionesSiguienteTurno}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Chequeo Diario
                </h1>
                <p className="text-gray-600 mt-1">
                  {vistaActual === 'hoy'
                    ? new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    : vistaActual === 'historial'
                    ? 'Historial de los últimos 30 días'
                    : chequeoSeleccionado?.fecha instanceof Date
                      ? chequeoSeleccionado.fecha.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                      : ''
                  }
                </p>
              </div>
              {ultimoGuardado && vistaActual === 'hoy' && (
                <div className="text-sm text-gray-500">
                  {saving ? (
                    <span className="text-blue-600">Guardando...</span>
                  ) : (
                    <span>✓ Guardado {ultimoGuardado.toLocaleTimeString()}</span>
                  )}
                </div>
              )}
            </div>

            {/* Indicador de cambios sin guardar */}
            {isDirty && vistaActual === 'hoy' && !chequeoActual?.completado && (
              <span className="text-sm text-orange-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                Cambios sin guardar
              </span>
            )}

            {/* Navegación entre vistas */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (vistaActual === 'hoy') return;
                  confirmNavigation(() => {
                    setVistaActual('hoy');
                    cargarChequeoDelDia();
                  });
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  vistaActual === 'hoy'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📋 Hoy
              </button>
              <button
                onClick={() => {
                  if (vistaActual === 'historial') return;
                  confirmNavigation(() => {
                    setVistaActual('historial');
                    cargarHistorialChequeos();
                  });
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  vistaActual === 'historial'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📚 Historial
              </button>
              {vistaActual === 'detalle' && (
                <button
                  onClick={() => {
                    setVistaActual('historial');
                    setChequeoSeleccionado(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  ← Volver al Historial
                </button>
              )}
            </div>
          </div>

          {/* Renderizar vista según estado actual */}
          {vistaActual === 'historial' ? (
            renderHistorial()
          ) : vistaActual === 'detalle' ? (
            renderDetalleChequeo()
          ) : yaCompletado ? (
            renderVistaLectura()
          ) : (
            <div className="space-y-6">
              {/* Sección 1: Estado General */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                1. Estado General
              </h2>

              <div className="space-y-4">
                {/* Actitud */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actitud (puede seleccionar varias)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['tranquila', 'activa', 'inquieta', 'ansiosa', 'alegre', 'triste'].map(opcion => (
                      <button
                        key={opcion}
                        type="button"
                        disabled={yaCompletado}
                        onClick={() => toggleActitud(opcion)}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          formData.actitud.includes(opcion)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        } ${yaCompletado ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {opcion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nivel de Actividad */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nivel de Actividad
                  </label>
                  <select
                    value={formData.nivelActividad}
                    onChange={(e) => setFormData({ ...formData, nivelActividad: e.target.value })}
                    disabled={yaCompletado}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="muy_baja">Muy baja</option>
                    <option value="baja">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>

                {/* Nivel de Cooperación */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nivel de Cooperación
                  </label>
                  <select
                    value={formData.nivelCooperacion}
                    onChange={(e) => setFormData({ ...formData, nivelCooperacion: e.target.value })}
                    disabled={yaCompletado}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="excelente">Excelente</option>
                    <option value="buena">Buena</option>
                    <option value="regular">Regular</option>
                    <option value="dificil">Difícil</option>
                  </select>
                </div>

                {/* Estado del Sueño */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado del Sueño
                  </label>
                  <select
                    value={formData.estadoSueno}
                    onChange={(e) => setFormData({ ...formData, estadoSueno: e.target.value })}
                    disabled={yaCompletado}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="excelente">Excelente - durmió toda la noche</option>
                    <option value="bueno">Bueno - solo despertó 1-2 veces</option>
                    <option value="regular">Regular - despertó varias veces</option>
                    <option value="malo">Malo - no pudo dormir bien</option>
                  </select>
                </div>

                {/* Dolor */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dolor
                  </label>
                  <div className="space-y-3">
                    <div>
                      <select
                        value={formData.dolorNivel}
                        onChange={(e) => setFormData({ ...formData, dolorNivel: e.target.value as any })}
                        disabled={yaCompletado}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        <option value="sin_dolor">Sin dolor</option>
                        <option value="leve">Leve</option>
                        <option value="moderado">Moderado</option>
                        <option value="severo">Severo</option>
                      </select>
                    </div>
                    {formData.dolorNivel !== 'sin_dolor' && (
                      <>
                        <input
                          type="text"
                          value={formData.dolorUbicacion}
                          onChange={(e) => setFormData({ ...formData, dolorUbicacion: e.target.value })}
                          disabled={yaCompletado}
                          placeholder="Ubicación del dolor"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                        <textarea
                          value={formData.dolorDescripcion}
                          onChange={(e) => setFormData({ ...formData, dolorDescripcion: e.target.value })}
                          disabled={yaCompletado}
                          placeholder="Descripción del dolor"
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Notas Generales */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas Generales
                  </label>
                  <textarea
                    value={formData.notasGenerales}
                    onChange={(e) => setFormData({ ...formData, notasGenerales: e.target.value })}
                    disabled={yaCompletado}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Observaciones generales sobre el estado del paciente..."
                  />
                </div>
              </div>
            </div>

            {/* Sección 2: Alimentación */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                2. Alimentación
              </h2>

              <div className="space-y-4">
                {/* Kefir */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-3">Kefir</h3>
                  <div className="space-y-3">
                    {/* Selector de hora con dropdowns */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">Hora</label>
                      <div className="flex items-center gap-2">
                        <select
                          value={formData.kefirHora.split(':')[0] || ''}
                          onChange={(e) => {
                            const minutos = formData.kefirHora.split(':')[1] || '00';
                            setFormData({ ...formData, kefirHora: e.target.value ? `${e.target.value}:${minutos}` : '' });
                          }}
                          disabled={yaCompletado}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 bg-white"
                        >
                          <option value="">--</option>
                          {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span className="text-gray-500 font-medium">:</span>
                        <select
                          value={formData.kefirHora.split(':')[1] || ''}
                          onChange={(e) => {
                            const hora = formData.kefirHora.split(':')[0] || '07';
                            setFormData({ ...formData, kefirHora: `${hora}:${e.target.value}` });
                          }}
                          disabled={yaCompletado || !formData.kefirHora.split(':')[0]}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 bg-white"
                        >
                          <option value="">--</option>
                          {['00', '15', '30', '45'].map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={formData.kefirCantidad}
                        onChange={(e) => setFormData({ ...formData, kefirCantidad: e.target.value })}
                        disabled={yaCompletado}
                        placeholder="Cantidad (ej: 1 vaso)"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        value={formData.kefirNotas}
                        onChange={(e) => setFormData({ ...formData, kefirNotas: e.target.value })}
                        disabled={yaCompletado}
                        placeholder="Notas"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Desayuno */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Desayuno</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={formData.desayunoDescripcion}
                      onChange={(e) => setFormData({ ...formData, desayunoDescripcion: e.target.value })}
                      disabled={yaCompletado}
                      placeholder="Descripción"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <select
                      value={formData.desayunoCantidad}
                      onChange={(e) => setFormData({ ...formData, desayunoCantidad: e.target.value })}
                      disabled={yaCompletado}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">Cantidad consumida</option>
                      <option value="todo">Todo</option>
                      <option value="mayor_parte">Mayor parte (75%)</option>
                      <option value="mitad">Mitad (50%)</option>
                      <option value="poco">Poco (25%)</option>
                      <option value="nada">Nada</option>
                    </select>
                  </div>
                </div>

                {/* Colación 1 */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Colación 1</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={formData.colacion1Descripcion}
                      onChange={(e) => setFormData({ ...formData, colacion1Descripcion: e.target.value })}
                      disabled={yaCompletado}
                      placeholder="Descripción"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <select
                      value={formData.colacion1Cantidad}
                      onChange={(e) => setFormData({ ...formData, colacion1Cantidad: e.target.value })}
                      disabled={yaCompletado}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">Cantidad consumida</option>
                      <option value="todo">Todo</option>
                      <option value="mayor_parte">Mayor parte</option>
                      <option value="mitad">Mitad</option>
                      <option value="poco">Poco</option>
                      <option value="nada">Nada</option>
                    </select>
                  </div>
                </div>

                {/* Almuerzo */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Almuerzo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={formData.almuerzoDescripcion}
                      onChange={(e) => setFormData({ ...formData, almuerzoDescripcion: e.target.value })}
                      disabled={yaCompletado}
                      placeholder="Descripción"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <select
                      value={formData.almuerzoCantidad}
                      onChange={(e) => setFormData({ ...formData, almuerzoCantidad: e.target.value })}
                      disabled={yaCompletado}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">Cantidad consumida</option>
                      <option value="todo">Todo</option>
                      <option value="mayor_parte">Mayor parte</option>
                      <option value="mitad">Mitad</option>
                      <option value="poco">Poco</option>
                      <option value="nada">Nada</option>
                    </select>
                  </div>
                </div>

                {/* Colación 2 */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Colación 2</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={formData.colacion2Descripcion}
                      onChange={(e) => setFormData({ ...formData, colacion2Descripcion: e.target.value })}
                      disabled={yaCompletado}
                      placeholder="Descripción"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <select
                      value={formData.colacion2Cantidad}
                      onChange={(e) => setFormData({ ...formData, colacion2Cantidad: e.target.value })}
                      disabled={yaCompletado}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">Cantidad consumida</option>
                      <option value="todo">Todo</option>
                      <option value="mayor_parte">Mayor parte</option>
                      <option value="mitad">Mitad</option>
                      <option value="poco">Poco</option>
                      <option value="nada">Nada</option>
                    </select>
                  </div>
                </div>

                {/* Cena */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Cena</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={formData.cenaDescripcion}
                      onChange={(e) => setFormData({ ...formData, cenaDescripcion: e.target.value })}
                      disabled={yaCompletado}
                      placeholder="Descripción"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <select
                      value={formData.cenaCantidad}
                      onChange={(e) => setFormData({ ...formData, cenaCantidad: e.target.value })}
                      disabled={yaCompletado}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">Cantidad consumida</option>
                      <option value="todo">Todo</option>
                      <option value="mayor_parte">Mayor parte</option>
                      <option value="mitad">Mitad</option>
                      <option value="poco">Poco</option>
                      <option value="nada">Nada</option>
                    </select>
                  </div>
                </div>

                {/* Consumo de líquidos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Consumo de agua (litros)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.consumoAguaLitros}
                      onChange={(e) => setFormData({ ...formData, consumoAguaLitros: e.target.value })}
                      disabled={yaCompletado}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Otros líquidos
                    </label>
                    <input
                      type="text"
                      value={formData.otrosLiquidos}
                      onChange={(e) => setFormData({ ...formData, otrosLiquidos: e.target.value })}
                      disabled={yaCompletado}
                      placeholder="Ej: 2 tazas de té"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>

                {/* Observaciones de apetito */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observaciones de apetito
                  </label>
                  <textarea
                    value={formData.observacionesApetito}
                    onChange={(e) => setFormData({ ...formData, observacionesApetito: e.target.value })}
                    disabled={yaCompletado}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Comentarios sobre el apetito..."
                  />
                </div>

                {/* Alimentos rechazados */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alimentos rechazados
                  </label>
                  <input
                    type="text"
                    value={formData.alimentosRechazados}
                    onChange={(e) => setFormData({ ...formData, alimentosRechazados: e.target.value })}
                    disabled={yaCompletado}
                    placeholder="Alimentos que rechazó..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>

            {/* Sección 3: Funciones Corporales */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                3. Funciones Corporales
              </h2>

              <div className="space-y-4">
                {/* Micciones */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de micciones
                    </label>
                    <input
                      type="number"
                      value={formData.miccionesNumero}
                      onChange={(e) => setFormData({ ...formData, miccionesNumero: parseInt(e.target.value) || 0 })}
                      disabled={yaCompletado}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Características
                    </label>
                    <input
                      type="text"
                      value={formData.miccionesCaracteristicas}
                      onChange={(e) => setFormData({ ...formData, miccionesCaracteristicas: e.target.value })}
                      disabled={yaCompletado}
                      placeholder="Color, olor, etc."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>

                {/* Evacuaciones */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de evacuaciones
                    </label>
                    <input
                      type="number"
                      value={formData.evacuacionesNumero}
                      onChange={(e) => setFormData({ ...formData, evacuacionesNumero: parseInt(e.target.value) || 0 })}
                      disabled={yaCompletado}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Consistencia
                    </label>
                    <select
                      value={formData.evacuacionesConsistencia}
                      onChange={(e) => setFormData({ ...formData, evacuacionesConsistencia: e.target.value })}
                      disabled={yaCompletado}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="normal">Normal</option>
                      <option value="blanda">Blanda</option>
                      <option value="dura">Dura</option>
                      <option value="liquida">Líquida</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Color
                    </label>
                    <input
                      type="text"
                      value={formData.evacuacionesColor}
                      onChange={(e) => setFormData({ ...formData, evacuacionesColor: e.target.value })}
                      disabled={yaCompletado}
                      placeholder="Color"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>

                {/* Dificultad para evacuar */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="dificultadEvacuar"
                    checked={formData.dificultadEvacuar}
                    onChange={(e) => setFormData({ ...formData, dificultadEvacuar: e.target.checked })}
                    disabled={yaCompletado}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="dificultadEvacuar" className="ml-2 block text-sm text-gray-700">
                    Dificultad para evacuar
                  </label>
                </div>

                {/* Laxantes */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Laxantes utilizados
                    </label>
                    {!yaCompletado && (
                      <button
                        type="button"
                        onClick={agregarLaxante}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        + Agregar laxante
                      </button>
                    )}
                  </div>
                  {formData.laxantes.map((laxante, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={laxante.nombre}
                        onChange={(e) => updateLaxante(index, 'nombre', e.target.value)}
                        disabled={yaCompletado}
                        placeholder="Nombre del laxante"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        value={laxante.cantidad}
                        onChange={(e) => updateLaxante(index, 'cantidad', e.target.value)}
                        disabled={yaCompletado}
                        placeholder="Cantidad"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      {!yaCompletado && (
                        <button
                          type="button"
                          onClick={() => eliminarLaxante(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sección 4: Actividades Realizadas */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                4. Actividades Realizadas
              </h2>

              <div className="space-y-4">
                {/* Actividades */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actividades (puede seleccionar varias)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Fisioterapia',
                      'Ejercicios intestinales',
                      'Caminata matutina',
                      'Caminata vespertina',
                      'Actividades recreativas',
                      'Actividades cognitivas',
                      'Conversación',
                      'Música',
                      'Lectura'
                    ].map(actividad => (
                      <button
                        key={actividad}
                        type="button"
                        disabled={yaCompletado}
                        onClick={() => toggleActividad(actividad)}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          formData.actividadesRealizadas.includes(actividad)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        } ${yaCompletado ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {actividad}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Participación y actitud */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Participación y Actitud
                  </label>
                  <textarea
                    value={formData.participacionActitud}
                    onChange={(e) => setFormData({ ...formData, participacionActitud: e.target.value })}
                    disabled={yaCompletado}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Describe la participación y actitud durante las actividades..."
                  />
                </div>
              </div>
            </div>

            {/* Sección 5: Medicación */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                5. Medicación
              </h2>

              <div className="space-y-4">
                {/* Medicación en tiempo y forma */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="medicacionEnTiempoForma"
                    checked={formData.medicacionEnTiempoForma}
                    onChange={(e) => setFormData({ ...formData, medicacionEnTiempoForma: e.target.checked })}
                    disabled={yaCompletado}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="medicacionEnTiempoForma" className="ml-2 block text-sm font-medium text-gray-700">
                    ✓ Medicación administrada en tiempo y forma
                    {adherenciaAutomatica && (
                      <span className="ml-2 text-xs text-green-600">(Adherencia 100% detectada)</span>
                    )}
                  </label>
                </div>

                {/* Lista de medicamentos del día */}
                {registrosMedicamentos.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Medicamentos del Día:</h4>
                    <div className="space-y-2">
                      {registrosMedicamentos.map((reg, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-gray-900">{reg.medicamentoNombre}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            reg.estado === 'tomado' ? 'bg-green-100 text-green-800' :
                            reg.estado === 'rechazado' ? 'bg-red-100 text-red-800' :
                            reg.estado === 'omitido' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {reg.estado === 'tomado' ? '✓ Tomado' :
                             reg.estado === 'rechazado' ? '✗ Rechazado' :
                             reg.estado === 'omitido' ? '⊗ Omitido' :
                             'Pendiente'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Ver detalles en <a href="/pastillero-diario" className="text-blue-600 hover:underline">Pastillero Diario</a>
                    </p>
                  </div>
                )}

                {/* Medicamentos adicionales */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Medicamentos Adicionales (fuera del pastillero)
                    </label>
                    {!yaCompletado && (
                      <button
                        type="button"
                        onClick={agregarMedicamentoAdicional}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        + Agregar medicamento
                      </button>
                    )}
                  </div>
                  {formData.medicamentosAdicionales.map((med, index) => (
                    <div key={index} className="grid grid-cols-4 gap-2 mb-2">
                      <input
                        type="text"
                        value={med.nombre}
                        onChange={(e) => updateMedicamentoAdicional(index, 'nombre', e.target.value)}
                        disabled={yaCompletado}
                        placeholder="Nombre"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        value={med.dosis}
                        onChange={(e) => updateMedicamentoAdicional(index, 'dosis', e.target.value)}
                        disabled={yaCompletado}
                        placeholder="Dosis"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        value={med.motivo}
                        onChange={(e) => updateMedicamentoAdicional(index, 'motivo', e.target.value)}
                        disabled={yaCompletado}
                        placeholder="Motivo"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <div className="flex gap-2">
                        <input
                          type="time"
                          value={med.hora}
                          onChange={(e) => updateMedicamentoAdicional(index, 'hora', e.target.value)}
                          disabled={yaCompletado}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                        {!yaCompletado && (
                          <button
                            type="button"
                            onClick={() => eliminarMedicamentoAdicional(index)}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Medicamentos rechazados */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Medicamentos Rechazados
                    </label>
                    {!yaCompletado && (
                      <button
                        type="button"
                        onClick={agregarMedicamentoRechazado}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        + Agregar
                      </button>
                    )}
                  </div>
                  {formData.medicamentosRechazados.map((med, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={med.nombre}
                        onChange={(e) => updateMedicamentoRechazado(index, 'nombre', e.target.value)}
                        disabled={yaCompletado}
                        placeholder="Nombre del medicamento"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        value={med.motivo}
                        onChange={(e) => updateMedicamentoRechazado(index, 'motivo', e.target.value)}
                        disabled={yaCompletado}
                        placeholder="Motivo"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      {!yaCompletado && (
                        <button
                          type="button"
                          onClick={() => eliminarMedicamentoRechazado(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Observaciones de medicación */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observaciones
                  </label>
                  <textarea
                    value={formData.observacionesMedicacion}
                    onChange={(e) => setFormData({ ...formData, observacionesMedicacion: e.target.value })}
                    disabled={yaCompletado}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Observaciones sobre la medicación..."
                  />
                </div>
              </div>
            </div>

            {/* Sección 6: Incidentes */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                6. Incidentes
              </h2>

              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-gray-600">
                    Registra cualquier incidente o situación inusual
                  </p>
                  {!yaCompletado && (
                    <button
                      type="button"
                      onClick={agregarIncidente}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg"
                    >
                      + Agregar Incidente
                    </button>
                  )}
                </div>

                {formData.incidentes.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    No se han registrado incidentes
                  </p>
                ) : (
                  formData.incidentes.map((incidente, index) => (
                    <div key={index} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <input
                          type="text"
                          value={incidente.tipo}
                          onChange={(e) => updateIncidente(index, 'tipo', e.target.value)}
                          disabled={yaCompletado}
                          placeholder="Tipo de incidente"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                        <div className="flex gap-2">
                          <input
                            type="time"
                            value={incidente.hora}
                            onChange={(e) => updateIncidente(index, 'hora', e.target.value)}
                            disabled={yaCompletado}
                            placeholder="Hora"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                          />
                          <select
                            value={incidente.gravedad}
                            onChange={(e) => updateIncidente(index, 'gravedad', e.target.value)}
                            disabled={yaCompletado}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                          >
                            <option value="leve">Leve</option>
                            <option value="moderada">Moderada</option>
                            <option value="grave">Grave</option>
                          </select>
                        </div>
                      </div>
                      <textarea
                        value={incidente.descripcion}
                        onChange={(e) => updateIncidente(index, 'descripcion', e.target.value)}
                        disabled={yaCompletado}
                        placeholder="Descripción del incidente..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 mb-2"
                      />
                      <div className="flex gap-2">
                        <textarea
                          value={incidente.accionTomada}
                          onChange={(e) => updateIncidente(index, 'accionTomada', e.target.value)}
                          disabled={yaCompletado}
                          placeholder="Acción tomada..."
                          rows={2}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                        {!yaCompletado && (
                          <button
                            type="button"
                            onClick={() => eliminarIncidente(index)}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg self-start"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sección 7: Resumen */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                7. Resumen del Día
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resumen General
                  </label>
                  <textarea
                    value={formData.resumenGeneral}
                    onChange={(e) => setFormData({ ...formData, resumenGeneral: e.target.value })}
                    disabled={yaCompletado}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Resumen general del día..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observaciones Importantes
                  </label>
                  <textarea
                    value={formData.observacionesImportantes}
                    onChange={(e) => setFormData({ ...formData, observacionesImportantes: e.target.value })}
                    disabled={yaCompletado}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Observaciones importantes que el familiar o médico deben saber..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recomendaciones para el Siguiente Turno
                  </label>
                  <textarea
                    value={formData.recomendacionesSiguienteTurno}
                    onChange={(e) => setFormData({ ...formData, recomendacionesSiguienteTurno: e.target.value })}
                    disabled={yaCompletado}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Recomendaciones para el cuidador del siguiente turno..."
                  />
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={guardarBorrador}
                disabled={saving}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Borrador'}
              </button>
              <button
                type="button"
                onClick={handleCompletarChequeo}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Completar Chequeo
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </Layout>
  );
}
