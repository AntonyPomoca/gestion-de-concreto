# Guía de Despliegue en Railway

He preparado el proyecto para que sea compatible con Railway. Sigue estos pasos para desplegar tu aplicación:

## 1. Preparación del Repositorio
Asegúrate de que todos los cambios estén en tu repositorio de GitHub.

## 2. Crear un nuevo proyecto en Railway
1. Ve a [Railway.app](https://railway.app/) e inicia sesión.
2. Haz clic en **"New Project"**.
3. Selecciona **"Deploy from GitHub repo"** y elige tu repositorio.

## 3. Configuración de Almacenamiento Persistente (Crítico para SQLite)
Como la aplicación usa SQLite (`concrete.db`), los datos se perderán cada vez que la aplicación se reinicie a menos que uses un **Volume**.

1. En el dashboard de tu servicio en Railway, ve a la pestaña **"Settings"**.
2. Busca la sección **"Volumes"** y haz clic en **"Add Volume"**.
3. Ponle un nombre (ej: `data`) y establece el **Mount Path** como `/data`.
4. Ve a la pestaña **"Variables"** y añade una nueva variable:
   - **Nombre:** `DATABASE_PATH`
   - **Valor:** `/data/concrete.db`

## 4. Variables de Entorno adicionales
Asegúrate de que Railway asigne automáticamente la variable `PORT`. No necesitas configurarla manualmente, Railway lo hace por ti.

## 5. Comandos de Construcción y Inicio
Railway debería detectar automáticamente los comandos, pero puedes configurarlos manualmente en **Settings > Build & Deploy**:
- **Build Command:** `npm run build`
- **Start Command:** `npm start`

## 6. Solución de Problemas (Troubleshooting)
Si la aplicación no carga o da error:
1. **Verifica los Logs:** En el dashboard de Railway, ve a la pestaña **"View Logs"**. Busca errores de "Module not found" o errores de puerto.
2. **Health Check:** Intenta acceder a `tu-url.railway.app/api/health`. Si esto devuelve un JSON, el servidor está vivo pero el frontend (Vite) podría tener problemas.
3. **Node Version:** Asegúrate de que Railway esté usando una versión de Node reciente (v20 o v22). Puedes especificarla en `package.json` añadiendo:
   ```json
   "engines": {
     "node": ">=20"
   }
   ```
4. **Build de Vite:** Asegúrate de que la carpeta `dist/` se esté generando correctamente durante el despliegue.

¡Listo! Tu aplicación debería estar funcionando en la URL que Railway te proporcione.
