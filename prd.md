# PRD - Sistema de Gestión de Cuidado de Adultos Mayores

## 1. Visión General del Producto

### 1.1 Propósito
Aplicación web privada para coordinar y gestionar el cuidado integral de adultos mayores, facilitando la colaboración entre cuidadores, supervisores y familiares a través de una plataforma centralizada.

### 1.2 Alcance del MVP
Versión inicial enfocada en **un solo adulto mayor**, con las funcionalidades esenciales para gestión diaria de cuidados, medicamentos, inventarios, agenda de contactos, calendario de eventos y registro diario de salud.

### 1.3 Stack Tecnológico
- **Frontend**: Vite + React
- **Backend**: Firebase (Firestore + Authentication)
- **Hosting**: Firebase Hosting
- **Base de datos**: Firestore
- **Autenticación**: Firebase Authentication

---

## 2. Usuarios y Roles

### 2.1 Tipos de Usuario

| Rol | Permisos | Responsabilidades |
|-----|----------|-------------------|
| **Familiar (Admin)** | Control total del sistema | Gestión de usuarios, inventario maestro, supervisión general, gestión de contactos y citas, revisión de reportes diarios |
| **Supervisor** | Lectura completa, edición limitada | Revisión de actividades, validación de registros, confirmación de citas, revisión de chequeos diarios |
| **Cuidador** | Lectura y edición operativa | Registro diario de medicamentos, actividades, consumo de inventarios, asistencia a citas, **registro de chequeo diario** |

### 2.2 Jerarquía de Permisos
```
Familiar (Admin)
  └── Puede crear/editar/eliminar todo
      └── Supervisor
          └── Puede ver todo, editar ciertos registros
              └── Cuidador
                  └── Puede registrar actividades diarias, consumo y chequeos diarios
```

---

## 3. Funcionalidades Principales

### 3.1 Pastillero Virtual (Cronología y Dosificación)

**Objetivo**: Gestionar la administración de medicamentos con registro temporal y alertas.

#### Características:

**Configuración de medicamentos**:
- Nombre del medicamento
- Dosis
- Frecuencia (cada X horas, días específicos, etc.)
- Horarios específicos
- Instrucciones especiales (con alimentos, en ayunas, etc.)
- Foto del medicamento

**Registro de administración**:
- Timestamp de cuándo se administró
- Usuario que administró
- Estado: "tomado", "rechazado" o "omitido"
- Notas adicionales
- Retraso en minutos (calculado automáticamente)

**Vista cronológica**:
- Calendario semanal/mensual
- Historial completo de administración
- Indicadores visuales (verde: tomado, amarillo: con retraso, rojo: omitido, gris: pendiente)

**Alertas**:
- Notificaciones push 15 min antes de cada dosis
- Alertas de dosis omitidas (30 min después)
- Reporte diario de adherencia
- Alertas cuando medicamento está por terminarse

#### Permisos por rol:
- **Familiar**: CRUD completo de medicamentos y horarios
- **Supervisor**: Ver todo, editar registros de administración
- **Cuidador**: Registrar administración, ver schedule, marcar estados

---

### 3.2 Sistema de Inventarios

**Objetivo**: Gestionar inventarios en dos niveles (operativo y maestro) con alertas automáticas y trazabilidad completa.

#### Concepto de Inventario Dual

**Dos niveles de inventarios**:
- **Inventario Operativo**: Stock semanal usado por cuidadores
- **Inventario Maestro/Backup**: Stock de respaldo manejado por familiares

**Flujo**:
1. Familiar mantiene inventario maestro
2. Cuidador trabaja con inventario operativo
3. Cuando operativo llega a nivel mínimo → Alerta a familiar
4. Familiar surte desde maestro → operativo
5. Sistema registra todas las transferencias

#### Categorías de Inventarios

**A) Medicamentos**:
- Nombre
- Tipo: operativo o maestro
- Presentación
- Cantidad y unidad
- Ubicación
- Fecha de vencimiento
- Lote
- Nivel mínimo para alertas
- Vinculado a pastillero (boolean)
- Costo y proveedor
- Notas

**B) Materiales de Uso Diario**:
- Nombre
- Tipo: operativo o maestro
- Cantidad
- Ubicación
- Estado: disponible, en uso, mantenimiento, extraviado
- Última revisión
- Responsable
- Descripción

Ejemplos: bolsa, paraguas, sombrero, repelente, bastón, andadera, lentes, audífono

**C) Consumibles**:
- Nombre
- Tipo: operativo o maestro
- Cantidad y unidad
- Consumo promedio diario
- Nivel mínimo
- Días restantes (calculado)
- Última compra
- Próxima compra (calculado)
- Proveedor y costo

Ejemplos: papel higiénico, pañales, toallas húmedas, protector de colchón, gasas, alcohol, jabón

#### Movimientos de Inventario

