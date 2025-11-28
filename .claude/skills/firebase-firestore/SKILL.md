---
name: firebase-firestore
description: Guía de mejores prácticas para Firebase Firestore. Usar cuando se trabaje con Firestore para: (1) Manejo de valores undefined, (2) Creación de índices compuestos, (3) Timestamps con serverTimestamp(), (4) Patrones de código TypeScript, (5) Solución de errores comunes como "invalid data undefined" o "query requires an index".
---

# Firebase Firestore - Mejores Prácticas

## Reglas Clave

1. No uses `new Date()` para timestamps de creación/actualización → Usa `serverTimestamp()`
2. Sanitiza o configura `ignoreUndefinedProperties` antes de guardar
3. Maneja el caso donde timestamp puede ser `null` al leer
4. Crea índices compuestos para consultas con múltiples where/orderBy
5. No guardes valores `undefined` directamente en Firestore
6. Usa `Timestamp.fromDate()` para fechas específicas del usuario
7. Versiona `firestore.indexes.json` en control de código

## Quick Reference

### Valores Undefined
Firestore no acepta `undefined`. Usar `initializeFirestore` con `ignoreUndefinedProperties: true` o sanitizar datos.
→ Detalles: [references/undefined-handling.md](references/undefined-handling.md)

### Índices
- Single-field: automáticos
- Composite: crear manualmente para queries con múltiples `where()` u `orderBy()`
- El error incluye link directo para crear el índice
→ Detalles: [references/indexes.md](references/indexes.md)

### Timestamps
```typescript
// Crear/actualizar: usar serverTimestamp()
createdAt: serverTimestamp()

// Fechas específicas: usar Timestamp.fromDate()
eventDate: Timestamp.fromDate(new Date('2024-12-25'))

// Leer: manejar null
data.createdAt?.toDate() || new Date()
```
→ Detalles: [references/timestamps.md](references/timestamps.md)

### Patrones TypeScript
- Helpers para create/update con timestamps automáticos
- Converters para tipos TypeScript
- Colecciones tipadas
→ Detalles: [references/code-patterns.md](references/code-patterns.md)

### Errores Comunes
- `undefined field value` → sanitizar o ignoreUndefinedProperties
- `query requires index` → click en link del error
- `timestamp null` → usar serverTimestamps: 'estimate'
→ Detalles: [references/common-errors.md](references/common-errors.md)

## Checklist de Implementación

### Setup Inicial
- [ ] Configurar `ignoreUndefinedProperties: true` o implementar sanitización
- [ ] Crear `firestore.indexes.json` y agregar a git
- [ ] Configurar Security Rules

### Código
- [ ] Usar `serverTimestamp()` para createdAt/updatedAt
- [ ] Manejar valores null/undefined en timestamps al leer
- [ ] Implementar converters para tipos TypeScript
