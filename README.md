# Sistema de Estimacion y Visualizacion Geoespacial de Accidentalidad Vial en Bogota D.C.

Trabajo de Grado  
Carrera de Ingenieria de Sistemas  
Facultad de Ingenieria  
Pontificia Universidad Javeriana  
Bogota D.C., Colombia  

---

## Equipo de Proyecto - Grupo 16

* **Autores:**
  * Ana Sofia Arboleda Convers
  * Arantxa Marian Espejo Malagon
  * Nicolas Mateo Morales Sanchez
  * Johann Sebastian Berrio Barreto
* **Director de Proyecto:**
  * Ing. Andres Oswaldo Calderon Romero

---

## 1. Descripcion General del Proyecto

El presente proyecto constituye una plataforma integral para el analisis, estimacion y visualizacion de siniestralidad vial en Bogota D.C., fundamentada en la metodologia estandar CRISP-DM (Cross-Industry Standard Process for Data Mining). El objetivo principal es transformar el enfoque tradicional reactivo en la gestion de transito hacia un esquema preventivo y analitico, facilitando la identificacion de patrones espacio-temporales y la focalizacion de recursos institucionales en seguridad vial.

El sistema articula:
1. Un pipeline analitico de procesamiento masivo de datos abiertos de siniestralidad vial (Secretaria Distrital de Movilidad y datos.gov.co), enriquecido con variables temporales, clasificacion jerarquica de la malla vial urbana y divisiones por Unidades de Planeamiento Zonal (UPZ).
2. Modelos de Machine Learning supervisados (XGBoost multiclase balanceado) optimizados para la estimacion probabilistica del nivel de severidad de siniestros viales (Solo Danos, Con Heridos, Con Muertos).
3. Un microservicio analitico de inferencia en tiempo real y geocodificacion con FastAPI y Nomimatim (OpenStreetMap).
4. Un orquestador backend desarrollado en Java con Spring Boot que integra una base de datos relacional y espacial SQLite/SpatiaLite para consultas vectoriales aceleradas.
5. Un visualizador web interactivo (Single Page Application) desarrollado en Angular con Leaflet.js, provisto de controles dinamicos, mapas coropleticos, mapas de densidad y simulacion predictiva puntual.

---

## 2. Arquitectura de Software y Topologia de Sistemas

La solucion implementa una arquitectura desacoplada orientada a servicios (REST API) dividida en cuatro capas funcionales:

```
[ Capa de Presentacion: Angular 22 + Leaflet (Puerto 4200) ]
                      |
                      | HTTP / REST (JSON & GeoJSON)
                      v
[ Capa de Negocio / Gateway: Spring Boot 3.4.3 (Puerto 8080) ]
        |                                           |
        | JDBC SQLite                               | HTTP REST
        v                                           v
[ Base de Datos Espacial ]        [ Microservicio Inferencia ML: FastAPI (Puerto 8000) ]
  SpatiaLite / SQLite 3                            |
  - puntos_accidentes                              | Inferencia Joblib
  - calles_bogota                                  v
  - upz_bogota                     [ Modelos Serializados XGBoost ]
```

### Capa 1: Presentacion (Frontend SPA)
* **Framework:** Angular (Arquitectura Standalone Components y Reactividad mediante Signals).
* **Renderizado Cartografico:** Leaflet.js con proveedores de mapas base OpenStreetMap y CartoDB (Modos Dark y Light).
* **Capas del Mapa y Jerarquia de Renderizado (Z-Index):**
  * `choroplethPane` (z-index 350): Capa coropletica de agregacion territorial por UPZ.
  * `roadsPane` (z-index 410): Red vial de Bogota con control dinamico de opacidad y filtro jerarquico.
  * `accidentsPane` (z-index 650): Capa de eventos historicos de accidentalidad vial clasificados por gravedad.
  * `predictionPane` (z-index 720): Marcador geoespacial interactivo de la prediccion de riesgo puntual emitida por el modelo de ML.

### Capa 2: Logica de Negocio y Orquestacion (Backend Gateway)
* **Lenguaje y Framework:** Java 21 con Spring Boot 3.4.3.
* **Controladores y Servicios:**
  * `MapaController` / `MapaService` / `MapaRepository`: Exposicion y transformacion de consultas espaciales hacia GeoJSON (RFC 7946).
  * `PrediccionController` / `PrediccionService`: Gateway HTTP que recibe peticiones del frontend y las orquesta hacia el microservicio en Python usando `RestTemplate`, soportando anulacion de endpoint destino (`X-ML-Target-Url`).
