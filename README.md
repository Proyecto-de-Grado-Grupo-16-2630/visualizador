# Visualizador Geoespacial de Accidentalidad Vial - Bogotá D.C.

Módulo frontend interactivo desarrollado en Angular y Leaflet sobre OpenStreetMap para la exploración, visualización y análisis de riesgo vial en Bogotá. Este componente forma parte de la arquitectura del proyecto de grado enfocado en la estimación de accidentes de tráfico mediante técnicas de Machine Learning.

---

## 🚀 Tecnologías Principales

* **Framework Frontend:** [Angular](https://angular.dev/) (Standalone Components & Signals)
* **Cartografía Web:** [Leaflet.js](https://leafletjs.com/)
* **Proveedor de Capa Base:** [OpenStreetMap (OSM)](https://www.openstreetmap.org/)
* **Preprocesamiento Geoespacial:** Python (PyProj para transformaciones de coordenadas planas a WGS84)
* **Estándar de Intercambio de Datos:** GeoJSON (RFC 7946)

---

## 📋 Requisitos Previos

Asegúrese de contar con el siguiente software instalado en su entorno de desarrollo:

1. **Node.js:** Versión 18.x o 20.x LTS ([Descargar Node.js](https://nodejs.org/))
2. **Angular CLI:** Versión 18 o superior (`npm install -g @angular/cli`)
3. **Python 3.x:** (Opcional, únicamente si se ejecutan scripts de transformación de datos)
4. **Visual Studio Code:** Recomendado con extensiones de Angular y ESLint

---

## 🛠️ Instalación y Puesta en Marcha

### 1. Clonar el repositorio
```bash
git clone [https://github.com/Proyecto-de-Grado-Grupo-16-2630/visualizador.git](https://github.com/Proyecto-de-Grado-Grupo-16-2630/visualizador.git)
cd visualizador