**Tipos de movimientos**:
- **Entrada**: Nueva compra al inventario maestro
- **Salida**: Consumo o desecho
- **Transferencia**: De maestro a operativo
- **Ajuste**: Corrección de inventario

**Datos del movimiento**:
- Tipo de movimiento
- Origen y destino
- Item y cantidad
- Motivo
- Usuario que realizó
- Fecha y timestamp
- Notas

#### Alertas de Inventario
- Crítico: 0 unidades o vencido
- Bajo: Menor a nivel mínimo
- Por vencer: Medicamentos que vencen en menos de 30 días
- Reabastecimiento sugerido: Según consumo promedio

#### Permisos:
- **Familiar**: CRUD completo en ambos inventarios, todas las transferencias
- **Supervisor**: Ver ambos inventarios, editar inventario operativo, transferencias
- **Cuidador**: Ver inventario operativo, registrar consumo

---

### 3.3 Agenda de Contactos

**Objetivo**: Centralizar información de contacto de todas las personas y servicios relacionados con el cuidado.

#### Estructura de Contacto:
- Nombre
- Categoría: médico, cuidador, familiar, emergencia, servicios, otros
- Especialidad (para médicos)
- Cédula profesional
- Teléfono principal y alternativo
- Email
- Dirección física
- Coordenadas GPS
- Horario y días de atención
- Consultorio/Hospital
- Seguros que acepta
- Notas
- Favorito (boolean)
- Foto
- Activo (boolean)
- Historial de contacto (log de interacciones)

#### Categorías de Contactos:

**Médicos y Especialistas**:
- Médico general, cardiólogo, neurólogo, geriatra, endocrinólogo, psiquiatra, dentista, oftalmólogo, etc.

**Emergencias**:
- Ambulancia, hospital más cercano, urgencias 24hrs, farmacia 24hrs, contactos de emergencia familiares

**Cuidadores y Personal**:
- Cuidadores activos, cuidadores suplentes, enfermeras, terapeutas

**Servicios**:
- Farmacia, laboratorio, imagenología, taxi/transporte, proveedores de equipo médico, servicios de limpieza

**Familiares**:
- Familiares directos, secundarios, amigos cercanos, vecinos de confianza

#### Funcionalidades:
- Búsqueda por nombre, categoría o especialidad
- Click-to-call (llamada directa)
- Click-to-email
- Ver en mapa
- Compartir contacto
- Favoritos para acceso rápido
- Historial de contacto automático y manual
- Exportar a PDF o vCard
- Lista agrupada por categorías

#### Permisos:
- **Familiar**: CRUD completo, marcar favoritos, exportar
- **Supervisor**: Ver todo, editar, agregar notas de contacto
- **Cuidador**: Ver todo, agregar notas de contacto, llamar

---

### 3.4 Calendario de Citas y Eventos

**Objetivo**: Gestionar todas las citas médicas, visitas, eventos y compromisos relacionados con el cuidado.

#### Estructura de Evento:
- Título
- Tipo: cita_medica, estudio, terapia, visita, evento_social, trámite, otro
- Subtipo
- Fecha y hora (inicio y fin)
- Duración estimada
- Ubicación y coordenadas GPS
- Contacto relacionado (vinculado a agenda)
- Descripción y motivo de consulta
- Preparación (checklist de items)
- Recordatorios configurables
- Transporte
- Acompañante asignado
- Estado: programada, confirmada, en_curso, completada, cancelada, reprogramada
- Confirmación (por quién y cuándo)

**Post-evento**:
- Asistió (boolean)
- Hora real de llegada y salida
- Resultados y diagnóstico
- Indicaciones médicas
- Receta nueva (boolean)
- Cambio de tratamiento (boolean)
- Próxima cita
- Costo de consulta
- Documentos adjuntos (recetas, estudios, notas)

#### Tipos de Eventos:

**Citas Médicas**: consulta general, especialista, seguimiento, chequeo, urgencia, teleconsulta

**Estudios y Procedimientos**: laboratorio, rayos X, tomografía, resonancia, ultrasonido, electrocardiograma, procedimientos, vacunas

**Terapias**: fisioterapia, ocupacional, lenguaje, respiratoria, psicológica

**Visitas**: familiar, amigos, religiosa, evento social

**Trámites**: bancarios, gobierno, seguros, pagos

#### Vistas del Calendario:
- Vista mensual (grid tradicional)
- Vista semanal (timeline tipo Google Calendar)
- Vista de lista (próximos eventos)
- Vista agenda diaria (integrada con medicamentos, actividades, turnos)

#### Funcionalidades:
- Recordatorios inteligentes (1 semana, 3 días, 1 día, 2 horas, 30 min antes)
- Integración automática con agenda de contactos
- Checklist de preparación pre-cita
- Registro durante la cita
- Formulario estructurado post-cita
- Integración con pastillero (si hay cambio de medicamento)
- Exportar a Google Calendar / Apple Calendar
- Timeline integrado del día completo