* **Conexion de Datos:** `DatabaseConfig` con `org.sqlite.JDBC` apuntando al motor embebido `accidentes_bogota_spatialite.db`.
* **CORS y Compresion:** Habilitacion de cabeceras seguras cruzadas y compresion GZIP nativa para respuestas JSON superiores a 1 KB.

### Capa 3: Servicios Analiticos e Inferencia (Microservicio ML)
* **Framework:** Python 3.11 con FastAPI y Uvicorn.
* **Validacion de Esquema:** Pydantic (`SolicitudPrediccion`).
* **Modelos Predictivos Desplegados:**
  * **Estrategia A (Predeterminada):** `multiclase_XGBoost_Lite.joblib` entrenado sobre las 8 variables predictivas de mayor ganancia de informacion (78.02% del Gain acumulado), optimizado para respuesta inmediata en entornos web.
  * **Estrategia B (Completa):** `multiclase_XGBoost.joblib` que evalua la matriz completa de 49 caracteristicas mediante un vector de imputacion estadistica (`plantilla_imputacion_49.json`).
* **Geocodificacion Espacial:** Integracion con GeoPy (Nominatim / OpenStreetMap) mediante normalizacion de nomenclatura vial de Bogota (AK, AC, KR, CL, DG, TV).

### Capa 4: Persistencia y Gestion Espacial
* **Base de Datos:** SQLite 3 con extension espacial SpatiaLite.
* **Tablas Principales:**
  * `puntos_accidentes`: Registro de siniestros viales con coordenadas geograficas proyectadas en EPSG:4326 (WGS84), gravedad, clase, tipo de choque y temporalidad.
  * `calles_bogota`: 71.172 segmentos viales correspondientes a la malla vial urbana con geometrias `LINESTRING` e indices espaciales R-Tree.
  * `upz_bogota`: Poligonos territoriales oficiales de las Unidades de Planeamiento Zonal con indicadores agregados.

---

## 3. Requisitos del Entorno

Para compilar, ejecutar y verificar la plataforma completa, se requiere contar con las siguientes herramientas instaladas en el sistema anfitrion:

* **Entorno Java:**
  * Java Development Kit (JDK) version 21 LTS.
  * Apache Maven 3.9+ (o ejecucion directa mediante el script wrapper embebido `mvnw` / `mvnw.cmd`).
* **Entorno Node.js / Frontend:**
  * Node.js version 20.x o 22.x LTS.
  * Gestor de paquetes `npm` (version 10+).
  * Angular CLI global (opcional): `npm install -g @angular/cli`.
* **Entorno Python (Microservicio ML y Scripts):**
  * Python version 3.11.x.
  * Gestor de dependencias `pip`.
  * Librerias: `fastapi`, `uvicorn`, `pydantic`, `xgboost`, `scikit-learn`, `pandas`, `geopy`.
* **Hardware Minimo Recomendado:**
  * Procesador: Multi-core (Intel Core i5 / AMD Ryzen 5 o superior).
  * Memoria RAM: Minimo 8 GB (16 GB recomendados para la ejecucion paralela de los servicios).
  * Espacio libre en disco: Minimo 5 GB.

---

## 4. Estructura del Repositorio

