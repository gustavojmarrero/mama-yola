# Índices en Firestore

## Tipos de Índices

1. **Single-Field Indexes**: Creados automáticamente para cada campo
2. **Composite Indexes**: Deben crearse manualmente para consultas complejas

## Cuándo Necesitas un Índice Compuesto

- Consultas con múltiples cláusulas `where()`
- Combinación de `where()` y `orderBy()` en diferentes campos
- Consultas con múltiples `orderBy()` en diferentes campos

## Creación de Índices

### Método 1: A través del Error (Más Rápido)
Ejecuta la consulta → El error incluye un **link directo** para crear el índice automáticamente.

### Método 2: Firebase CLI (Recomendado para Proyectos)

**1. Crear/editar `firestore.indexes.json`:**

```json
{
  "indexes": [
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "products",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "price", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": [
    {
      "collectionGroup": "documents",
      "fieldPath": "largeTextField",
      "indexes": []
    }
  ]
}
```

**2. Desplegar:**
```bash
firebase deploy --only firestore:indexes
```

**3. Exportar índices existentes:**
```bash
firebase firestore:indexes > firestore.indexes.json
```

## Límites Importantes

| Recurso | Límite |
|---------|--------|
| Composite indexes por BD | 200 (sin facturación) / 1,000 (con facturación) |
| Entradas de índice por documento | 40,000 |
| Tamaño de valor indexado | 1,500 bytes |
| Campos por composite index | 100 |

## Index Exemptions (Deshabilitar Indexación)

Usar para campos que **nunca** consultarás:

```json
{
  "fieldOverrides": [
    {
      "collectionGroup": "users",
      "fieldPath": "profileDescription",
      "indexes": []
    }
  ]
}
```

## Restricciones con Arrays

- ✅ Máximo 1 campo array por composite index
- ✅ Máximo 1 cláusula `array-contains` por consulta
- ❌ NO combinar `array-contains` con `array-contains-any`
- ⚠️ Límite de 10 valores en `whereIn` y `array-contains-any`