#### Permisos:
- **Familiar**: CRUD completo, confirmar citas, registrar resultados, adjuntar documentos
- **Supervisor**: Ver todo, editar, confirmar, registrar asistencia
- **Cuidador**: Ver eventos asignados, registrar asistencia, agregar notas durante cita

---

### 3.5 Registro de Chequeo Diario (Bitácora de Salud)

**Objetivo**: Digitalizar el reporte diario que las cuidadoras actualmente envían por WhatsApp, capturando signos vitales, alimentación real consumida, funciones corporales y estado general del paciente.

#### Estructura del Chequeo Diario:

**Información General**:
- Fecha del registro
- Turno: matutino, vespertino, nocturno, 24hrs
- Cuidador que registra
- Hora de registro
- Paciente

**Signos Vitales** (se pueden tomar múltiples veces al día):
- Temperatura corporal (°C)
- SpO2 - Saturación de oxígeno (%)
- Frecuencia cardíaca (lpm)
- Presión arterial (sistólica/diastólica mmHg)
- Hora de la medición
- Notas sobre la medición

**Estado General del Paciente**:
- Actitud/Estado de ánimo: tranquila, activa, cooperadora, inquieta, apática, irritable, confundida
- Nivel de actividad: muy activa, activa, normal, poca actividad, inactiva
- Nivel de cooperación: muy cooperadora, cooperadora, poco cooperadora, no cooperadora
- Estado de sueño: descansó bien, despertó varias veces, insomnio, somnolencia diurna
- Dolor: sin dolor, leve, moderado, severo (ubicación y descripción)
- Notas generales del día

**Alimentación Real Consumida** (complementa el menú programado):
- Kéfir/Probiótico (hora y cantidad)
- Desayuno (descripción de lo que comió y cantidad aproximada)
- Colación 1 (descripción y cantidad)
- Almuerzo (descripción y cantidad)
- Colación 2 (descripción y cantidad)
- Cena (descripción y cantidad)
- Consumo de agua (litros aproximados)
- Otros líquidos (té, jugos, etc.)
- Observaciones sobre apetito
- Rechazó alimentos (cuáles y por qué)

**Funciones Corporales**:
- Micciones: número de veces durante el día/turno
- Características de la micción: normal, dolor, dificultad, incontinencia, color anormal
- Evacuaciones: número de veces
- Consistencia de evacuación: normal, dura, blanda, pastosa, líquida
- Color y características de evacuación
- Dificultad o dolor al evacuar
- Uso de laxantes o ayudas (nombre y cantidad)

**Actividades Realizadas**:
- Ejercicios de fisioterapia (cuáles y duración)
- Ejercicios para movimiento intestinal
- Caminatas (número y duración: matutina, vespertina)
- Actividades recreativas realizadas (pintar, leer, juegos, manualidades, etc.)
- Actividades cognitivas (números, colores, memoria, etc.)
- Participación y actitud durante actividades

**Medicación**:
- Confirmación: "Medicación tomada en tiempo y forma" (boolean)
- Medicamentos adicionales administrados fuera de horario (cuáles, dosis, motivo)
- Medicamentos rechazados (cuáles y motivo)
- Observaciones sobre la medicación

**Incidentes o Novedades**:
- Tipo: caída, confusión, agitación, dolor, vómito, mareo, otro
- Descripción detallada del incidente
- Hora del incidente
- Acción tomada
- Gravedad: leve, moderada, grave

**Resumen del Día**:
- Descripción general del cuidador (texto libre)
- Observaciones importantes
- Recomendaciones para el siguiente turno

#### Funcionalidades:

**Entrada de Datos**:
- Formulario estructurado por secciones
- Campos pre-llenados con valores comunes
- Opciones de selección rápida
- Campo de texto libre para detalles adicionales
- Capacidad de tomar múltiples mediciones de signos vitales en el día
- Adjuntar fotos si es necesario

**Vistas**:
- Vista de entrada de datos (formulario)
- Vista de resumen del día
- Vista de historial (timeline de días anteriores)
- Vista de comparación (tendencias)
- Vista de reporte para familiares

**Alertas Automáticas**:
- Signos vitales fuera de rango normal (configurable por paciente)
- No evacuación en X días (configurable)
- Consumo de agua bajo
- Cambios significativos en estado de ánimo
- Rechazó múltiples comidas
- Múltiples incidentes en un día

**Reportes y Análisis**:
- Gráficas de tendencias de signos vitales
- Patrón de evacuaciones y micciones
- Consumo promedio de agua
- Adherencia a medicación
- Nivel de actividad semanal
- Resumen semanal/mensual para el médico
- Exportar a PDF para llevar a consultas

**Notificaciones**:
- Al familiar cuando se completa el registro del día
- A supervisores si hay alertas de salud
- Al siguiente cuidador si hay notas importantes de traspaso