```text
tesis-accidentes-bogota/
├── backend/                                # Backend en Java Spring Boot (Gateway y API Geoespacial)
│   ├── src/main/java/com/tesis/accidentes/backend/
│   │   ├── config/                         # Configuraciones CORS y DataSource SQLite
│   │   │   ├── CorsConfig.java
│   │   │   └── DatabaseConfig.java
│   │   ├── controller/                     # Controladores REST de la aplicacion
│   │   │   ├── MapaController.java
│   │   │   └── PrediccionController.java
│   │   ├── dto/                            # Data Transfer Objects (GeoJSON y Modelos de Inferencia)
│   │   │   ├── GeoJsonCollectionDto.java
│   │   │   ├── GeoJsonFeatureDto.java
│   │   │   ├── PrediccionRiesgoRequestDto.java
│   │   │   └── PrediccionRiesgoResponseDto.java
│   │   ├── repository/                     # Acceso a datos via JDBC sobre SpatiaLite
│   │   │   └── MapaRepository.java
│   │   ├── service/                        # Capa de logica de negocio y cliente HTTP
│   │   │   ├── MapaService.java
│   │   │   └── PrediccionService.java
│   │   └── BackendApplication.java         # Punto de entrada Spring Boot
│   ├── src/main/resources/
│   │   └── application.properties          # Propiedades de servidor y URLs de microservicios
│   ├── mvnw / mvnw.cmd                     # Maven Wrapper
│   └── pom.xml                             # Dependencias Maven (Spring Boot, sqlite-jdbc, jackson)
│
├── frontend/                               # Aplicacion cliente en Angular (SPA)
│   ├── src/app/
│   │   ├── components/
│   │   │   ├── map-view/                   # Visor cartografico Leaflet con Custom Panes
│   │   │   │   ├── map-view.html
│   │   │   │   ├── map-view.scss
│   │   │   │   └── map-view.ts
│   │   │   └── sidebar-filters/            # Panel lateral con filtros reactivos y formulario predictivo
│   │   │       ├── sidebar-filters.html
│   │   │       ├── sidebar-filters.scss
│   │   │       └── sidebar-filters.ts
│   │   ├── services/
│   │   │   ├── map-state.service.ts        # Gestion centralizada del estado reactivo (Signals)
│   │   │   └── mapa-api.service.ts         # Cliente HTTP hacia Spring Boot y fallback a FastAPI
│   │   ├── app.config.ts                   # Configuracion de proveedores HTTP y animaciones
│   │   ├── app.html / app.ts / app.scss    # Contenedor raiz
│   │   └── main.ts                         # Bootstrap de Angular
│   ├── package.json                        # Definicion de dependencias y scripts de Angular
│   └── angular.json                        # Configuracion del compilador Angular
│
├── scripts/                                # Scripts de soporte y geoprocesamiento
│   ├── construir_bd_completa.py            # Construccion e indexacion de la base de datos espacial
│   ├── cargar_spatialite.py                # Carga de capas vectoriales
│   ├── integrar_upz_bogota.py              # Homologacion y agregacion de geometrias UPZ
│   └── descargar_localidad_osm.py          # Extraccion de tramos viales desde OpenStreetMap
│
├── accidentes_bogota_spatialite.db         # Base de datos relacional y espacial SQLite
├── .gitignore                              # Reglas de exclusion de control de versiones
└── README.md                               # Documentacion tecnica del proyecto
```

---

## 5. Guia de Instalacion y Puesta en Marcha

Para iniciar la plataforma completa, siga los pasos descritos a continuacion para cada uno de los componentes:

### 5.1 Puesta en Marcha del Backend (Spring Boot)

1. Abra una terminal y navegue al directorio del backend:
   ```bash
   cd backend
   ```

2. Compile y ejecute el servicio utilizando el Maven Wrapper:
   * En sistemas Windows (PowerShell / CMD):
     ```powershell
     .\mvnw.cmd spring-boot:run
     ```
   * En sistemas Linux / macOS:
     ```bash
     ./mvnw spring-boot:run
     ```

3. El backend iniciara en el puerto `8080`. Para verificar la disponibilidad del servicio, acceda a:
   ```text
   http://localhost:8080/api/mapa/anios
   ```
   El endpoint debe responder con la lista de anos disponibles en formato JSON.

### 5.2 Puesta en Marcha del Frontend (Angular)

1. Abra una segunda terminal y navegue al directorio del cliente web:
   ```bash
   cd frontend
   ```

2. Instale las dependencias de Node.js:
   ```bash
   npm install
   ```

3. Inicie el servidor de desarrollo de Angular:
   ```bash
   npm start
   ```
   *(O mediante `npx ng serve --port 4200`)*.

4. Abra su navegador web e ingrese a:
   ```text
   http://localhost:4200/
   ```

### 5.3 Microservicio de Inferencia de Machine Learning (FastAPI)

En caso de contar con el modulo de inferencia analitica en su entorno local:

1. Active su entorno virtual de Python e instale las dependencias requeridas:
   ```bash
   pip install fastapi uvicorn pydantic xgboost scikit-learn pandas geopy
   ```

2. Inicie el servidor ASGI Uvicorn:
   ```bash
   uvicorn app_fastapi:app --host 0.0.0.0 --port 8000 --reload
   ```

3. La documentacion interactiva de OpenAPI estara disponible en:
   ```text
   http://localhost:8000/docs
   ```

---

## 6. Especificacion de Endpoints de la API REST

### Modulo Geoespacial (Spring Boot Gateway - Puerto 8080)

