# Mi Lana

App de finanzas personales: cuánto puedo gastar por semana, gastos e ingresos, gastos fijos, deudas y plan anual de cuándo se libera el dinero.

- **App:** `web/index.html`, publicada en Cloudflare Pages (`mi-lana.pages.dev`)
- **Base de datos:** una hoja de Google Sheets con pestañas Movimientos, Fijos, Deudas y Perfil
- **Puente:** `apps-script/Codigo.gs`, pegado en el Apps Script de esa hoja. Con `@OnlyCurrentDoc`, Google solo le da permiso a esa hoja.

## Montar la hoja
1. Crea la hoja *Mi Lana* → **Extensiones → Apps Script** → pega `Codigo.gs`.
2. Cambia `CLAVE` por una clave tuya (solo en el editor de Apps Script; no la subas aquí).
3. Ejecuta `prepararHoja` y acepta el permiso.
4. **Implementar → Nueva implementación → App web**. Ejecutar como: *Yo*. Acceso: *Cualquier persona*. Copia el enlace `/exec`.
5. Abre la app, pega el enlace y la clave, y dale **Conectar**.

Si cambias `Codigo.gs`, actualiza la implementación existente (**Implementar → Administrar implementaciones → Editar → Nueva versión**) para que el enlace no cambie.

## Publicación
Cada cambio en `web/` se publica solo con `.github/workflows/publicar.yml`. Necesita los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` (los mismos que Kaya).