**Comparación con Menú Programado**:
- El sistema puede comparar lo que se programó en el menú vs lo que realmente comió
- Mostrar diferencias y patrones de rechazo
- Sugerencias para ajustar el menú

#### Permisos:
- **Familiar**: Ver todos los registros, editar, exportar reportes, configurar rangos de alerta
- **Supervisor**: Ver todos los registros, editar, recibir alertas
- **Cuidador**: Crear y editar sus propios registros del turno, ver registros de otros cuidadores

---

### 3.6 Lista de Actividades

**Objetivo**: Programar y registrar actividades diarias del adulto mayor para mantener su calidad de vida y estimulación.

#### Estructura de Actividad:
- Nombre
- Tipo: salida, recreativa, terapéutica, social, cognitiva, física
- Fecha y hora (inicio y fin)
- Duración
- Ubicación
- Descripción
- Materiales necesarios
- Responsable
- Estado: programada, en_progreso, completada, cancelada
- Motivo de cancelación
- Nivel de energía requerido: bajo, medio, alto

**Post-actividad**:
- Completada por (usuario)
- Hora real de inicio y fin
- Participación: activa, pasiva, mínima
- Estado de ánimo durante actividad
- Notas
- Fotos
- Frecuencia: única, diaria, semanal, mensual

#### Tipos de Actividades:

**Salidas**: caminata, centro comercial, paseo, banco, supermercado, lugares significativos

**Recreativas**: TV/películas, música, pintar, manualidades, jardinería, cocinar, juegos de mesa

**Cognitivas**: leer, crucigramas, rompecabezas, juegos de memoria, conversación, escribir

**Físicas**: ejercicios de movilidad, estiramientos, yoga, ejercicios sentado, bailar, caminar

**Terapéuticas**: fisioterapia, terapia ocupacional, ejercicios respiratorios, terapia de lenguaje, musicoterapia

**Sociales**: videollamada, visita de amigos, reunión familiar, actividad religiosa, grupo de apoyo

#### Funcionalidades:
- Crear actividad única o recurrente
- Plantillas de actividades frecuentes
- Sugerencias basadas en historial
- Calendario semanal de actividades
- Historial de actividades completadas
- Reportes: completadas vs programadas, actividades favoritas, balance de tipos
- Galería de fotos

#### Permisos:
- **Familiar**: CRUD completo, ver reportes
- **Supervisor**: Ver todo, editar, aprobar programación
- **Cuidador**: Crear actividades, registrar completación, agregar notas y fotos

---

### 3.7 Horario de Cuidadores

**Objetivo**: Gestionar turnos, asistencia y coordinación de cuidadores.

#### Estructura de Turno:
- Cuidador (ID y nombre)
- Fecha
- Hora de entrada y salida programadas
- Tipo de turno: matutino, vespertino, nocturno, 24hrs, especial
- Duración en horas
- Estado: programado, confirmado, activo, completado, cancelado

**Registro real**:
- Hora de entrada real (timestamp con GPS opcional)
- Hora de salida real (timestamp)
- Horas reales trabajadas
- Retraso en entrada (minutos)
- Adelanto en salida (minutos)

**Entrega de turno**:
- Notas de entrada (lo que encontró al llegar)
- Notas de salida (reporte del turno)
- Novedades del turno (tipo, descripción, hora, gravedad)
- Tareas completadas (checklist)

#### Tipos de Turno:
- Matutino: 7:00 AM - 3:00 PM
- Vespertino: 3:00 PM - 11:00 PM
- Nocturno: 11:00 PM - 7:00 AM
- 24 horas
- Especial: horario personalizado

#### Funcionalidades:
- Programar turno individual o patrón recurrente
- Asignar cuidador suplente
- Ver disponibilidad
- Detectar conflictos de horario
- Check-in/check-out con ubicación GPS
- Cálculo automático de horas trabajadas
- Formulario de entrega de turno
- Checklist de tareas por turno
- Reporte de horas (semanal/mensual)
- Exportar para nómina
- Vista calendario con código de colores
- Alertas de turno sin asignar, sin check-in, etc.

#### Permisos:
- **Familiar**: CRUD completo, ver reportes de horas, exportar
- **Supervisor**: Ver todo, editar, aprobar cambios
- **Cuidador**: Ver su horario, registrar entrada/salida, entregar turno

---

### 3.8 Menú de Comida

**Objetivo**: Planificar alimentación considerando restricciones dietéticas, preferencias y control nutricional.

#### Estructura de Comida:
- Fecha
- Comida: desayuno, colación1, comida, colación2, cena
- Hora programada
- Platillo
- Categoría: entrada, plato_fuerte, postre, bebida, snack
- Ingredientes (con indicador de alergeno)
- Valor nutricional: calorías, proteínas, carbohidratos, grasas, fibra, sodio
- Instrucciones de preparación