| Metodo | Endpoint | Parametros Query | Descripcion | Formato Respuesta |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/mapa/anios` | Ninguno | Obtiene la lista de anos con registros de siniestralidad. | `Array<string>` |
| `GET` | `/api/mapa/calles` | `localidad` (opcional), `upz` (opcional) | Retorna los segmentos de la malla vial urbana filtrados. | `GeoJSON FeatureCollection` |
| `GET` | `/api/mapa/accidentes` | `localidad`, `anio`, `mes`, `upz` | Retorna los puntos individuales de accidentes segun filtros temporales y espaciales. | `GeoJSON FeatureCollection` |
| `GET` | `/api/mapa/upz` | `localidad`, `anio`, `mes` | Retorna los poligonos de UPZ con conteos agregados de siniestros para el mapa coropletico. | `GeoJSON FeatureCollection` |
| `POST`| `/api/mapa/predecir-riesgo` | Header: `X-ML-Target-Url` (opcional) | Orquesta la peticion hacia el microservicio de inferencia en Python. | `JSON Object` |

### Modulo de Inferencia (FastAPI - Puerto 8000)

| Metodo | Endpoint | Descripcion |
| :--- | :--- | :--- |
| `POST` | `/api/v1/predecir-riesgo` | Valida variables del siniestro, ejecuta la inferencia con XGBoost y resuelve geocodificacion opcional. |

#### Ejemplo de Carga Util de Solicitud (Payload JSON):

```json
{
  "total_actores": 2,
  "total_vehiculos": 2,
  "cant_ciclistas": 0,
  "choque_vehiculo": 1,
  "choque_sin_registro": 0,
  "objeto_fijo_no_aplica": 1,
  "clase_camion_furgon": 0,
  "clase_campero": 0,
  "estrategia": "A",
  "direccion": "AK 68 # 26-50"
}
```

#### Ejemplo de Respuesta de Prediccion:

```json
{
  "estrategia_aplicada": "A",
  "prediccion_codigo": 2,
  "prediccion_descripcion": "Con Heridos",
  "probabilidades": {
    "solo_danos": 0.3214,
    "con_heridos": 0.5841,
    "con_muertos": 0.0945
  },
  "nivel_riesgo": "ALTO",
  "ubicacion": {
    "estado": "ENCONTRADA",
    "direccion_ingresada": "AK 68 # 26-50",
    "direccion_normalizada": "Avenida Carrera 68 # 26-50, Bogota, Colombia",
    "direccion_oficial": "Avenida Carrera 68, Salitre, Teusaquillo, Bogota, Colombia",
    "latitud": 4.6582,
    "longitud": -74.1031
  }
}
```

---

## 7. Protocolo de Resiliencia del Cliente Web

El visualizador en Angular implementa un patron de resiliencia en la capa de comunicacion (`MapaApiService`):
1. **Ruta Principal:** El cliente envia la peticion predictiva a `http://localhost:8080/api/mapa/predecir-riesgo`. El gateway Spring Boot se encarga de auditar, encapsular y reenviar la solicitud al microservicio analitico.
2. **Ruta de Respaldo (Fallback Directo):** En caso de indisponibilidad temporal del backend en Spring Boot, el interceptor reactivo conmuta automaticamente la llamada directamente hacia `http://localhost:8000/api/v1/predecir-riesgo` (aprovechando que FastAPI cuenta con cabeceras CORS habilitadas), garantizando continuidad en la experiencia del analista institucional.

---

## 8. Referencias y Marco Metodologico

1. IEEE (1998). *IEEE Recommended Practice for Software Requirements Specifications (IEEE Std 830-1998)*. IEEE Computer Society.
2. IEEE (2009). *IEEE Standard for Information Technology - Systems Design - Software Design Descriptions (IEEE Std 1016-2009)*. IEEE Computer Society.
3. Chapman, P. et al. (2000). *CRISP-DM 1.0: Step-by-step data mining guide*. SPSS Inc.
4. Chen, T., & Guestrin, C. (2016). *XGBoost: A Scalable Tree Boosting System*. Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining.
5. Grupo 16 (2026). *Especificacion de Requerimientos de Software (SRS) - Modelo de estimacion de accidentes de transito en Bogota*. Pontificia Universidad Javeriana.
6. Grupo 16 (2026). *Descripcion del Diseno de Software (SDD) - Modelo de estimacion de accidentes de transito en Bogota*. Pontificia Universidad Javeriana.
7. Grupo 16 (2026). *Plan de Administracion del Proyecto (SPMP) - Modelo de estimacion de accidentes de transito en Bogota*. Pontificia Universidad Javeriana.
8. Alcaldia Mayor de Bogota D.C. (2021). *Decreto 555 de 2021: Plan de Ordenamiento Territorial (POT) de Bogota D.C.*
