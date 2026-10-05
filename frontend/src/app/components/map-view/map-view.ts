import { Component, OnInit, OnDestroy, signal, inject, effect } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as L from 'leaflet';
import { MapStateService } from '../../services/map-state.service';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './map-view.html',
  styleUrl: './map-view.scss'
})
export class MapViewComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  public readonly mapState = inject(MapStateService);

  private map!: L.Map;
  private roadLayer: L.GeoJSON | null = null;
  private layerControl!: L.Control.Layers;
  private currentGeoJsonData: GeoJSON.FeatureCollection | null = null;

  public errorMessage = signal<string | null>(null);

  private readonly BOGOTA_CENTER: L.LatLngExpression = [4.6533, -74.0836];
  private readonly DEFAULT_ZOOM: number = 12;

  private readonly ROAD_TYPE_NAMES: Record<string, string> = {
    primary: 'Vía Arterial Principal',
    secondary: 'Vía Arterial Secundaria',
    tertiary: 'Vía Colectora',
    residential: 'Vía Residencial',
    trunk: 'Troncal / Autopista',
    living_street: 'Vía Peatonal / Residencial',
    service: 'Vía de Servicio'
  };

  constructor() {
    effect(() => {
      const locKey = this.mapState.selectedLocality();
      if (this.map) {
        if (locKey === 'none') {
          this.clearCurrentRoads();
          this.map.flyTo(this.BOGOTA_CENTER, this.DEFAULT_ZOOM, {
            duration: 1.2,
            easeLinearity: 0.25
          });
        } else if (locKey === 'all_city') {
          this.loadAllCityRoads();
        } else {
          this.loadLocalityRoads(locKey);
        }
      }
    });

    effect(() => {
      this.mapState.selectedRoadTypes();
      this.mapState.isolateSearchedRoad();
      const query = this.mapState.activeSearchQuery();
      if (this.currentGeoJsonData) {
        this.renderRoadNetwork(this.currentGeoJsonData, false);
        if (query.length > 0) {
          this.zoomToSearchedRoads(query);
        }
      }
    });
  }

  ngOnInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initializeMap(): void {
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19
    });

    const lightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19
    });

    this.map = L.map('map-container', {
      center: this.BOGOTA_CENTER,
      zoom: this.DEFAULT_ZOOM,
      minZoom: 10,
      maxZoom: 18,
      preferCanvas: true,
      zoomControl: false,
      layers: [osmLayer]
    });

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    const baseMaps = {
      'OpenStreetMap': osmLayer,
      'CartoDB Dark': darkLayer,
      'CartoDB Positron': lightLayer,
      'Satélite (Esri)': satelliteLayer
    };

    this.layerControl = L.control.layers(baseMaps, undefined, { position: 'topright' });
    this.layerControl.addTo(this.map);

    this.map.on('zoomend', () => {
      this.updateLayerStyles();
      this.mapState.currentZoom.set(this.map.getZoom());
    });
  }

  private clearCurrentRoads(): void {
    if (this.roadLayer) {
      this.map.removeLayer(this.roadLayer);
      this.layerControl.removeLayer(this.roadLayer);
      this.roadLayer = null;
    }
    this.currentGeoJsonData = null;
    this.mapState.roadCount.set(0);
    this.errorMessage.set(null);
  }

  private loadLocalityRoads(localityKey: string): void {
    this.mapState.isLocalityLoading.set(true);
    this.mapState.loadingProgressText.set('Cargando localidad...');
    this.errorMessage.set(null);

    const filePath = `data/localidades/${localityKey}.geojson`;

    this.http.get<GeoJSON.FeatureCollection>(filePath).subscribe({
      next: (data) => {
        this.clearCurrentRoads();
        this.currentGeoJsonData = data;
        this.renderRoadNetwork(data, true);
        this.mapState.isLocalityLoading.set(false);
      },
      error: () => {
        this.clearCurrentRoads();
        this.errorMessage.set(`No se encontró el archivo de vías para ${localityKey}.`);
        this.mapState.isLocalityLoading.set(false);
      }
    });
  }

  private async loadAllCityRoads(): Promise<void> {
    this.clearCurrentRoads();
    this.mapState.isLocalityLoading.set(true);
    this.errorMessage.set(null);

    const localityKeys = Object.keys(this.mapState.localities);
    const total = localityKeys.length;
    const aggregatedFeatures: GeoJSON.Feature[] = [];

    for (let i = 0; i < total; i++) {
      const locKey = localityKeys[i];
      this.mapState.loadingProgressText.set(`Cargando ${locKey} (${i + 1}/${total})...`);

      try {
        const data = await firstValueFrom(
          this.http.get<GeoJSON.FeatureCollection>(`data/localidades/${locKey}.geojson`)
        );
        if (data && data.features) {
          aggregatedFeatures.push(...data.features);
        }
      } catch {
      }
    }

    if (aggregatedFeatures.length > 0) {
      const consolidated: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: aggregatedFeatures
      };
      this.currentGeoJsonData = consolidated;
      this.renderRoadNetwork(consolidated, true);
    } else {
      this.errorMessage.set('No se encontraron archivos de localidades para componer Bogotá.');
    }

    this.mapState.isLocalityLoading.set(false);
  }

  private zoomToSearchedRoads(query: string): void {
    if (!this.roadLayer) return;

    const bounds = L.latLngBounds([]);
    let matchCount = 0;

    this.roadLayer.eachLayer((layer: any) => {
      const feature = layer.feature;
      const props = feature?.properties || {};
      const nom = (props['nom'] || '').toString().toLowerCase();

      if (nom.includes(query)) {
        matchCount++;
        if (layer.getBounds) {
          bounds.extend(layer.getBounds());
        }
        if (layer.bringToFront) {
          layer.bringToFront();
        }
      }
    });

    if (matchCount > 0 && bounds.isValid()) {
      this.map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 16
      });
    }
  }

  private renderRoadNetwork(data: GeoJSON.FeatureCollection, autoFitBounds: boolean): void {
    if (this.roadLayer) {
      this.map.removeLayer(this.roadLayer);
      this.layerControl.removeLayer(this.roadLayer);
      this.roadLayer = null;
    }

    const currentZoom = this.map.getZoom();
    const visibleTypes = this.mapState.selectedRoadTypes();
    const query = this.mapState.activeSearchQuery();
    const isolate = this.mapState.isolateSearchedRoad();

    const filteredFeatures = data.features.filter((feature) => {
      const props = feature.properties || {};
      const tipo = (props['tipo'] || 'residential').toString().toLowerCase();

      let isTypeAllowed = false;
      if (tipo === 'primary' || tipo === 'trunk') {
        isTypeAllowed = !!visibleTypes['primary'];
      } else if (tipo === 'secondary') {
        isTypeAllowed = !!visibleTypes['secondary'];
      } else if (tipo === 'tertiary') {
        isTypeAllowed = !!visibleTypes['tertiary'];
      } else {
        isTypeAllowed = !!visibleTypes['residential'];
      }

      if (!isTypeAllowed) return false;

      if (query.length > 0 && isolate) {
        const nom = (props['nom'] || '').toString().toLowerCase();
        return nom.includes(query);
      }

      return true;
    });

    const filteredCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: filteredFeatures
    };

    this.roadLayer = L.geoJSON(filteredCollection, {
      style: (feature) => this.getRoadStyle(feature, currentZoom),
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const tipoCode = (props['tipo'] || '').toString().trim().toLowerCase();
        const tipoNombre = this.ROAD_TYPE_NAMES[tipoCode] || 'Vía Urbana';
        const tieneNombre = props['nom'] && props['nom'].toString().trim().length > 0;
        const nombreDisplay = tieneNombre ? props['nom'].toString().trim() : `${tipoNombre} (ID: ${props['id'] || 'S/N'})`;

        layer.bindTooltip(`${nombreDisplay}`, {
          sticky: true,
          direction: 'top',
          className: 'road-hover-tooltip'
        });

        layer.bindPopup(`
          <div class="road-popup-card">
            <h4>${nombreDisplay}</h4>
            <div class="road-popup-row">
              <span class="road-popup-label">Jerarquía:</span>
              <span class="road-popup-val">${tipoNombre}</span>
            </div>
            <div class="road-popup-row">
              <span class="road-popup-label">Identificador OSM:</span>
              <span class="road-popup-val">${props['id'] || 'N/A'}</span>
            </div>
          </div>
        `);

        layer.on({
          mouseover: (e) => {
            const target = e.target;
            const activeWeight = Math.max(4.5, this.calculateWeight(this.map.getZoom()) + 2.5);
            target.setStyle({
              color: '#00FFFF',
              weight: activeWeight,
              opacity: 1
            });
          },
          mouseout: (e) => {
            const target = e.target;
            target.setStyle(this.getRoadStyle(feature, this.map.getZoom()));
          }
        });
      }
    });

    this.roadLayer.addTo(this.map);
    this.layerControl.addOverlay(this.roadLayer, 'Malla Vial');

    if (autoFitBounds) {
      const bounds = this.roadLayer.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, {
          padding: [25, 25],
          maxZoom: 15
        });
      }
    }

    this.mapState.roadCount.set(filteredFeatures.length);
  }

  private calculateWeight(zoomLevel: number): number {
    if (zoomLevel >= 16) return 3.8;
    if (zoomLevel >= 14) return 2.6;
    if (zoomLevel >= 13) return 1.8;
    return 1.1;
  }

  private getRoadStyle(feature: any, zoomLevel: number): L.PathOptions {
    const query = this.mapState.activeSearchQuery();
    const hasSearch = query.length > 0;
    const props = feature?.properties || {};
    const nom = (props['nom'] || '').toString().toLowerCase();
    const isMatched = hasSearch && nom.includes(query);

    if (isMatched) {
      return {
        color: '#A855F7',
        weight: this.calculateWeight(zoomLevel) + 2.8,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
      };
    }

    return {
      color: '#0055FF',
      weight: this.calculateWeight(zoomLevel),
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    };
  }

  private updateLayerStyles(): void {
    if (this.roadLayer) {
      const zoomLevel = this.map.getZoom();
      this.roadLayer.setStyle((feature) => this.getRoadStyle(feature, zoomLevel));
    }
  }
}