**Servido**:
- Preparado por (usuario)
- Hora servida (timestamp)
- Temperatura adecuada (boolean)
- Presentación
- Foto

**Consumo**:
- Nivel de consumo: todo, mayor parte, mitad, poco, nada
- Porcentaje consumido
- Motivo de rechazo
- Notas
- Satisfacción (escala 1-5)
- Vinculado a receta (si viene del banco)

#### Restricciones Dietéticas (Configurables):
- Condiciones: diabetes, hipertensión, insuficiencia renal, disfagia, bajo sodio, bajo azúcar, sin lactosa, sin gluten, textura modificada
- Alergias
- Textura requerida: normal, blanda, molida, licuada
- Restricción de líquidos: activa (boolean), máximo ml por día
- Alimentos que debe consumir
- Alimentos a evitar
- Suplementos (nombre, horario, cantidad)

#### Funcionalidades:
- Planificación semanal con vista calendario
- Banco de recetas favoritas etiquetadas
- Sugerencias según restricciones y preferencias
- Registro de consumo real
- Análisis nutricional (calorías consumidas vs requeridas, balance de macronutrientes, ingesta de líquidos)
- Historial de aceptación (platillos más/menos aceptados, horarios de mejor apetito)
- Lista de compras generada automáticamente
- Exportar menú

#### Permisos:
- **Familiar**: CRUD completo, configurar restricciones, banco de recetas, análisis nutricional
- **Supervisor**: Ver todo, editar menú, ver análisis
- **Cuidador**: Ver menú del día, registrar comidas servidas y consumo, agregar fotos y notas

---

## 4. Arquitectura de Datos (Firestore)

### 4.1 Estructura de Colecciones

**Colección raíz: /pacientes/{pacienteId}**
- Información básica del adulto mayor
- Restricciones dietéticas
- Condiciones médicas
- Alergias
- Seguros
- Contactos de emergencia
- Rangos normales de signos vitales (configurables)

**Subcolecciones del paciente**:

**/usuarios/{userId}**
- UID de Firebase Auth
- Nombre, email, teléfono
- Rol: familiar, supervisor, cuidador
- Foto, activo, permisos, timestamps

**/medicamentos/{medicamentoId}**
- Configuración de medicamentos del pastillero

**/registroMedicamentos/{registroId}**
- Log de administración de medicamentos

**/inventarios/{inventarioId}**
- Items de inventario (medicamentos, materiales, consumibles)
- Tipo: operativo o maestro

**/movimientosInventario/{movimientoId}**
- Transferencias y movimientos entre inventarios

**/contactos/{contactoId}**
- Agenda de contactos

**/eventos/{eventoId}**
- Calendario de citas y eventos

**/actividades/{actividadId}**
- Actividades programadas y realizadas

**/turnos/{turnoId}**
- Horarios de cuidadores

**/menu/{menuId}**
- Planificación y registro de comidas

**/recetas/{recetaId}**
- Banco de recetas

**/chequeosDiarios/{chequeoId}** ⭐ NUEVO
- Registros de chequeo diario de salud

**/signosVitales/{signoId}** ⭐ NUEVO
- Mediciones individuales de signos vitales (permite múltiples por día)

**/documentos/{documentoId}**
- Recetas, estudios, resultados, facturas

**/notificaciones/{notificacionId}**
- Sistema de notificaciones

**/auditoria/{logId}**
- Logs de auditoría

### 4.2 Estructura Detallada: Chequeos Diarios

**/chequeosDiarios/{chequeoId}**:
- pacienteId
- fecha
- turno: matutino, vespertino, nocturno, 24hrs
- cuidadorId y nombre
- horaRegistro

**Estado General**:
- actitud: array de selecciones
- nivelActividad
- nivelCooperacion
- estadoSueño
- dolor: nivel, ubicación, descripción
- notasGenerales

**Alimentación**:
- kefirProbiotico: hora, cantidad, notas
- desayuno: descripción, cantidad
- colacion1: descripción, cantidad
- almuerzo: descripción, cantidad
- colacion2: descripción, cantidad
- cena: descripción, cantidad
- consumoAguaLitros
- otrosLiquidos
- observacionesApetito
- alimentosRechazados

**Funciones Corporales**:
- miccionesNumero
- miccionesCaracteristicas
- evacuacionesNumero
- evacuacionesConsistencia
- evacuacionesColor
- dificultadEvacuar
- laxantesUsados: nombre, cantidad

**Actividades Realizadas**:
- ejerciciosFisioterapia: cuáles, duración
- ejerciciosIntestinales: boolean, descripción
- caminatasNumero: matutina, vespertina, duración
- actividadesRecreativas: array de actividades
- actividadesCognitivas: array
- participacionActitud

**Medicación**:
- medicacionEnTiempoForma: boolean
- medicamentosAdicionales: array con nombre, dosis, motivo, hora
- medicamentosRechazados: array con nombre, motivo
- observacionesMedicacion

