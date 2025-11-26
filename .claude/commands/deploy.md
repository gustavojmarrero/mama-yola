# Deploy

Realiza el proceso completo de deploy:

1. **Verificar cambios**: Ejecuta `git status` para ver los archivos modificados
2. **Build**: Ejecuta `npm run build` para compilar el proyecto
3. **Commit**: Si el build es exitoso, crea un commit con un mensaje descriptivo basado en los cambios realizados. El mensaje debe:
   - Seguir el formato conventional commits (feat, fix, refactor, etc.)
   - Ser conciso y descriptivo
   - Terminar con el footer de Claude Code
4. **Deploy**: Ejecuta `firebase deploy` para desplegar a producción
5. **Push**: Ejecuta `git push` para sincronizar con el repositorio remoto

Si hay errores en cualquier paso, detente e informa al usuario.

Al finalizar, muestra la URL de la aplicación desplegada.
