import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Medicamento } from '../types';
import Layout from '../components/common/Layout';
import ViewToggle from '../components/common/ViewToggle';
import MedicamentoCard from '../components/medicamentos/MedicamentoCard';
import MedicamentoModal, { MedicamentoFormData } from '../components/medicamentos/MedicamentoModal';

const PACIENTE_ID = 'paciente-principal';

export default function Medicamentos() {
  const [loading, setLoading] = useState(false);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [vista, setVista] = useState<'grid' | 'list'>('list');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [medicamentoEditando, setMedicamentoEditando] = useState<Medicamento | null>(null);

  const diasSemanaLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  useEffect(() => {
    cargarMedicamentos();
  }, []);

  async function cargarMedicamentos() {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(
        collection(db, 'pacientes', PACIENTE_ID, 'medicamentos')
      );
      const meds: Medicamento[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        meds.push({
          id: docSnap.id,
          ...data,
          creadoEn: data.creadoEn?.toDate() || new Date(),
          actualizadoEn: data.actualizadoEn?.toDate() || new Date(),
        } as Medicamento);
      });

      // Ordenar: activos primero, luego por horario más temprano del día
      meds.sort((a, b) => {
        // Activos primero
        if (a.activo !== b.activo) return a.activo ? -1 : 1;

        // Ordenar por horario más temprano
        const getMinHorario = (horarios: string[]) => {
          if (!horarios || horarios.length === 0) return Infinity;
          return Math.min(
            ...horarios.map((h) => {
              const [hora, min] = h.split(':').map(Number);
              return hora * 60 + min;
            })
          );
        };

        return getMinHorario(a.horarios) - getMinHorario(b.horarios);
      });

      setMedicamentos(meds);
    } catch (error) {
      console.error('Error cargando medicamentos:', error);
      alert('Error al cargar medicamentos');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(data: MedicamentoFormData, isEdit: boolean) {
    try {
      setLoading(true);

      let fotoURLFinal = data.fotoURL;

      // Subir foto si hay una nueva
      if (data.fotoFile) {
        const storageRef = ref(storage, `medicamentos/${Date.now()}_${data.fotoFile.name}`);
        await uploadBytes(storageRef, data.fotoFile);
        fotoURLFinal = await getDownloadURL(storageRef);
      }

      const medicamentoData: Record<string, unknown> = {
        pacienteId: PACIENTE_ID,
        nombre: data.nombre,
        dosis: data.dosis,
        presentacion: data.presentacion,
        frecuencia: {
          tipo: 'dias_especificos',
          diasSemana: data.diasSemana,
        },
        horarios: data.horarios,
        activo: true,
        actualizadoEn: new Date(),
      };

      // Solo agregar campos opcionales si tienen valor
      if (data.instrucciones) {
        medicamentoData.instrucciones = data.instrucciones;
      }
      if (fotoURLFinal) {
        medicamentoData.foto = fotoURLFinal;
      }

      if (isEdit && medicamentoEditando) {
        // Actualizar
        const medicamentoRef = doc(
          db,
          'pacientes',
          PACIENTE_ID,
          'medicamentos',
          medicamentoEditando.id
        );
        await updateDoc(medicamentoRef, medicamentoData);
        alert('Medicamento actualizado exitosamente');
      } else {
        // Crear nuevo medicamento
        const medicamentoRef = await addDoc(
          collection(db, 'pacientes', PACIENTE_ID, 'medicamentos'),
          {
            ...medicamentoData,
            creadoEn: new Date(),
          }
        );

        // Crear item de inventario vinculado automáticamente
        await addDoc(collection(db, 'pacientes', PACIENTE_ID, 'inventario'), {
          pacienteId: PACIENTE_ID,
          nombre: `${data.nombre} ${data.dosis}`,
          categoria: 'medicamento',
          cantidadMaestro: 0,
          cantidadTransito: 0, // Stock en tránsito para cuidadora
          cantidadOperativo: 0,
          presentacion: data.presentacion,
          unidad: 'piezas',
          nivelMinimoMaestro: 5,
          nivelMinimoTransito: 7, // Una semana de stock en tránsito
          nivelMinimoOperativo: 5,
          vinculadoPastillero: true,
          medicamentoId: medicamentoRef.id,
          creadoEn: new Date(),
          actualizadoEn: new Date(),
        });

        alert('Medicamento creado exitosamente');
      }

      setModalAbierto(false);
      setMedicamentoEditando(null);
      cargarMedicamentos();
    } catch (error) {
      console.error('Error guardando medicamento:', error);
      alert('Error al guardar el medicamento');
    } finally {
      setLoading(false);
    }
  }

  async function toggleActivoMedicamento(med: Medicamento) {
    if (med.activo) {
      if (!confirm('¿Desactivar este medicamento? No se eliminará del registro.')) {
        return;
      }
    }

    try {
      setLoading(true);
      const medicamentoRef = doc(db, 'pacientes', PACIENTE_ID, 'medicamentos', med.id);
      await updateDoc(medicamentoRef, {
        activo: !med.activo,
        actualizadoEn: new Date(),
      });
      alert(med.activo ? 'Medicamento desactivado' : 'Medicamento activado');
      cargarMedicamentos();
    } catch (error) {
      console.error('Error actualizando medicamento:', error);
      alert('Error al actualizar medicamento');
    } finally {
      setLoading(false);
    }
  }

  function editarMedicamento(med: Medicamento) {
    setMedicamentoEditando(med);
    setModalAbierto(true);
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pastillero Virtual</h1>
            <p className="text-gray-500 mt-1 text-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Ordenados por primer horario del día
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ViewToggle view={vista} onChange={setVista} />
            <button
              onClick={() => {
                setMedicamentoEditando(null);
                setModalAbierto(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              + Nuevo
            </button>
          </div>
        </div>

        {/* Lista/Grid de Medicamentos */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Cargando medicamentos...</p>
          </div>
        ) : medicamentos.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            <p className="text-gray-500 text-lg">No hay medicamentos registrados</p>
            <p className="text-gray-400 text-sm mt-2">
              Haz clic en "+ Nuevo" para agregar uno
            </p>
          </div>
        ) : (
          <div
            className={
              vista === 'grid'
                ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                : 'space-y-4'
            }
          >
            {medicamentos.map((med) => (
              <MedicamentoCard
                key={med.id}
                medicamento={med}
                viewMode={vista}
                onEdit={editarMedicamento}
                onToggleActive={toggleActivoMedicamento}
                diasSemanaLabels={diasSemanaLabels}
              />
            ))}
          </div>
        )}

        {/* Modal */}
        <MedicamentoModal
          isOpen={modalAbierto}
          onClose={() => {
            setModalAbierto(false);
            setMedicamentoEditando(null);
          }}
          medicamento={medicamentoEditando}
          onSave={handleSave}
          loading={loading}
        />
      </div>
    </Layout>
  );
}
