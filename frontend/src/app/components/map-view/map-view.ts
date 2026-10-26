import { Component, OnInit, OnDestroy, signal, inject, effect } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import * as L from 'leaflet';
import { MapStateService } from '../../services/map-state.service';
import { MapaApiService } from '../../services/mapa-api.service';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './map-view.html',
  styleUrl: './map-view.scss'
})
export class MapViewComponent implements OnInit, OnDestroy {
  public readonly mapState = inject(MapStateService);
  private readonly mapaApi = inject(MapaApiService);

  private map!: L.Map;
  private roadLayer: L.GeoJSON | null = null;
  private accidentLayer: L.LayerGroup | null = null;
  private layerControl!: L.Control.Layers;
  private currentGeoJsonData: GeoJSON.FeatureCollection | null = null;

  public errorMessage = signal<string | null>(null);
  public isLegendCollapsed = signal<boolean>(false);

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
        } else {
          this.fetchRoadsFromBackend(locKey);
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

    effect(() => {
      const showAcc = this.mapState.showAccidentPoints();
      const locKey = this.mapState.selectedLocality();
      const year = this.mapState.selectedYear();

      if (this.map) {
        if (showAcc) {
          this.fetchAccidentsFromBackend(locKey, year);
        } else {
          this.clearAccidentLayer();
        }
      }
    });
  }

  ngOnInit(): void {
    this.initializeMap();
    this.fetchAccidentsFromBackend('none', 'all');
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  public toggleLegend(): void {
    this.isLegendCollapsed.set(!this.isLegendCollapsed());
  }

  /**
   * Inicializa el lienzo de Leaflet con la atribucion cartografica oficial de OpenStreetMap.
   */
  private initializeMap(): void {
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19
    });

    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      maxZoom: 19
    });

    const lightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      maxZoom: 19
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
      maxZoom: 19
    });

    this.map = L.map('map-container', {
      center: this.BOGOTA_CENTER,
      zoom: this.DEFAULT_ZOOM,
      minZoom: 10,
      maxZoom: 18,
      preferCanvas: true,
      zoomControl: false,
      attributionControl: true,
      layers: [osmLayer]
    });

    this.map.attributionControl.setPrefix('Leaflet | Datos Abiertos Bogotá');
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

  private fetchRoadsFromBackend(localityKey: string): void {
    this.mapState.isLocalityLoading.set(true);
    this.mapState.loadingProgressText.set(
      localityKey === 'all_city' ? 'Consultando malla vial completa en Backend...' : `Cargando malla vial (${localityKey})...`
    );
    this.errorMessage.set(null);

    this.mapaApi.getCalles(localityKey).subscribe({
      next: (collection) => {
        this.clearCurrentRoads();
        this.currentGeoJsonData = collection;
        this.renderRoadNetwork(collection, true);
        this.mapState.isLocalityLoading.set(false);
      },
      error: (err) => {
        console.error('Error al consultar /api/mapa/calles:', err);
        this.errorMessage.set('Error al conectar con el Backend en http://localhost:8080/api/mapa/calles');
        this.mapState.isLocalityLoading.set(false);
      }
    });
  }

  private fetchAccidentsFromBackend(localityKey: string, year: string): void {
    const targetLoc = this.mapState.targetLocation();
    const locCode = (localityKey !== 'none' && localityKey !== 'all_city' && targetLoc) ? targetLoc.code : 'all';

    this.mapaApi.getAccidentes(locCode, year).subscribe({
      next: (collection) => {
        this.renderAccidents(collection);
      },
      error: (err) => {
        console.error('Error al consultar /api/mapa/accidentes:', err);
        this.errorMessage.set('No se pudo obtener la capa de accidentes desde el servidor Spring Boot.');
      }
    });
  }

  private renderAccidents(collection: GeoJSON.FeatureCollection): void {
    this.clearAccidentLayer();
    this.accidentLayer = L.layerGroup();

    const features = collection?.features || [];
    let count = 0;

    for (const feat of features) {
      const geom = feat.geometry as GeoJSON.Point;
      if (!geom || geom.type !== 'Point' || !geom.coordinates || geom.coordinates.length < 2) {
        continue;
      }

      const [lon, lat] = geom.coordinates;
      const props = feat.properties || {};
      const codigo = props['CODIGO_ACCIDENTE'] || props['id_local'];
      const gravedadCode = String(props['GRAVEDAD'] || '3').trim();
      const gravedadDesc = props['GRAVEDAD_DESC'] || 'Solo daños';
      const claseDesc = props['CLASE_DESC'] || 'Vehículo';
      const choqueDesc = props['CHOQUE_DESC'] || 'N/A';
      const direccion = props['DIRECCION_COMPLETA'] || props['DIRECCION'] || 'Sin dirección';
      const fecha = props['FECHA'] || 'N/A';
      const hora = props['HORA'] || '';

      let fillColor = '#F59E0B';
      let borderColor = '#B45309';
      if (gravedadCode === '1') {
        fillColor = '#991B1B';
        borderColor = '#450A0A';
      } else if (gravedadCode === '2') {
        fillColor = '#EF4444';
        borderColor = '#991B1B';
      }

      const marker = L.circleMarker([lat, lon], {
        radius: 4.8,
        fillColor,
        color: borderColor,
        weight: 1.3,
        opacity: 0.95,
        fillOpacity: 0.85
      });

      marker.bindTooltip(`<b>Accidente #${codigo}</b> (${gravedadDesc})<br>${direccion}`, {
        direction: 'top',
        className: 'road-hover-tooltip'
      });

      marker.bindPopup(`
        <div class="road-popup-card">
          <h4 style="color: ${fillColor};">Siniestro #${codigo}</h4>
          <div class="road-popup-row">
            <span class="road-popup-label">Gravedad:</span>
            <span class="road-popup-val">${gravedadDesc}</span>
          </div>
          <div class="road-popup-row">
            <span class="road-popup-label">Clase / Choque:</span>
            <span class="road-popup-val">${claseDesc} (${choqueDesc})</span>
          </div>
          <div class="road-popup-row">
            <span class="road-popup-label">Fecha y Hora:</span>
            <span class="road-popup-val">${fecha} ${hora}</span>
          </div>
          <div class="road-popup-row">
            <span class="road-popup-label">Dirección:</span>
            <span class="road-popup-val">${direccion}</span>
          </div>
        </div>
      `);

      this.accidentLayer.addLayer(marker);
      count++;
    }

    this.accidentLayer.addTo(this.map);
    this.layerControl.addOverlay(this.accidentLayer, 'Puntos de Accidentes');
    this.mapState.accidentCount.set(count);
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

  private clearAccidentLayer(): void {
    if (this.accidentLayer) {
      this.map.removeLayer(this.accidentLayer);
      this.layerControl.removeLayer(this.accidentLayer);
      this.accidentLayer = null;
    }
    this.mapState.accidentCount.set(0);
  }

  private zoomToSearchedRoads(query: string): void {
    if (!this.roadLayer) return;

    const bounds = L.latLngBounds([]);
    let matchCount = 0;

    this.roadLayer.eachLayer((layer: any) => {
      const feature = layer.feature;
      const props = feature?.properties || {};
      const nom = String(props['nom'] || '').toLowerCase();

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

    const filteredFeatures = (data.features || []).filter((feature) => {
      const props = feature.properties || {};
      const tipo = String(props['tipo'] || 'residential').toLowerCase();

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
        const nom = String(props['nom'] || '').toLowerCase();
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
        const tipoCode = String(props['tipo'] || '').trim().toLowerCase();
        const tipoNombre = this.ROAD_TYPE_NAMES[tipoCode] || 'Vía Urbana';
        const tieneNombre = props['nom'] && String(props['nom']).trim().length > 0;
        const nombreDisplay = tieneNombre ? String(props['nom']).trim() : `${tipoNombre} (ID: ${props['id'] || 'S/N'})`;

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
              <span class="road-popup-label">Localidad:</span>
              <span class="road-popup-val">${props['localidad'] || 'N/A'}</span>
            </div>
            <div class="road-popup-row">
              <span class="road-popup-label">ID OSM:</span>
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

    if (this.accidentLayer && this.map.hasLayer(this.accidentLayer)) {
      this.accidentLayer.eachLayer((l: any) => {
        if (l.bringToFront) l.bringToFront();
      });
    }

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

  /**
   * Asigna color y grosor segun la jerarquia vial para corresponder con la leyenda del mapa.
   */
  private getRoadStyle(feature: any, zoomLevel: number): L.PathOptions {
    const query = this.mapState.activeSearchQuery();
    const hasSearch = query.length > 0;
    const props = feature?.properties || {};
    const nom = String(props['nom'] || '').toLowerCase();
    const tipo = String(props['tipo'] || 'residential').toLowerCase();
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

    let roadColor = '#60A5FA';
    let weightBonus = 0;

    if (tipo === 'primary' || tipo === 'trunk') {
      roadColor = '#1D4ED8';
      weightBonus = 1.0;
    } else if (tipo === 'secondary') {
      roadColor = '#0284C7';
      weightBonus = 0.5;
    } else if (tipo === 'tertiary') {
      roadColor = '#38BDF8';
      weightBonus = 0.2;
    }

    return {
      color: roadColor,
      weight: this.calculateWeight(zoomLevel) + weightBonus,
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