# Contexto Técnico y Estado Actual del Proyecto — Tesis Accidentalidad Vial Bogotá D.C.

## 1. Arquitectura General y Stack Tecnológico
- **Backend (`backend/`):** 
  - Java 21 + Spring Boot 3.4.3 + JDBC (`sqlite-jdbc`). Corre en `http://localhost:8080`.
  - Arquitectura modular por capas: 
    - `config` (`DatabaseConfig` para SpatiaLite).
    - `controller` (`MapaController` para endpoints REST `/api/mapa/...`).
    - `service` (`MapaService` para lógica de negocio).
    - `repository` (`MapaRepository` para consultas SQL y parseo de geometrías WKT a GeoJSON).
    - `dto` (`GeoJsonCollectionDto`, `GeoJsonFeatureDto`).
- **Base de Datos Espacial (`accidentes_bogota_spatialite.db`):**
  - Motor SQLite con soporte geoespacial (SpatiaLite, WGS84 EPSG:4326).
  - Tablas principales:
    - `puntos_accidentes`: ~9,726 siniestros únicos georreferenciados (2015–2020) con gravedad, fecha, hora, etc.
    - `calles_bogota`: 71,172 tramos viales de las 20 localidades de Bogotá (`LINESTRING`).
    - `upz_bogota`: 33 polígonos oficiales de UPZ/UPL de IDECA con agregación de accidentes (`MULTIPOLYGON`).
- **Frontend (`frontend/`):**
  - Angular 18/22 (Standalone Components + Signals) + Leaflet 1.9.4 + `leaflet.heat`. Corre en `http://localhost:4200`.
  - Estado global reactivo en `MapStateService` y cliente HTTP en `MapaApiService`.
  - Estilos oscuros sobrios y ejecutivos (Dashboard analítico).

## 2. Funcionalidades y Módulos Implementados
1. **Tres Modos de Visualización Cartográfica:**
   - **Puntos:** Siniestros individualizados clasificados por color según gravedad (Muertos, Heridos, Solo daños).
   - **Mapa de Calor (`leaflet.heat`):** Densidad térmica de accidentalidad ponderada por severidad.
   - **Coropletas por UPZ:** Poligonal analítica coloreada por rangos de concentración de siniestros con tooltips interactivos.
2. **Jerarquía y Control de Capas en Leaflet (Custom Panes):**
   - `choroplethPane` (`z-index: 350`) - Fondo.
   - `roadsPane` (`z-index: 410`) - Malla vial intermedia con LOD (Level of Detail) por zoom y slider de opacidad en tiempo real.
   - `accidentsPane` (`z-index: 650`) - Puntos de siniestros **siempre en la capa superior**.
3. **Filtros Temporales y Espaciales Reactivos:**
   - Selector de Año (2015–2020) y Mes (Enero–Diciembre).
   - Filtro sectorizado por UPZ / Localidad con auto-encuadre (`fitBounds`).
   - Buscador de corredores viales por nombre con opción de aislamiento de vía.
4. **Atribución y Leyenda Cartográfica:**
   - Atribución oficial de mapa (`Leaflet | IDECA / OpenStreetMap`).
   - Leyenda dinámica adaptable al modo de visualización activo.

## 3. Reglas de Desarrollo y Estándares
- **Rutas 100% relativas:** Nunca quemar rutas absolutas de Windows en código.
- **Cero comentarios conversacionales:** Únicamente comentarios técnicos estrictamente necesarios en el código fuente.
- **Separación estricta:** Datos crudos en `backend/data/raw/`, base de datos SpatiaLite en `backend/data/`, lógica de datos en el Backend y renderizado/UI en el Frontend.