**Incidentes**:
- array de incidentes:
  - tipo
  - descripcion
  - hora
  - accionTomada
  - gravedad

**Resumen**:
- resumenGeneral: texto libre
- observacionesImportantes
- recomendacionesSiguienteTurno

- creadoPor, timestamps

**/signosVitales/{signoId}**:
- pacienteId
- fecha
- hora
- temperatura
- spo2
- frecuenciaCardiaca
- presionArterialSistolica
- presionArterialDiastolica
- notas
- fueraDeRango: boolean (calculado automáticamente)
- alertaGenerada: boolean
- registradoPor, timestamps

### 4.3 Índices Compuestos Recomendados

- registroMedicamentos: [fecha, estado]
- inventarios: [categoria, cantidad, tipo]
- eventos: [fecha, tipo, estado]
- turnos: [cuidadorId, fecha, estado]
- actividades: [tipo, estado, fecha]
- notificaciones: [usuarioId, leida, prioridad]
- chequeosDiarios: [fecha, turno, cuidadorId] ⭐ NUEVO
- signosVitales: [pacienteId, fecha, hora] ⭐ NUEVO
- signosVitales: [pacienteId, fueraDeRango, fecha] ⭐ NUEVO

---

## 5. Flujos de Usuario Principales

### 5.1 Flujo: Registro de Chequeo Diario (Cuidador)

**Inicio del Turno**:
1. Cuidador hace check-in del turno
2. Sistema crea borrador de chequeo diario para ese turno
3. Cuidador ve dashboard con secciones pendientes de llenar

**Durante el Día**:
4. **Mañana (07:00-08:00)**: Toma signos vitales
   - Abre sección "Signos Vitales"
   - Captura: temperatura, SpO2, frecuencia cardíaca, presión arterial
   - Si algún valor está fuera de rango → Sistema genera alerta inmediata a familiar
5. **Desayuno (08:30)**: Registra comida servida
   - Marca en menú qué se sirvió
   - Después: registra qué comió realmente y cuánto
6. **Durante el día**: Va llenando conforme suceden las cosas
   - Micciones: contador rápido
   - Evacuaciones: registra cuando ocurren
   - Actividades: marca como completadas desde la lista de actividades
   - Si hay incidente: lo registra inmediatamente con timestamp

**Tarde (14:00-15:00)**: Toma signos vitales nuevamente (opcional)
7. Segunda medición para monitoreo

**Antes de Terminar Turno**:
8. Cuidador abre el chequeo del día
9. Revisa que todas las secciones estén completas
10. Completa resumen general (texto libre)
11. Agrega recomendaciones para siguiente turno
12. Marca chequeo como "Completado"
13. Sistema notifica a familiar y supervisor
14. Sistema genera alertas automáticas si detecta:
    - Signos vitales fuera de rango
    - No evacuación en X días
    - Consumo de agua muy bajo
    - Rechazo de múltiples comidas
    - Múltiples incidentes

**Visualización (Familiar/Supervisor)**:
15. Reciben notificación de chequeo completado
16. Ven resumen del día en formato legible (similar al mensaje de WhatsApp actual)
17. Pueden ver gráficas de tendencias
18. Pueden exportar a PDF para llevar a consultas médicas

### 5.2 Flujo: Administración Completa de Medicamento

**Setup Inicial (Familiar)**:
- Agregar contacto del médico a agenda
- Crear medicamento en pastillero con dosis y horarios
- Agregar medicamento al inventario maestro
- Transferir cantidad semanal a inventario operativo
- Sistema crea recordatorios automáticos

**Operación Diaria (Cuidador)**:
- Ver lista de medicamentos pendientes
- Recibir notificación 15 min antes
- Administrar medicamento
- Registrar en sistema (tomado/rechazado/omitido)
- Sistema reduce inventario operativo automáticamente
- En el chequeo diario: confirmar "Medicación en tiempo y forma"

**Monitoreo (Supervisor/Familiar)**:
- Ver cronología de administración
- Dashboard de adherencia
- Recibir alertas de dosis omitidas
- Alerta cuando inventario bajo
- Revisar en chequeo diario confirmación de medicación

**Reabastecimiento (Familiar)**:
- Ver alerta de inventario operativo bajo
- Transferir de maestro a operativo
- Si maestro bajo, agregar a lista de compras
- Registrar nueva compra en inventario maestro

### 5.3 Flujo: Gestión Completa de Cita Médica

**Programación (Familiar)**:
- Crear evento tipo "Cita Médica"
- Seleccionar médico desde agenda
- Llenar datos: fecha, hora, motivo
- Agregar preparación necesaria
- Asignar cuidador acompañante
- Sistema crea recordatorios

**Una Semana Antes**:
- Notificación a familiar y cuidador
- Familiar confirma cita con médico
- Marca como "Confirmada"

