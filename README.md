# Visualizador Geoespacial de Accidentalidad Vial - Bogotá D.C.

Módulo interactivo de visualización geoespacial desarrollado en Angular y Leaflet sobre OpenStreetMap. Este componente forma parte de la arquitectura del proyecto de grado enfocado en la estimación de riesgo y probabilidad de accidentes de tráfico en Bogotá mediante técnicas de Machine Learning.

---

## 🚀 Tecnologías Principales

* **Framework Frontend:** [Angular](https://angular.dev/) (Standalone Components)
* **Visualización Geoespacial:** [Leaflet.js](https://leafletjs.com/)
* **Cartografía Base:** [OpenStreetMap (OSM)](https://www.openstreetmap.org/)
* **Preprocesamiento de Datos:** Python (PyProj para transformaciones cartográficas a EPSG:4326)
* **Formato de Intercambio Espacial:** GeoJSON (RFC 7946)

---

## 📋 Requisitos Previos

Asegúrese de contar con el siguiente software instalado en su entorno de desarrollo:

1. **Node.js:** Versión 18.x o 20.x LTS ([Descargar Node.js](https://nodejs.org/))
2. **Angular CLI:** Versión 18 o superior (`npm install -g @angular/cli`)
3. **Python 3.10+:** Opcional, únicamente requerido si se ejecutan scripts de transformación de datos.
4. **Visual Studio Code:** Recomendado con extensiones de Angular y ESLint.

---

## 🛠️ Instalación y Puesta en Marcha

### 1. Clonar el repositorio

```bash
git clone https://github.com/Proyecto-de-Grado-Grupo-16-2630/visualizador.git
cd visualizador
```

### 2. Instalar dependencias del frontend

Navegue al directorio del cliente web e instale las librerías necesarias:

```bash
cd frontend
npm install
```

### 3. Ejecutar el servidor de desarrollo

Inicie la aplicación localmente:

```bash
ng serve -o
```

La aplicación compilará y abrirá automáticamente la interfaz en:

```text
http://localhost:4200/
```

---

## 📂 Estructura del Proyecto

```text
visualizador/
├── frontend/                               # Aplicación cliente en Angular
│   ├── public/
│   │   └── data/
│   │       └── malla_vial_wgs84.geojson    # Malla vial procesada en WGS84
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── map-view/               # Componente del mapa interactivo
│   │   │   │   └── sidebar-filters/        # Panel de control y filtros
│   │   │   ├── app.config.ts               # Configuración de proveedores HTTP
│   │   │   ├── app.html                    # Layout principal
│   │   │   └── app.ts                      # Componente raíz
│   │   ├── styles.scss                     # Estilos globales y Leaflet CSS
│   │   └── main.ts                         # Punto de entrada
│   ├── package.json
│   └── tsconfig.json
├── backend/                                # Estructura base para servicios API REST
├── scripts/                                # Scripts utilitarios de datos
│   └── convertir_malla.py                  # Pipeline de transformación EsriJSON a WGS84
├── .gitignore
└── README.md
```

---

## 🗺️ Transformación de Capas Geoespaciales

Las capas viales originales del **Plan de Ordenamiento Territorial (POT Bogotá D.C. - Decreto 555 de 2021)** se distribuyen en el sistema plano oficial de la ciudad (**MAGNA-SIRGAS / PCS_CarMAGBOG**).

Para reproyectar y optimizar los datos al estándar web (**WGS84 / EPSG:4326**), ejecute:

```bash
cd scripts
pip install pyproj
python convertir_malla.py
```

El script genera el archivo:

```text
frontend/public/data/malla_vial_wgs84.geojson
```

El proceso optimiza la precisión decimal de las coordenadas para reducir el tamaño del archivo y mejorar los tiempos de carga en el navegador.

---

## 📊 Datos Geoespaciales

El visualizador utiliza información geoespacial correspondiente a la malla vial de Bogotá D.C. Los datos son transformados desde su sistema de coordenadas original al estándar **WGS84 (EPSG:4326)**, permitiendo su correcta representación sobre mapas web mediante Leaflet y OpenStreetMap.

### Sistema de Coordenadas

| Característica     | Valor                        |
| ------------------ | ---------------------------- |
| Sistema original   | MAGNA-SIRGAS / PCS_CarMAGBOG |
| Sistema de destino | WGS84                        |
| Código EPSG        | EPSG:4326                    |
| Formato            | GeoJSON                      |
| Visualización      | Leaflet.js                   |
| Cartografía base   | OpenStreetMap                |

---

## 🧩 Arquitectura

El proyecto se encuentra organizado siguiendo una separación por responsabilidades:

### Frontend

El frontend está desarrollado utilizando **Angular** mediante componentes independientes (Standalone Components).

Sus principales responsabilidades son:

* Renderizar la interfaz de usuario.
* Mostrar la información geoespacial.
* Interactuar con el mapa.
* Aplicar filtros a la información visualizada.
* Consumir los servicios proporcionados por el backend.

### Backend

El directorio `backend/` está destinado a contener los servicios API REST encargados de proporcionar información al frontend y servir como punto de integración con los modelos de Machine Learning.

### Scripts

El directorio `scripts/` contiene herramientas destinadas al procesamiento y transformación de datos antes de ser utilizados por la aplicación web.

---

## 🗺️ Visualización del Mapa

La visualización cartográfica se realiza mediante **Leaflet.js**, utilizando **OpenStreetMap** como proveedor de cartografía base.

El componente `map-view` se encarga de:

* Inicializar el mapa.
* Configurar la ubicación inicial de Bogotá D.C.
* Cargar las capas GeoJSON.
* Renderizar la malla vial.
* Gestionar la interacción del usuario con el mapa.

El componente `sidebar-filters` permite controlar los filtros disponibles para la visualización de la información.

---

## 🔄 Flujo General de Datos

El flujo de procesamiento de la información geoespacial es el siguiente:

```text
Datos geoespaciales originales
            │
            ▼
    Sistema MAGNA-SIRGAS
            │
            ▼
   convertir_malla.py
            │
            ▼
      PyProj / Reproyección
            │
            ▼
      WGS84 / EPSG:4326
            │
            ▼
        GeoJSON
            │
            ▼
frontend/public/data/
            │
            ▼
      Angular + Leaflet
            │
            ▼
       Mapa interactivo
```

---

## 🧪 Desarrollo

Para ejecutar el proyecto durante el desarrollo:

```bash
cd frontend
ng serve
```

Posteriormente, acceda desde el navegador a:

```text
http://localhost:4200/
```

Para generar una compilación de producción:

```bash
ng build
```

Los archivos generados estarán disponibles dentro del directorio de salida configurado por Angular.

---

## 📦 Dependencias

Las dependencias del frontend se encuentran definidas en:

```text
frontend/package.json
```

Para instalarlas:

```bash
cd frontend
npm install
```

Para agregar Leaflet al proyecto, en caso de ser necesario:

```bash
npm install leaflet
```

Y para disponer de sus tipos de TypeScript:

```bash
npm install --save-dev @types/leaflet
```

---

## 🐍 Scripts de Procesamiento

El proyecto incluye scripts desarrollados en Python para realizar tareas relacionadas con el procesamiento de datos geoespaciales.

### `convertir_malla.py`

Este script realiza principalmente las siguientes operaciones:

1. Lectura de los datos geoespaciales originales.
2. Transformación de las coordenadas desde el sistema MAGNA-SIRGAS / PCS_CarMAGBOG.
3. Reproyección hacia WGS84 (EPSG:4326).
4. Optimización de la precisión de las coordenadas.
5. Generación del archivo GeoJSON.
6. Almacenamiento del resultado en `frontend/public/data/`.

Para ejecutar el script:

```bash
cd scripts
python convertir_malla.py
```

La dependencia requerida es:

```bash
pip install pyproj
```

---

## 🌐 Fuentes de Datos

### OpenStreetMap

La cartografía base utilizada para la visualización del mapa proviene de **OpenStreetMap**.

* Sitio web: https://www.openstreetmap.org/
* Licencia: Open Data Commons Open Database License (ODbL).

### Datos geoespaciales de Bogotá D.C.

Las capas utilizadas para representar la malla vial corresponden a información geográfica relacionada con Bogotá D.C. y el **Plan de Ordenamiento Territorial (POT), Decreto 555 de 2021**.

---

## ⚠️ Consideraciones

* El archivo GeoJSON de la malla vial puede tener un tamaño considerable debido a la cantidad de geometrías que contiene.
* La precisión de las coordenadas ha sido reducida para disminuir el tamaño del archivo sin afectar significativamente la representación visual.
* El rendimiento del mapa dependerá de la cantidad de elementos geoespaciales que se carguen simultáneamente.
* Para conjuntos de datos de gran tamaño se recomienda evaluar técnicas como simplificación geométrica, carga por sectores o procesamiento mediante servicios geoespaciales.
* OpenStreetMap debe utilizarse respetando sus políticas de uso y atribución.

---

## 🔮 Próximas Funcionalidades

Entre las funcionalidades previstas para futuras versiones se encuentran:

* Integración con el backend mediante API REST.
* Integración del modelo de Machine Learning para estimación de riesgo.
* Visualización de zonas con diferentes niveles de riesgo.
* Filtros por localidad.
* Filtros por fecha y hora.
* Filtros por tipo de accidente.
* Visualización de puntos de accidentalidad.
* Clasificación de zonas según probabilidad de accidente.
* Integración de información histórica de accidentalidad.
* Implementación de mapas de calor.
* Optimización del rendimiento para grandes volúmenes de información.

---

## 👥 Proyecto de Grado

Este proyecto forma parte de un proyecto de grado orientado al desarrollo de una solución para la **estimación y visualización del riesgo de accidentalidad vial en Bogotá D.C. mediante técnicas de Machine Learning y análisis geoespacial**.

El visualizador constituye el componente encargado de presentar espacialmente los resultados obtenidos por los modelos de análisis y facilitar su interpretación mediante una interfaz web interactiva.

---

## 📄 Licencia

Este proyecto ha sido desarrollado con fines académicos como parte de un proyecto de grado.

La utilización de datos provenientes de terceros deberá respetar las licencias y condiciones de uso correspondientes a cada fuente.

---

## 📌 Estado del Proyecto

**Estado:** En desarrollo.

Las funcionalidades de visualización geoespacial se encuentran en proceso de implementación y posteriormente serán integradas con los servicios backend y los modelos de Machine Learning.
