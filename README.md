# Arenado 24 Horas · Sistema de pedidos

## Estructura
- `index.html`, `css/`, `js/` → la página (tu diseño original, separado en archivos)
- `js/config.js` → URL de tu Web App de Apps Script
- `sw.js`, `manifest.webmanifest`, `icon.svg` → modo offline e instalable como app
- `apps-script/Code.gs` + `appsscript.json` → backend (conectado a tu hoja "BASE DE DATOS ACCESIBLE")

## Instalación (10 minutos)
1. Abre tu proyecto de Apps Script. Borra todo el contenido de `Code.gs` y pega el de `apps-script/Code.gs`.
2. En la línea `CODIGO_ADMIN = ''` escribe un código secreto (sirve para crear usuarios nuevos).
3. Selecciona la función `configurar` y pulsa **Ejecutar** (acepta los permisos).
4. **Implementar → Administrar implementaciones → ✏️ Editar → Versión: Nueva versión → Implementar**
   (ejecutar como: *Yo* · acceso: *Cualquier persona*). Así la URL `/exec` se mantiene igual.
   Si creas una implementación nueva, copia la URL nueva en `js/config.js`.
5. Sube la carpeta (sin `apps-script/`) a un hosting gratis con HTTPS: Netlify Drop, GitHub Pages o Firebase Hosting.
   También funciona abriendo `index.html` directamente (sin modo offline).

## Contraseñas
Las contraseñas actuales de la hoja (123456) siguen funcionando, pero son muy débiles. Cámbialas en la hoja
"USUARIOS (NO TOCAR)". Los usuarios creados desde la página se guardan cifrados (SHA-256).

## Qué cambió respecto a tu HTML
- Login validado en el servidor con token; ya no se envían contraseñas al navegador.
- Crear usuarios exige el código de administrador (antes cualquiera podía crearse un usuario Admin).
- Bloqueo de escritura (LockService): sin filas pisadas entre varios usuarios.
- Cola de envío con reintentos: si se cae internet no se pierde nada; se envía al volver.
- Actualización en vivo cada 15 s y solo descarga datos si algo cambió.
- IDs únicos de tarjeta (antes dos usuarios podían generar el mismo ID).
- El histórico se registra una sola vez, al cobrar y cerrar (antes se duplicaba al finalizar y al cobrar).
- Clientes duplicados no se vuelven a agregar. Se corrigió `isRegisterMode` (no estaba declarada) y "Copiar Texto" (copia el resumen real).
