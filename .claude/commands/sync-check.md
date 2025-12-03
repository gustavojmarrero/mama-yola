# Verificar Sincronización con Remoto

Verifica si el repositorio local está sincronizado con el repositorio remoto:

1. **Fetch**: Ejecuta `git fetch origin` para obtener los últimos cambios del remoto sin aplicarlos
2. **Comparar branches**: Ejecuta `git status` para ver el estado de sincronización
3. **Verificar commits adelante/atrás**: Ejecuta `git rev-list --left-right --count origin/main...HEAD` para contar commits de diferencia
4. **Mostrar diferencias**: Si hay diferencias, muestra los commits que faltan con `git log --oneline`

Reporta claramente:
- Si el repositorio está sincronizado
- Si hay commits locales pendientes de push
- Si hay commits remotos pendientes de pull
- Si hay conflictos potenciales (cambios en ambos lados)

Sugiere las acciones necesarias según el estado encontrado.
