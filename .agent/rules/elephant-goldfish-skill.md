# SKILL: ELEPHANT ARCHITECT & GOLDFISH EXECUTOR + CONTEXTO TESIS BOGOTÁ

## I. FILOSOFÍA DE TRABAJO (ELEPHANT & GOLDFISH PROTOCOL)
1. **Planificación como Elefante (Memoria Total e Inmutable):**
   - Antes de tocar cualquier archivo, respeta estrictamente la arquitectura registrada en la Sección II.
   - Nunca reestructures carpetas ni cambies nombres de columnas SQL o contratos de endpoints sin autorización explícita.
2. **Ejecución como Pez Dorado (Foco Quirúrgico y Ahorro de Tokens):**
   - Trata cada subtarea de forma aislada y atómica con contexto mínimo.
   - **PROHIBICIÓN ESTRICTA DE LECTURA (Token Guard):** NUNCA leas ni indexes archivos `.geojson`, `.csv`, `.sql`, `.db`, `.sqlite`, `node_modules/`, `.angular/`, `dist/` ni `target/`. Para inspeccionar datos en `.csv` o `.db`, ejecuta un comando rápido de Python o SQLite en la terminal (`SELECT COUNT(*)`, `head -n 5`) en lugar de abrir el archivo en el contexto.
3. **Estándar de Código y Diseño:**
   - **Cero comentarios conversacionales:** Prohibido escribir comentarios tipo `// Cambio aquí` o `// Nuevo código`. Solo comentarios técnicos concisos de funcionalidad cuando sea estrictamente necesario.
   - **Rutas 100% relativas:** Prohibido quemar rutas absolutas (`C:\Users\...`) en Java, TypeScript o Python.
   - **UI Ejecutiva y Sobria:** Cero emojis en HTML/TS. Diseño oscuro analítico de alto contraste (`#0f172a` / `#1e293b`), tipografía limpia y controles alineados.

---

## II. MEMORIA DEL ELEFANTE: ESTADO ACTUAL DEL PROYECTO
- **Stack y Puertos:**
  - **Backend (`backend/`):** Java 21 + Spring Boot 3.4.3 + JDBC (`sqlite-jdbc`) en `http://localhost:8080`. Capas: `config`, `controller`, `service`, `repository`, `dto`.
  - **Base de Datos:** `backend/data/accidentes_bogota_spatialite.db` (con copia idéntica sincronizada en `./accidentes_bogota_spatialite.db` para DBeaver).
  - **Insumos Crudos:** Ubicados exclusivamente en `backend/data/raw/` (`puntos/`, `localidades/`, `upz/`). Prohibido poner datos en `frontend/`.
  - **Frontend (`frontend/`):** Angular 22 (Standalone + Signals) + Leaflet 1.9.4 + `leaflet.heat` en `http://localhost:4200`.
- **Tablas SQLite (`accidentes_bogota_spatialite.db`):**
  1. `puntos_accidentes` (`POINT` WKT): `id_local`, `CODIGO_ACCIDENTE` (UNIQUE), `FECHA` (`YYYY-MM-DD`), `HORA`, `GRAVEDAD` (`1`=Muertos, `2`=Heridos, `3`=Solo daños), `GRAVEDAD_DESC`, `CLASE_DESC`, `CHOQUE_DESC`, `DIRECCION`, `DIRECCION_COMPLETA`, `CODIGO_LOCALIDAD`, `CODIGO_UPZ`, `NOMBRE_UPZ`, `geom`.
  2. `calles_bogota` (`LINESTRING` WKT): 71.172 tramos viales de las 20 localidades (`id_local`, `localidad`, `id`, `nom`, `tipo`, `codigo_upz`, `geom`).
  3. `upz_bogota` (`MULTIPOLYGON` WKT): 33 polígonos oficiales de IDECA con conteos agregados.
- **Jerarquía Visual en Leaflet (Custom Panes en `map-view.ts`):**
  - `choroplethPane` (`z-index: 350`) abajo.
  - `roadsPane` (`z-index: 410`) en medio (con Nivel de Detalle progresivo por Zoom y Slider de Opacidad).
  - `accidentsPane` (`z-index: 650`) **SIEMPRE ARRIBA** para que los puntos de siniestros se pinten encima de las calles.
- **Filtros Temporales Reactivos:**
  - Solo **Año** y **Mes** (se eliminó el filtro de día por directriz del director de tesis).