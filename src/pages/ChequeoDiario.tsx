import { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ChequeoDiario, RegistroMedicamento, ItemInventario } from '../types';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/common/Layout';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import BristolScaleSelector from '../components/chequeo/BristolScaleSelector';
import { getBristolNombre, migrarABristolArray } from '../constants/bristol';

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

  // Estados para consumibles
  const [consumiblesDisponibles, setConsumiblesDisponibles] = useState<ItemInventario[]>([]);

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

    // Funciones corporales
    miccionesNumero: '' as string | number,
    miccionesCaracteristicas: '',
    evacuacionesNumero: '' as string | number,
    evacuacionesConsistencia: '', // DEPRECADO: usar evacuacionesBristol
    evacuacionesBristol: [] as string[],
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
    recomendacionesSiguienteTurno: '',

    // Consumibles usados
    consumiblesUsados: [] as Array<{ itemId: string; itemNombre: string; cantidad: number; comentario: string }>,

    // Cambio de sábanas
    cambioSabanas: false,
  });

  useEffect(() => {
    cargarChequeoDelDia();
    verificarAdherenciaMedicamentos();
    cargarConsumiblesDisponibles();
  }, []);

  // Detectar cambios en el formulario para marcar como dirty
  useEffect(() => {
    // Solo marcar como dirty si no es el estado inicial
    if (!loading && chequeoActual) {
      setIsDirty(true);
    }
  }, [formData]);

  // Guardado automático cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty) {
        guardarChequeo();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [formData, isDirty]);

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

          miccionesNumero: chequeoData.funcionesCorporales?.miccionesNumero ?? '',
          miccionesCaracteristicas: chequeoData.funcionesCorporales?.miccionesCaracteristicas || '',
          evacuacionesNumero: chequeoData.funcionesCorporales?.evacuacionesNumero ?? '',
          evacuacionesConsistencia: chequeoData.funcionesCorporales?.evacuacionesConsistencia || '',
          evacuacionesBristol: migrarABristolArray(
            chequeoData.funcionesCorporales?.evacuacionesConsistencia,
            chequeoData.funcionesCorporales?.evacuacionesBristol,
            chequeoData.funcionesCorporales?.evacuacionesNumero || 0
          ),
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
          recomendacionesSiguienteTurno: chequeoData.resumen?.recomendacionesSiguienteTurno || '',

          consumiblesUsados: chequeoData.consumiblesUsados || [],

          cambioSabanas: chequeoData.cambioSabanas || false
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

  // === FUNCIONES PARA CONSUMIBLES ===
  async function cargarConsumiblesDisponibles() {
    try {
      const q = query(
        collection(db, 'pacientes', PACIENTE_ID, 'inventario'),
        where('categoria', '==', 'consumible'),
        orderBy('nombre', 'asc')
      );
      const snapshot = await getDocs(q);
      const items: ItemInventario[] = [];

      snapshot.forEach((docItem) => {
        const data = docItem.data();
        items.push({
          id: docItem.id,
          pacienteId: data.pacienteId,
          nombre: data.nombre,
          categoria: data.categoria,
          cantidadMaestro: data.cantidadMaestro || 0,
          cantidadOperativo: data.cantidadOperativo || 0,
          unidad: data.unidad,
          nivelMinimoMaestro: data.nivelMinimoMaestro || 0,
          nivelMinimoOperativo: data.nivelMinimoOperativo || 0,
          tieneVidaUtil: data.tieneVidaUtil || false,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as ItemInventario);
      });

      setConsumiblesDisponibles(items);
    } catch (error) {
      console.error('Error cargando consumibles:', error);
    }
  }

  function agregarConsumible() {
    setFormData({
      ...formData,
      consumiblesUsados: [...formData.consumiblesUsados, { itemId: '', itemNombre: '', cantidad: 1, comentario: '' }]
    });
  }

  function eliminarConsumible(index: number) {
    setFormData({
      ...formData,
      consumiblesUsados: formData.consumiblesUsados.filter((_, i) => i !== index)
    });
  }

  function updateConsumible(index: number, campo: 'itemId' | 'cantidad' | 'comentario', valor: string | number) {
    const nuevosConsumibles = [...formData.consumiblesUsados];

    if (campo === 'itemId') {
      const item = consumiblesDisponibles.find(c => c.id === valor);
      nuevosConsumibles[index].itemId = valor as string;
      nuevosConsumibles[index].itemNombre = item?.nombre || '';
    } else if (campo === 'cantidad') {
      nuevosConsumibles[index].cantidad = valor as number;
    } else {
      nuevosConsumibles[index].comentario = valor as string;
    }

    setFormData({ ...formData, consumiblesUsados: nuevosConsumibles });
  }

  async function descontarConsumiblesDelInventario() {
    const ahora = Timestamp.now();

    for (const consumible of formData.consumiblesUsados) {
      if (!consumible.itemId || consumible.cantidad <= 0) continue;

      try {
        const itemRef = doc(db, 'pacientes', PACIENTE_ID, 'inventario', consumible.itemId);
        const itemDoc = await getDoc(itemRef);

        if (!itemDoc.exists()) continue;

        const itemData = itemDoc.data();
        const nuevaCantidad = Math.max(0, (itemData.cantidadOperativo || 0) - consumible.cantidad);

        await updateDoc(itemRef, {
          cantidadOperativo: nuevaCantidad,
          actualizadoEn: ahora,
        });

        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'movimientosInventario'), {
          pacienteId: PACIENTE_ID,
          tipo: 'salida',
          itemId: consumible.itemId,
          itemNombre: consumible.itemNombre,
          origen: 'operativo',
          destino: 'consumido',
          cantidad: consumible.cantidad,
          motivo: 'Consumo registrado en chequeo diario',
          notas: consumible.comentario || undefined,
          usuarioId: userProfile?.id || '',
          usuarioNombre: userProfile?.nombre || 'Usuario',
          fecha: ahora,
          creadoEn: ahora,
        });
      } catch (error) {
        console.error(`Error descontando consumible ${consumible.itemNombre}:`, error);
      }
    }
  }

  // Sincroniza consumibles: revierte eliminados/reducidos y descuenta nuevos/incrementados
  async function sincronizarConsumibles() {
    const ahora = Timestamp.now();
    const consumiblesGuardados = chequeoActual?.consumiblesUsados || [];
    const consumiblesActuales = formData.consumiblesUsados.filter(c => c.itemId && c.cantidad > 0);

    // 1. Revertir consumibles eliminados o reducidos
    for (const guardado of consumiblesGuardados) {
      const actual = consumiblesActuales.find(c => c.itemId === guardado.itemId);
      const cantidadGuardada = guardado.cantidad || 0;
      const cantidadActual = actual?.cantidad || 0;

      if (cantidadActual < cantidadGuardada) {
        // Hay que revertir la diferencia
        const cantidadARevertir = cantidadGuardada - cantidadActual;

        try {
          const itemRef = doc(db, 'pacientes', PACIENTE_ID, 'inventario', guardado.itemId);
          const itemDoc = await getDoc(itemRef);

          if (itemDoc.exists()) {
            const itemData = itemDoc.data();
            const nuevaCantidad = (itemData.cantidadOperativo || 0) + cantidadARevertir;

            await updateDoc(itemRef, {
              cantidadOperativo: nuevaCantidad,
              actualizadoEn: ahora,
            });

            await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'movimientosInventario'), {
              pacienteId: PACIENTE_ID,
              tipo: 'entrada',
              itemId: guardado.itemId,
              itemNombre: guardado.itemNombre,
              origen: 'consumido',
              destino: 'operativo',
              cantidad: cantidadARevertir,
              motivo: 'Reversión por edición de chequeo diario',
              usuarioId: userProfile?.id || '',
              usuarioNombre: userProfile?.nombre || 'Usuario',
              fecha: ahora,
              creadoEn: ahora,
            });
          }
        } catch (error) {
          console.error(`Error revirtiendo consumible ${guardado.itemNombre}:`, error);
        }
      }
    }

    // 2. Descontar consumibles nuevos o incrementados
    for (const actual of consumiblesActuales) {
      const guardado = consumiblesGuardados.find(c => c.itemId === actual.itemId);
      const cantidadGuardada = guardado?.cantidad || 0;
      const cantidadActual = actual.cantidad || 0;

      if (cantidadActual > cantidadGuardada) {
        // Hay que descontar la diferencia
        const cantidadADescontar = cantidadActual - cantidadGuardada;

        try {
          const itemRef = doc(db, 'pacientes', PACIENTE_ID, 'inventario', actual.itemId);
          const itemDoc = await getDoc(itemRef);

          if (itemDoc.exists()) {
            const itemData = itemDoc.data();
            const nuevaCantidad = Math.max(0, (itemData.cantidadOperativo || 0) - cantidadADescontar);

            await updateDoc(itemRef, {
              cantidadOperativo: nuevaCantidad,
              actualizadoEn: ahora,
            });

            await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'movimientosInventario'), {
              pacienteId: PACIENTE_ID,
              tipo: 'salida',
              itemId: actual.itemId,
              itemNombre: actual.itemNombre,
              origen: 'operativo',
              destino: 'consumido',
              cantidad: cantidadADescontar,
              motivo: 'Consumo registrado en chequeo diario',
              notas: actual.comentario || undefined,
              usuarioId: userProfile?.id || '',
              usuarioNombre: userProfile?.nombre || 'Usuario',
              fecha: ahora,
              creadoEn: ahora,
            });
          }
        } catch (error) {
          console.error(`Error descontando consumible ${actual.itemNombre}:`, error);
        }
      }
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

    // Helper para convertir Timestamp de Firestore a Date
    const toDate = (value: any): Date | null => {
      if (!value) return null;
      if (value instanceof Date) return value;
      if (typeof value.toDate === 'function') return value.toDate();
      if (typeof value === 'string' || typeof value === 'number') return new Date(value);
      return null;
    };

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Chequeo Diario - Mamá Yola', 105, yPos, { align: 'center' });
    yPos += 10;

    // Fecha y cuidador
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const fechaDate = toDate(chequeo.fecha);
    const fecha = fechaDate
      ? fechaDate.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'Fecha no disponible';
    doc.text(`Fecha: ${fecha}`, 20, yPos);
    yPos += 7;
    doc.text(`Cuidador: ${chequeo.cuidadorNombre || 'No especificado'}`, 20, yPos);
    yPos += 7;
    const horaDate = toDate(chequeo.horaRegistro);
    doc.text(`Hora de registro: ${horaDate ? horaDate.toLocaleTimeString('es-MX') : 'No disponible'}`, 20, yPos);
    yPos += 12;

    // Sección 1: Estado General
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Estado General', 20, yPos);
    yPos += 8;

    // Mapear actitudes a nombres legibles
    const actitudLabels: Record<string, string> = {
      positiva: 'Positiva / Adaptativa',
      negativa: 'Negativa / Pesimista',
      aislamiento: 'Aislamiento / Apatía',
      enfado: 'Enfado / Resentimiento',
      dependencia: 'Dependencia'
    };
    const actitudes = chequeo.estadoGeneral?.actitud?.map(a => actitudLabels[a] || a).join(', ') || 'No registrado';

    // Construir info de dolor
    let dolorInfo = 'Sin dolor';
    if (chequeo.estadoGeneral?.dolor && chequeo.estadoGeneral.dolor.nivel !== 'sin_dolor') {
      dolorInfo = `${chequeo.estadoGeneral.dolor.nivel}`;
      if (chequeo.estadoGeneral.dolor.ubicacion) dolorInfo += ` - ${chequeo.estadoGeneral.dolor.ubicacion}`;
      if (chequeo.estadoGeneral.dolor.descripcion) dolorInfo += ` (${chequeo.estadoGeneral.dolor.descripcion})`;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
      startY: yPos,
      head: [['Campo', 'Valor']],
      body: [
        ['Actitud', actitudes],
        ['Nivel de Actividad', chequeo.estadoGeneral?.nivelActividad || 'No registrado'],
        ['Nivel de Cooperación', chequeo.estadoGeneral?.nivelCooperacion || 'No registrado'],
        ['Estado del Sueño', chequeo.estadoGeneral?.estadoSueno || 'No registrado'],
        ['Dolor', dolorInfo],
        ['Notas Generales', chequeo.estadoGeneral?.notasGenerales || 'Ninguna']
      ],
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: 20, right: 20 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Sección 2: Funciones Corporales
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Funciones Corporales', 20, yPos);
    yPos += 8;

    // Laxantes
    const laxantes = chequeo.funcionesCorporales?.laxantesUsados?.map(l => `${l.nombre} (${l.cantidad})`).join(', ') || 'Ninguno';

    doc.setFontSize(10);
    autoTable(doc, {
      startY: yPos,
      head: [['Campo', 'Valor']],
      body: [
        ['Número de micciones', `${chequeo.funcionesCorporales?.miccionesNumero ?? 0}`],
        ['Características micciones', chequeo.funcionesCorporales?.miccionesCaracteristicas || 'Normal'],
        ['Número de evacuaciones', `${chequeo.funcionesCorporales?.evacuacionesNumero ?? 0}`],
        ['Consistencia (Bristol)', chequeo.funcionesCorporales?.evacuacionesBristol?.length
          ? chequeo.funcionesCorporales.evacuacionesBristol.map((b, i) =>
              `${chequeo.funcionesCorporales!.evacuacionesBristol!.length > 1 ? `#${i+1}: ` : ''}${getBristolNombre(b)}`
            ).filter(Boolean).join(', ') || 'No registrada'
          : 'No registrada'],
        ['Color evacuaciones', chequeo.funcionesCorporales?.evacuacionesColor || 'No registrado'],
        ['Dificultad para evacuar', chequeo.funcionesCorporales?.dificultadEvacuar ? 'Sí' : 'No'],
        ['Laxantes utilizados', laxantes]
      ],
      theme: 'grid',
      headStyles: { fillColor: [240, 173, 78] },
      margin: { left: 20, right: 20 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Sección 3: Medicación
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Medicación', 20, yPos);
    yPos += 8;

    // Medicamentos adicionales y rechazados
    const medsAdicionales = chequeo.medicacion?.medicamentosAdicionales?.map(m => `${m.nombre} ${m.dosis} - ${m.motivo} (${m.hora})`).join('; ') || 'Ninguno';
    const medsRechazados = chequeo.medicacion?.medicamentosRechazados?.map(m => `${m.nombre} - ${m.motivo}`).join('; ') || 'Ninguno';

    doc.setFontSize(10);
    autoTable(doc, {
      startY: yPos,
      head: [['Campo', 'Valor']],
      body: [
        ['Medicación en tiempo y forma', chequeo.medicacion?.medicacionEnTiempoForma ? '✓ Sí' : '✗ No'],
        ['Medicamentos adicionales', medsAdicionales],
        ['Medicamentos rechazados', medsRechazados],
        ['Observaciones', chequeo.medicacion?.observaciones || 'Ninguna']
      ],
      theme: 'grid',
      headStyles: { fillColor: [217, 83, 79] },
      margin: { left: 20, right: 20 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Sección 4: Incidentes (si hay)
    if (chequeo.incidentes && chequeo.incidentes.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('4. Incidentes Reportados', 20, yPos);
      yPos += 8;

      const incidentesData = chequeo.incidentes.map(inc => [
        inc.tipo,
        inc.descripcion,
        inc.hora,
        inc.gravedad,
        inc.accionTomada
      ]);

      doc.setFontSize(10);
      autoTable(doc, {
        startY: yPos,
        head: [['Tipo', 'Descripción', 'Hora', 'Gravedad', 'Acción Tomada']],
        body: incidentesData,
        theme: 'grid',
        headStyles: { fillColor: [192, 57, 43] },
        margin: { left: 20, right: 20 },
        columnStyles: {
          1: { cellWidth: 50 },
          4: { cellWidth: 40 }
        }
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Sección 5: Resumen
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Resumen del Día', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const resumen = chequeo.resumen?.resumenGeneral || 'No se proporcionó resumen';
    const splitResumen = doc.splitTextToSize(resumen, 170);
    doc.text(splitResumen, 20, yPos);
    yPos += splitResumen.length * 5 + 8;

    if (chequeo.resumen?.observacionesImportantes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Observaciones Importantes:', 20, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      const splitObs = doc.splitTextToSize(chequeo.resumen.observacionesImportantes, 170);
      doc.text(splitObs, 20, yPos);
      yPos += splitObs.length * 5 + 8;
    }

    if (chequeo.resumen?.recomendacionesSiguienteTurno) {
      doc.setFont('helvetica', 'bold');
      doc.text('Recomendaciones Siguiente Turno:', 20, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      const splitRec = doc.splitTextToSize(chequeo.resumen.recomendacionesSiguienteTurno, 170);
      doc.text(splitRec, 20, yPos);
      yPos += splitRec.length * 5 + 8;
    }

    // Sección 6: Consumibles (si hay)
    if (chequeo.consumiblesUsados && chequeo.consumiblesUsados.length > 0) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('6. Consumibles Utilizados', 20, yPos);
      yPos += 8;

      const consumiblesData = chequeo.consumiblesUsados.map(c => [
        c.itemNombre,
        `${c.cantidad}`,
        c.comentario || '-'
      ]);

      doc.setFontSize(10);
      autoTable(doc, {
        startY: yPos,
        head: [['Item', 'Cantidad', 'Comentario']],
        body: consumiblesData,
        theme: 'grid',
        headStyles: { fillColor: [52, 152, 219] },
        margin: { left: 20, right: 20 }
      });
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
      doc.text('Generado con Mamá Yola - Sistema de Gestión de Cuidado', 105, 290, { align: 'center' });
    }

    // Guardar PDF
    const fechaArchivo = fechaDate
      ? fechaDate.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
      : 'sin-fecha';
    const nombreArchivo = `chequeo-${fechaArchivo}-${chequeo.cuidadorNombre || 'cuidador'}.pdf`;
    doc.save(nombreArchivo);
  }

  async function guardarChequeo() {
    try {
      setSaving(true);

      const datosChequeo = construirDatosChequeo();

      // Sincronizar consumibles (revertir eliminados, descontar nuevos)
      await sincronizarConsumibles();

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

      // Generar alertas automáticas
      const alertas = await generarAlertas();
      if (alertas.length > 0) {
        alert(`Se generaron ${alertas.length} alerta(s) que requieren atención.`);
      }

      setUltimoGuardado(new Date());
      markAsSaved();

      // Recargar para actualizar el estado guardado
      cargarChequeoDelDia();
    } catch (error) {
      console.error('Error guardando chequeo:', error);
      alert('Error al guardar chequeo');
    } finally {
      setSaving(false);
    }
  }

  function construirDatosChequeo() {
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

      funcionesCorporales: {
        miccionesNumero: formData.miccionesNumero,
        miccionesCaracteristicas: formData.miccionesCaracteristicas,
        evacuacionesNumero: formData.evacuacionesNumero,
        evacuacionesBristol: formData.evacuacionesBristol,
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

      // Consumibles usados
      ...(formData.consumiblesUsados.length > 0 && {
        consumiblesUsados: formData.consumiblesUsados.filter(c => c.itemId && c.cantidad > 0)
      }),

      // Cambio de sábanas
      ...(formData.cambioSabanas && { cambioSabanas: true }),

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
            <p className="text-gray-500 text-lg">No hay chequeos guardados en los últimos 30 días</p>
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
                      {chequeo.estadoGeneral?.actitud?.join(', ') || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Actividad</p>
                    <p className="text-sm font-medium text-gray-900">
                      {chequeo.estadoGeneral?.nivelActividad || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Evacuaciones</p>
                    <p className="text-sm font-medium text-gray-900">
                      {chequeo.funcionesCorporales?.evacuacionesNumero || 0}
                    </p>
                  </div>
                </div>

                {/* Resumen general */}
                {chequeo.resumen?.resumenGeneral && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {chequeo.resumen.resumenGeneral}
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

    // Usar directamente chequeoSeleccionado en lugar de modificar el estado
    const chequeo = chequeoSeleccionado;

    return (
      <div className="space-y-6">
        {/* Header con información del cuidador */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {chequeo.cuidadorNombre}
              </h2>
              <p className="text-sm text-gray-600">
                {(chequeo.horaRegistro && typeof chequeo.horaRegistro.toDate === 'function'
                  ? chequeo.horaRegistro.toDate()
                  : new Date(chequeo.horaRegistro)
                ).toLocaleString('es-MX', {
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
                onClick={() => exportarAPDF(chequeo)}
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

          {chequeo.estadoGeneral?.actitud && chequeo.estadoGeneral.actitud.length > 0 && (
            <div className="mb-3">
              <span className="text-sm font-medium text-gray-700">Actitud:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {chequeo.estadoGeneral.actitud.map(actId => {
                  const actitudConfig: Record<string, { label: string; bg: string }> = {
                    positiva: { label: 'Positiva / Adaptativa', bg: 'bg-green-100 text-green-800' },
                    negativa: { label: 'Negativa / Pesimista', bg: 'bg-yellow-100 text-yellow-800' },
                    aislamiento: { label: 'Aislamiento / Apatía', bg: 'bg-orange-100 text-orange-800' },
                    enfado: { label: 'Enfado / Resentimiento', bg: 'bg-red-100 text-red-800' },
                    dependencia: { label: 'Dependencia', bg: 'bg-blue-100 text-blue-900' },
                  };
                  const config = actitudConfig[actId] || { label: actId, bg: 'bg-gray-100 text-gray-800' };
                  return (
                    <span key={actId} className={`px-3 py-1 rounded-full text-sm font-medium ${config.bg}`}>
                      {config.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {chequeo.estadoGeneral?.nivelActividad && (
            <p className="mb-2">
              <span className="text-sm font-medium text-gray-700">Nivel de actividad:</span>{' '}
              <span className="text-gray-900">{chequeo.estadoGeneral.nivelActividad}</span>
            </p>
          )}

          {chequeo.estadoGeneral?.nivelCooperacion && (
            <p className="mb-2">
              <span className="text-sm font-medium text-gray-700">Nivel de cooperación:</span>{' '}
              <span className="text-gray-900">{chequeo.estadoGeneral.nivelCooperacion}</span>
            </p>
          )}

          {chequeo.estadoGeneral?.estadoSueno && (
            <p className="mb-2">
              <span className="text-sm font-medium text-gray-700">Estado del sueño:</span>{' '}
              <span className="text-gray-900">{chequeo.estadoGeneral.estadoSueno}</span>
            </p>
          )}

          {chequeo.estadoGeneral?.dolor && chequeo.estadoGeneral.dolor.nivel !== 'sin_dolor' && (
            <div className="mb-2 p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium text-red-700">Dolor reportado:</span>
              <p className="text-red-900">
                Nivel: {chequeo.estadoGeneral.dolor.nivel}
                {chequeo.estadoGeneral.dolor.ubicacion && ` - ${chequeo.estadoGeneral.dolor.ubicacion}`}
              </p>
              {chequeo.estadoGeneral.dolor.descripcion && (
                <p className="text-sm text-red-800 mt-1">{chequeo.estadoGeneral.dolor.descripcion}</p>
              )}
            </div>
          )}

          {chequeo.estadoGeneral?.notasGenerales && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Notas generales:</span>
              <p className="text-gray-900 mt-1">{chequeo.estadoGeneral.notasGenerales}</p>
            </div>
          )}
        </div>

        {/* 2. Funciones Corporales */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">2. Funciones Corporales</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-sm font-medium text-gray-700">Micciones:</span>{' '}
              <span className="text-gray-900">{chequeo.funcionesCorporales?.miccionesNumero ?? 0}</span>
              {chequeo.funcionesCorporales?.miccionesCaracteristicas && (
                <p className="text-sm text-gray-600">{chequeo.funcionesCorporales.miccionesCaracteristicas}</p>
              )}
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Evacuaciones:</span>{' '}
              <span className="text-gray-900">{chequeo.funcionesCorporales?.evacuacionesNumero ?? 0}</span>
              {chequeo.funcionesCorporales?.evacuacionesBristol && chequeo.funcionesCorporales.evacuacionesBristol.length > 0 && (
                <div className="text-sm text-gray-600 mt-1">
                  {chequeo.funcionesCorporales.evacuacionesBristol.map((bristol, idx) => (
                    <span key={idx} className="inline-block mr-2">
                      {chequeo.funcionesCorporales.evacuacionesBristol!.length > 1 && `#${idx + 1}: `}
                      {getBristolNombre(bristol)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {chequeo.funcionesCorporales?.dificultadEvacuar && (
            <p className="text-yellow-700 bg-yellow-50 p-2 rounded mb-2">⚠️ Reportó dificultad para evacuar</p>
          )}

          {chequeo.funcionesCorporales?.laxantesUsados && chequeo.funcionesCorporales.laxantesUsados.length > 0 && (
            <div className="mt-2">
              <span className="text-sm font-medium text-gray-700">Laxantes utilizados:</span>
              <ul className="list-disc list-inside text-gray-900 mt-1">
                {chequeo.funcionesCorporales.laxantesUsados.map((lax, i) => (
                  <li key={i}>{lax.nombre} - {lax.cantidad}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 3. Medicación */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">3. Medicación</h3>

          <p className="mb-2">
            <span className="text-sm font-medium text-gray-700">Medicación en tiempo y forma:</span>{' '}
            <span className={chequeo.medicacion?.medicacionEnTiempoForma ? 'text-green-600' : 'text-red-600'}>
              {chequeo.medicacion?.medicacionEnTiempoForma ? '✓ Sí' : '✗ No'}
            </span>
          </p>

          {chequeo.medicacion?.medicamentosAdicionales && chequeo.medicacion.medicamentosAdicionales.length > 0 && (
            <div className="mt-3">
              <span className="text-sm font-medium text-gray-700">Medicamentos adicionales:</span>
              <ul className="list-disc list-inside text-gray-900 mt-1">
                {chequeo.medicacion.medicamentosAdicionales.map((med, i) => (
                  <li key={i}>{med.nombre} - {med.dosis} ({med.motivo}) a las {med.hora}</li>
                ))}
              </ul>
            </div>
          )}

          {chequeo.medicacion?.medicamentosRechazados && chequeo.medicacion.medicamentosRechazados.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium text-red-700">Medicamentos rechazados:</span>
              <ul className="list-disc list-inside text-red-900 mt-1">
                {chequeo.medicacion.medicamentosRechazados.map((med, i) => (
                  <li key={i}>{med.nombre} - Motivo: {med.motivo}</li>
                ))}
              </ul>
            </div>
          )}

          {chequeo.medicacion?.observaciones && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Observaciones:</span>
              <p className="text-gray-900 mt-1">{chequeo.medicacion.observaciones}</p>
            </div>
          )}
        </div>

        {/* 4. Incidentes */}
        {chequeo.incidentes && chequeo.incidentes.length > 0 && (
          <div className="bg-white rounded-lg border border-red-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-red-900 mb-4">4. Incidentes Reportados</h3>
            {chequeo.incidentes.map((inc, i) => (
              <div key={i} className="mb-4 p-4 bg-red-50 rounded-lg last:mb-0">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-red-900">{inc.tipo}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    inc.gravedad === 'grave' ? 'bg-red-200 text-red-800' :
                    inc.gravedad === 'moderada' ? 'bg-orange-200 text-orange-800' :
                    'bg-yellow-200 text-yellow-800'
                  }`}>
                    {inc.gravedad}
                  </span>
                </div>
                <p className="text-gray-900 mb-1">{inc.descripcion}</p>
                <p className="text-sm text-gray-600">Hora: {inc.hora}</p>
                <p className="text-sm text-gray-700 mt-2">
                  <span className="font-medium">Acción tomada:</span> {inc.accionTomada}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 5. Resumen */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">5. Resumen del Día</h3>

          {chequeo.resumen?.resumenGeneral && (
            <div className="mb-4">
              <span className="text-sm font-medium text-gray-700">Resumen general:</span>
              <p className="text-gray-900 mt-1 whitespace-pre-wrap">{chequeo.resumen.resumenGeneral}</p>
            </div>
          )}

          {chequeo.resumen?.observacionesImportantes && (
            <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
              <span className="text-sm font-medium text-yellow-700">Observaciones importantes:</span>
              <p className="text-yellow-900 mt-1">{chequeo.resumen.observacionesImportantes}</p>
            </div>
          )}

          {chequeo.resumen?.recomendacionesSiguienteTurno && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-blue-700">Recomendaciones siguiente turno:</span>
              <p className="text-blue-900 mt-1">{chequeo.resumen.recomendacionesSiguienteTurno}</p>
            </div>
          )}
        </div>

        {/* 6. Consumibles */}
        {chequeo.consumiblesUsados && chequeo.consumiblesUsados.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">6. Consumibles Utilizados</h3>
            <ul className="space-y-2">
              {chequeo.consumiblesUsados.map((cons, i) => (
                <li key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-gray-900">{cons.itemNombre}</span>
                  <span className="text-gray-600">Cantidad: {cons.cantidad}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
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
                {formData.actitud.map(actId => {
                  const actitudConfig: Record<string, { label: string; bg: string }> = {
                    positiva: { label: 'Positiva / Adaptativa', bg: 'bg-green-100 text-green-800' },
                    negativa: { label: 'Negativa / Pesimista', bg: 'bg-yellow-100 text-yellow-800' },
                    aislamiento: { label: 'Aislamiento / Apatía', bg: 'bg-orange-100 text-orange-800' },
                    enfado: { label: 'Enfado / Resentimiento', bg: 'bg-red-100 text-red-800' },
                    dependencia: { label: 'Dependencia', bg: 'bg-blue-100 text-blue-900' },
                  };
                  const config = actitudConfig[actId] || { label: actId, bg: 'bg-gray-100 text-gray-800' };
                  return (
                    <span key={actId} className={`px-3 py-1 rounded-full text-sm font-medium ${config.bg}`}>
                      {config.label}
                    </span>
                  );
                })}
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

        {/* 2. Funciones Corporales */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">2. Funciones Corporales</h3>

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
              {formData.evacuacionesBristol.length > 0 && formData.evacuacionesBristol.some(b => b) && (
                <div className="text-xs text-gray-600 mt-1">
                  {formData.evacuacionesBristol.map((bristol, idx) => bristol && (
                    <span key={idx} className="block">
                      {formData.evacuacionesBristol.length > 1 && `#${idx + 1}: `}
                      {getBristolNombre(bristol)}
                    </span>
                  ))}
                </div>
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

        {/* 3. Medicación */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">3. Medicación</h3>

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

        {/* 4. Incidentes */}
        {formData.incidentes.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">4. Incidentes</h3>

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

        {/* 5. Resumen del Día */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">5. Resumen del Día</h3>

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
            {isDirty && vistaActual === 'hoy' && (
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
                    Actitud del día
                  </label>
                  <p className="text-xs text-gray-500 mb-3">Mantén presionado o pasa el cursor para ver la descripción</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        id: 'positiva',
                        label: 'Positiva / Adaptativa',
                        descripcion: 'Caracterizada por la aceptación de los cambios físicos y sociales, la búsqueda de nuevas actividades, el mantenimiento de redes de apoyo social y una sensación de bienestar general.',
                        color: 'green',
                        bgSelected: 'bg-green-600',
                        bgUnselected: 'bg-green-50 border-green-300 text-green-800 hover:bg-green-100',
                      },
                      {
                        id: 'negativa',
                        label: 'Negativa / Pesimista',
                        descripcion: 'Implica ver el envejecimiento como un período de declive, con un enfoque en las pérdidas, la soledad y la desesperanza, lo que puede aumentar el riesgo de depresión y ansiedad.',
                        color: 'yellow',
                        bgSelected: 'bg-yellow-500',
                        bgUnselected: 'bg-yellow-50 border-yellow-400 text-yellow-800 hover:bg-yellow-100',
                      },
                      {
                        id: 'aislamiento',
                        label: 'Aislamiento / Apatía',
                        descripcion: 'Conlleva una retirada de las actividades sociales y familiares, falta de interés y desorientación, lo que puede afectar directamente su entorno y su salud mental.',
                        color: 'orange',
                        bgSelected: 'bg-orange-500',
                        bgUnselected: 'bg-orange-50 border-orange-400 text-orange-800 hover:bg-orange-100',
                      },
                      {
                        id: 'enfado',
                        label: 'Enfado / Resentimiento',
                        descripcion: 'Puede manifestarse como irritabilidad, quejas constantes o dificultad para tratar con los demás, a menudo derivada de sentimientos de incomprensión o frustración ante las limitaciones.',
                        color: 'red',
                        bgSelected: 'bg-red-600',
                        bgUnselected: 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100',
                      },
                      {
                        id: 'dependencia',
                        label: 'Dependencia',
                        descripcion: 'Una inclinación a depender excesivamente de otros para la toma de decisiones o actividades diarias, a veces debido al miedo a perder autonomía.',
                        color: 'blue',
                        bgSelected: 'bg-blue-900',
                        bgUnselected: 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100',
                      },
                    ].map(opcion => (
                      <div key={opcion.id} className="relative group">
                        <button
                          type="button"
                          onClick={() => toggleActitud(opcion.id)}
                          className={`px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                            formData.actitud.includes(opcion.id)
                              ? `${opcion.bgSelected} text-white border-transparent shadow-md`
                              : opcion.bgUnselected
                          }`}
                        >
                          {opcion.label}
                        </button>
                        {/* Tooltip para desktop */}
                        <div className="absolute z-10 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                          <p className="font-medium mb-1">{opcion.label}</p>
                          <p>{opcion.descripcion}</p>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Descripción de actitud seleccionada (visible en móvil) */}
                  {formData.actitud.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 md:hidden">
                      <p className="text-xs font-medium text-gray-700 mb-1">Actitud seleccionada:</p>
                      {formData.actitud.map(actId => {
                        const actitud = [
                          { id: 'positiva', label: 'Positiva / Adaptativa', descripcion: 'Caracterizada por la aceptación de los cambios físicos y sociales, la búsqueda de nuevas actividades, el mantenimiento de redes de apoyo social y una sensación de bienestar general.' },
                          { id: 'negativa', label: 'Negativa / Pesimista', descripcion: 'Implica ver el envejecimiento como un período de declive, con un enfoque en las pérdidas, la soledad y la desesperanza.' },
                          { id: 'aislamiento', label: 'Aislamiento / Apatía', descripcion: 'Conlleva una retirada de las actividades sociales y familiares, falta de interés y desorientación.' },
                          { id: 'enfado', label: 'Enfado / Resentimiento', descripcion: 'Puede manifestarse como irritabilidad, quejas constantes o dificultad para tratar con los demás.' },
                          { id: 'dependencia', label: 'Dependencia', descripcion: 'Una inclinación a depender excesivamente de otros para la toma de decisiones o actividades diarias.' },
                        ].find(a => a.id === actId);
                        return actitud ? (
                          <p key={actId} className="text-xs text-gray-600 mb-2">
                            <span className="font-medium">{actitud.label}:</span> {actitud.descripcion}
                          </p>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                {/* Nivel de Actividad */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nivel de Actividad
                  </label>
                  <select
                    value={formData.nivelActividad}
                    onChange={(e) => setFormData({ ...formData, nivelActividad: e.target.value })}
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
                          placeholder="Ubicación del dolor"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                        <textarea
                          value={formData.dolorDescripcion}
                          onChange={(e) => setFormData({ ...formData, dolorDescripcion: e.target.value })}
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
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Observaciones generales sobre el estado del paciente..."
                  />
                </div>
              </div>
            </div>

            {/* Sección 2: Funciones Corporales */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                2. Funciones Corporales
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
                      onChange={(e) => setFormData({ ...formData, miccionesNumero: e.target.value === '' ? '' : parseInt(e.target.value) })}
                        placeholder="0"
                      min="0"
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
                        placeholder="Color, olor, etc."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>

                {/* Evacuaciones */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de evacuaciones
                    </label>
                    <input
                      type="number"
                      value={formData.evacuacionesNumero}
                      onChange={(e) => setFormData({ ...formData, evacuacionesNumero: e.target.value === '' ? '' : parseInt(e.target.value) })}
                        placeholder="0"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Color
                    </label>
                    <input
                      type="text"
                      value={formData.evacuacionesColor}
                      onChange={(e) => setFormData({ ...formData, evacuacionesColor: e.target.value })}
                        placeholder="Color"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>

                {/* Escala de Bristol - Dinámica según número de evacuaciones */}
                <BristolScaleSelector
                  values={formData.evacuacionesBristol}
                  onChange={(values) => setFormData({ ...formData, evacuacionesBristol: values })}
                  numEvacuaciones={typeof formData.evacuacionesNumero === 'number' ? formData.evacuacionesNumero : parseInt(formData.evacuacionesNumero as string) || 0}
                  disabled={false}
                />

                {/* Dificultad para evacuar */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="dificultadEvacuar"
                    checked={formData.dificultadEvacuar}
                    onChange={(e) => setFormData({ ...formData, dificultadEvacuar: e.target.checked })}
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
                    <button
                      type="button"
                      onClick={agregarLaxante}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Agregar laxante
                    </button>
                  </div>
                  {formData.laxantes.map((laxante, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={laxante.nombre}
                        onChange={(e) => updateLaxante(index, 'nombre', e.target.value)}
                            placeholder="Nombre del laxante"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        value={laxante.cantidad}
                        onChange={(e) => updateLaxante(index, 'cantidad', e.target.value)}
                            placeholder="Cantidad"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => eliminarLaxante(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cambio de Sábanas */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.cambioSabanas}
                  onChange={(e) => setFormData({ ...formData, cambioSabanas: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="text-xl">🛏️</span> Se cambiaron las sábanas
                  </span>
                  <p className="text-sm text-gray-500">Marcar si se realizó el cambio de sábanas hoy</p>
                </div>
              </label>
            </div>

            {/* Sección 3: Consumibles Utilizados */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                3. Consumibles Utilizados
              </h2>

              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Registre los consumibles utilizados durante el turno para descontarlos del inventario.
                </p>

                {/* Lista de consumibles agregados */}
                {formData.consumiblesUsados.map((consumible, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <select
                        value={consumible.itemId}
                        onChange={(e) => updateConsumible(index, 'itemId', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        <option value="">Seleccionar consumible...</option>
                        {consumiblesDisponibles
                          .filter(c => c.cantidadOperativo > 0 && !c.tieneVidaUtil)
                          .map(c => (
                            <option key={c.id} value={c.id}>
                              {c.nombre} (Disponible: {c.cantidadOperativo} {c.unidad})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        value={consumible.cantidad}
                        onChange={(e) => updateConsumible(index, 'cantidad', parseFloat(e.target.value) || 0)}
                            placeholder="Cant."
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={consumible.comentario}
                        onChange={(e) => updateConsumible(index, 'comentario', e.target.value)}
                            placeholder="Comentario (opcional)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarConsumible(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Botón para agregar consumible */}
                <button
                  type="button"
                  onClick={agregarConsumible}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  + Agregar consumible
                </button>

                {consumiblesDisponibles.filter(c => c.cantidadOperativo > 0 && !c.tieneVidaUtil).length === 0 && (
                  <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                    No hay consumibles disponibles en el inventario operativo.
                  </p>
                )}
              </div>
            </div>

            {/* Sección 4: Medicación */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                4. Medicación
              </h2>

              <div className="space-y-4">
                {/* Medicación en tiempo y forma */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="medicacionEnTiempoForma"
                    checked={formData.medicacionEnTiempoForma}
                    onChange={(e) => setFormData({ ...formData, medicacionEnTiempoForma: e.target.checked })}
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
                    <button
                      type="button"
                      onClick={agregarMedicamentoAdicional}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Agregar medicamento
                    </button>
                  </div>
                  {formData.medicamentosAdicionales.map((med, index) => (
                    <div key={index} className="grid grid-cols-4 gap-2 mb-2">
                      <input
                        type="text"
                        value={med.nombre}
                        onChange={(e) => updateMedicamentoAdicional(index, 'nombre', e.target.value)}
                            placeholder="Nombre"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        value={med.dosis}
                        onChange={(e) => updateMedicamentoAdicional(index, 'dosis', e.target.value)}
                            placeholder="Dosis"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        value={med.motivo}
                        onChange={(e) => updateMedicamentoAdicional(index, 'motivo', e.target.value)}
                            placeholder="Motivo"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <div className="flex gap-2">
                        <input
                          type="time"
                          value={med.hora}
                          onChange={(e) => updateMedicamentoAdicional(index, 'hora', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => eliminarMedicamentoAdicional(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          ✕
                        </button>
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
                    <button
                      type="button"
                      onClick={agregarMedicamentoRechazado}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Agregar
                    </button>
                  </div>
                  {formData.medicamentosRechazados.map((med, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={med.nombre}
                        onChange={(e) => updateMedicamentoRechazado(index, 'nombre', e.target.value)}
                            placeholder="Nombre del medicamento"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        value={med.motivo}
                        onChange={(e) => updateMedicamentoRechazado(index, 'motivo', e.target.value)}
                            placeholder="Motivo"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => eliminarMedicamentoRechazado(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        ✕
                      </button>
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
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Observaciones sobre la medicación..."
                  />
                </div>
              </div>
            </div>

            {/* Sección 5: Incidentes */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                5. Incidentes
              </h2>

              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-gray-600">
                    Registra cualquier incidente o situación inusual
                  </p>
                  <button
                    type="button"
                    onClick={agregarIncidente}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg"
                  >
                    + Agregar Incidente
                  </button>
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
                          placeholder="Tipo de incidente"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                        <div className="flex gap-2">
                          <input
                            type="time"
                            value={incidente.hora}
                            onChange={(e) => updateIncidente(index, 'hora', e.target.value)}
                              placeholder="Hora"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                          />
                          <select
                            value={incidente.gravedad}
                            onChange={(e) => updateIncidente(index, 'gravedad', e.target.value)}
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
                            placeholder="Descripción del incidente..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 mb-2"
                      />
                      <div className="flex gap-2">
                        <textarea
                          value={incidente.accionTomada}
                          onChange={(e) => updateIncidente(index, 'accionTomada', e.target.value)}
                          placeholder="Acción tomada..."
                          rows={2}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => eliminarIncidente(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg self-start"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sección 6: Resumen */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                6. Resumen del Día
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resumen General
                  </label>
                  <textarea
                    value={formData.resumenGeneral}
                    onChange={(e) => setFormData({ ...formData, resumenGeneral: e.target.value })}
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
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Recomendaciones para el cuidador del siguiente turno..."
                  />
                </div>
              </div>
            </div>

            {/* Botón de acción */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={guardarChequeo}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Chequeo'}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </Layout>
  );
}