**Un Día Antes**:
- Notificación con checklist de preparación
- Cuidador marca items completados

**Día de la Cita**:
- Notificación 2hrs antes con dirección y navegación
- Cuidador marca "Salida a cita"
- Al llegar marca "Llegada"

**Post-Cita**:
- Cuidador/Familiar abre formulario de resultados
- Registra: diagnóstico, indicaciones, receta, estudios ordenados
- Toma foto de receta
- Si hay cambio de medicamento → Sistema pregunta si actualizar pastillero
- Si hay estudios ordenados → Sistema crea eventos automáticamente
- Si hay próxima cita → Sistema la crea automáticamente
- Documentos quedan vinculados a cita y contacto

### 5.4 Flujo: Día Completo del Cuidador

**07:00 - Inicio de Turno**:
- Registra entrada (check-in con GPS)
- Ve dashboard del día:
  - Medicamentos pendientes
  - Actividades programadas
  - Menú del día
  - Eventos especiales
- Lee notas de entrega del turno anterior
- Sistema crea borrador de chequeo diario
- Toma signos vitales y los registra
- Si hay alerta de signos vitales → Notificación inmediata a familiar

**08:00 - Medicamento Matutino**:
- Recibe notificación
- Administra medicamento
- Registra en pastillero
- Sistema reduce inventario

**08:30 - Desayuno**:
- Ve menú programado
- Prepara y sirve desayuno
- Registra en menú lo servido
- Después del desayuno: registra lo que realmente comió

**09:00-10:30 - Actividad: Caminata**:
- Ve actividad programada
- Marca inicio de actividad
- Realiza caminata
- Marca como completada
- Agrega notas y fotos

**11:00 - Cita con Cardiólogo**:
- Sale a cita (marca salida)
- Llega a consultorio (marca llegada)
- Durante consulta: puede tomar notas
- Regreso: registra resultados de cita
- Toma foto de receta nueva
- Sistema sugiere actualizar pastillero

**13:00 - Comida**:
- Prepara almuerzo según menú
- Sirve comida
- Registra consumo real

**Durante el día**:
- Va registrando micciones
- Registra evacuación cuando ocurre
- Si hay incidente: lo registra inmediatamente

**15:00-17:00 - Actividades Recreativas**:
- Pintar, juegos, lectura
- Marca actividades completadas
- Sube fotos

**19:00 - Antes de Terminar Turno**:
- Revisa chequeo diario
- Completa todas las secciones pendientes
- Escribe resumen general
- Agrega recomendaciones para turno nocturno
- Marca chequeo como completado
- Sistema notifica a familiar
- Registra salida (check-out)
- Entrega turno al siguiente cuidador

**Familiar/Supervisor reciben**:
- Notificación de chequeo completado
- Resumen del día
- Alertas si hay algo importante
- Pueden revisar detalles, gráficas y tendencias

---

## 6. Consideraciones Técnicas

### 6.1 Seguridad
- Firebase Security Rules estrictas por rol
- Todas las acciones auditadas (quién, cuándo, qué)
- Datos sensibles de salud encriptados
- Cumplimiento con regulaciones de datos de salud

### 6.2 Sincronización
- Firestore real-time listeners para updates instantáneos
- Offline support para cuidadores sin internet momentáneo
- Sincronización automática al recuperar conexión

### 6.3 Notificaciones
- Firebase Cloud Messaging para push notifications
- Prioridades:
  - **Alta**: medicamento no administrado, signos vitales fuera de rango, cita en 2hrs, inventario crítico
  - **Media**: cita mañana, inventario bajo, turno en 1hr, actividad en 30min
  - **Baja**: resumen semanal, confirmar cita, sugerencias

### 6.4 Reportes y Analytics
- Dashboard para familiares con métricas:
  - Adherencia a medicamentos (%)
  - Consumo de inventarios
  - Actividades completadas
  - Horas de cuidadores
  - **Tendencias de signos vitales** ⭐
  - **Patrón de evacuaciones y micciones** ⭐
  - **Consumo promedio de agua** ⭐
  - **Estado de ánimo/actitud promedio** ⭐
- Exportar reportes a PDF para médicos
- Gráficas de tendencias

### 6.5 Storage
- Firebase Storage para:
  - Fotos de medicamentos
  - Fotos de actividades
  - Fotos de comidas
  - Documentos médicos (recetas, estudios, resultados)
  - Fotos de contactos
  - Fotos de incidentes
- Organización por carpetas según tipo y fecha

---

## 7. UI/UX Principales

### 7.1 Dashboard Principal (por rol)

**Cuidador**:
- Medicamentos pendientes HOY
- **Chequeo diario: secciones pendientes** ⭐
- **Signos vitales: tomar medición rápida** ⭐
- Próximos eventos (hoy)
- Actividades del día
- Mi turno actual
- Inventario con alertas
- Contactos favoritos (acceso rápido)

