import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-view.html',
  styleUrl: './map-view.scss'
})
export class MapViewComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);

  /** Instancia del mapa Leaflet */
  private map!: L.Map;

  /** Capa vectorial que aloja la malla vial */
  private roadLayer!: L.GeoJSON;

  /** Estado reactivo del indicador de carga */
  public isLoading = signal<boolean>(true);

  /** Mensaje de error en caso de fallo de red o lectura */
  public errorMessage = signal<string | null>(null);

  /** Coordenadas centrales de Bogotá D.C. */
  private readonly BOGOTA_CENTER: L.LatLngExpression = [4.6533, -74.0836];

  /** Nivel de zoom predeterminado */
  private readonly DEFAULT_ZOOM: number = 12;

  /** 
   * Ruta del archivo GeoJSON. 
   * Ajustar a 'data/malla_vial_wgs84.geojson' si se usa la carpeta public/
   * o a 'assets/data/malla_vial_wgs84.geojson' si se usa src/assets/
   */
  private readonly DATA_PATH: string = 'data/malla_vial_wgs84.geojson';

  ngOnInit(): void {
    this.initializeMap();
    this.loadRoadNetwork();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  /**
   * Inicializa el contenedor del mapa y las teselas base de OpenStreetMap
   */
  private initializeMap(): void {
    this.map = L.map('map-container', {
      center: this.BOGOTA_CENTER,
      zoom: this.DEFAULT_ZOOM,
      minZoom: 10,
      maxZoom: 18,
      preferCanvas: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    this.map.on('zoomend', () => {
      this.updateLayerStyles();
    });
  }

  /**
   * Petición asíncrona para obtener y procesar el archivo GeoJSON
   */
  private loadRoadNetwork(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http.get<GeoJSON.FeatureCollection>(this.DATA_PATH).subscribe({
      next: (geojsonData) => {
        this.renderRoadNetwork(geojsonData);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error durante la carga de la malla vial:', err);
        this.errorMessage.set(`No se pudo cargar el archivo GeoJSON desde: ${this.DATA_PATH}`);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Renderizado de la colección de vectores en Leaflet
   */
  private renderRoadNetwork(data: GeoJSON.FeatureCollection): void {
    const currentZoom = this.map.getZoom();

    this.roadLayer = L.geoJSON(data, {
      style: () => this.getRoadStyle(currentZoom),
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const nombre = props.nom && props.nom.trim().length > 0 ? props.nom : 'Vía Sin Asignar';
        const tipo = props.tipo || 'Intermedia';

        layer.bindPopup(`
          <div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4;">
            <strong style="color: #2b6cb0;">${nombre}</strong><br/>
            <strong>Tipo:</strong> ${tipo}<br/>
            <strong>ID:</strong> ${props.id || 'N/A'}
          </div>
        `);
      }
    });

    this.roadLayer.addTo(this.map);
  }

  /**
   * Cálculo dinámico del estilo de línea según el nivel de zoom
   */
  private getRoadStyle(zoomLevel: number): L.PathOptions {
    let weight = 1.2;
    if (zoomLevel >= 15) {
      weight = 3.0;
    } else if (zoomLevel >= 13) {
      weight = 1.8;
    }

    return {
      color: '#0055FF',
      weight: weight,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    };
  }

  /**
   * Actualización de estilos tras eventos de zoom
   */
  private updateLayerStyles(): void {
    if (this.roadLayer) {
      const zoomLevel = this.map.getZoom();
      this.roadLayer.setStyle(() => this.getRoadStyle(zoomLevel));
    }
  }
}