**Supervisor**:
- **Resumen de chequeos diarios completados** ⭐
- **Alertas de signos vitales fuera de rango** ⭐
- Resumen de adherencia a medicamentos
- Próximas citas (semana)
- Turnos activos
- Inventarios críticos
- Actividades completadas hoy

**Familiar**:
- **Vista de chequeo diario más reciente** ⭐
- **Gráficas de tendencias de signos vitales (última semana)** ⭐
- **Alertas importantes de salud** ⭐
- Métricas generales
- Calendario integrado (vista semanal)
- Próximas 3 citas médicas
- Directorio rápido (médicos + emergencias)
- Timeline de eventos recientes

### 7.2 Pantallas Clave

**Pantalla: Chequeo Diario** (Cuidador):
- Secciones colapsables:
  - Signos Vitales (botón grande "Tomar Signos")
  - Estado General
  - Alimentación
  - Funciones Corporales
  - Actividades
  - Medicación
  - Incidentes
  - Resumen
- Indicador de progreso (% completado)
- Guardado automático
- Botón "Completar Chequeo"

**Pantalla: Vista de Chequeo** (Familiar/Supervisor):
- Formato tipo "mensaje de WhatsApp" (similar al actual)
- Secciones organizadas y legibles
- Gráficas embebidas de signos vitales
- Botón "Exportar a PDF"
- Navegación a días anteriores
- Vista de comparación entre días

**Pantalla: Tendencias de Salud** (Familiar):
- Gráfica de presión arterial (últimos 30 días)
- Gráfica de SpO2 (últimos 30 días)
- Gráfica de temperatura (últimos 30 días)
- Gráfica de frecuencia cardíaca (últimos 30 días)
- Tabla de evacuaciones y micciones
- Gráfica de consumo de agua
- Filtros por rango de fechas

---

## 8. Fases de Desarrollo Sugeridas

### Fase 1 - MVP Core (3-4 semanas)
- Setup Firebase + Auth
- CRUD usuarios con roles
- Dashboard básico por rol
- Pastillero virtual básico
- Inventario de medicamentos (dual)
- **Registro de chequeo diario básico** ⭐
- **Signos vitales con alertas** ⭐

### Fase 2 - Inventarios y Contactos (2 semanas)
- Inventario materiales y consumibles
- Sistema de transferencias
- Alertas de nivel bajo
- Agenda de contactos completa
- Búsqueda y filtros

### Fase 3 - Calendario y Eventos (2-3 semanas)
- Calendario de eventos
- Integración contactos ↔️ eventos
- Recordatorios y notificaciones
- Registro de resultados post-cita
- Timeline integrado
- Vinculación citas ↔️ pastillero

### Fase 4 - Operación Diaria (2 semanas)
- Lista de actividades
- Horario de cuidadores
- Entrega de turno
- Menú de comida
- Banco de recetas
- **Integración de actividades con chequeo diario** ⭐

### Fase 5 - Reportes y Analytics (2 semanas)
- **Gráficas de tendencias de salud** ⭐
- **Reportes médicos exportables** ⭐
- Análisis nutricional
- Historial médico cronológico
- Dashboard avanzado
- Reportes de horas cuidadores

### Fase 6 - Documentos y Mejoras (1-2 semanas)
- Upload de documentos
- Vinculación documentos ↔️ eventos
- Sistema completo de notificaciones push
- Optimizaciones UI/UX
- Testing y refinamiento

---

## 9. Métricas de Éxito

- Adherencia a medicamentos > 95%
- **100% de chequeos diarios completados a tiempo** ⭐
- **Tiempo de registro de chequeo diario < 10 minutos** ⭐
- **Detección y alerta de signos vitales anormales en < 5 minutos** ⭐
- Tiempo de registro de actividades < 2 min
- 0 errores de inventario (agotamiento inesperado)
- Satisfacción de familiares y cuidadores > 4/5
- **Reducción de 90% en mensajes de WhatsApp para reportes** ⭐

---

## 10. Consideraciones Adicionales

### 10.1 Privacidad y Compliance
- Los datos de salud son sensibles (HIPAA-like considerations)
- Encriptación de datos en reposo y en tránsito
- Logs de auditoría completos
- Control de acceso estricto

### 10.2 Escalabilidad Futura
Aunque el MVP es para un solo adulto mayor, la arquitectura debe permitir:
- Múltiples pacientes por cuenta familiar
- Múltiples familiares por paciente
- Roles más granulares
- Integración con dispositivos IoT (oxímetros, tensiómetros Bluetooth)
- Integración con expediente médico electrónico
- API para terceros

### 10.3 Backup y Recuperación
- Backups automáticos diarios de Firestore
- Exportación de datos completa disponible para familiares
- Plan de recuperación ante desastres

---

**Documento listo para que el equipo de desarrollo comience la implementación del MVP.**