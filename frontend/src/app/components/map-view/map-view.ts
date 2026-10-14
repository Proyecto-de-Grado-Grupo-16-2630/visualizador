import { Component, OnInit, OnDestroy, signal, inject, effect } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import * as L from 'leaflet';
import { MapStateService } from '../../services/map-state.service';

declare var initSqlJs: any;

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './map-view.html',
  styleUrl: './map-view.scss'
})
export class MapViewComponent implements OnInit, OnDestroy {
  public readonly mapState = inject(MapStateService);

  private map!: L.Map;
  private roadLayer: L.GeoJSON | null = null;
  private accidentLayer: L.LayerGroup | null = null;
  private layerControl!: L.Control.Layers;
  private currentGeoJsonData: GeoJSON.FeatureCollection | null = null;

  // Instancia en memoria de accidentes_bogota_spatialite.db
  private db: any = null;
  private dbReady = signal<boolean>(false);

  public errorMessage = signal<string | null>(null);

  private readonly BOGOTA_CENTER: L.LatLngExpression = [4.6533, -74.0836];
  private readonly DEFAULT_ZOOM: number = 12;
  private readonly DB_PATH = 'data/accidentes_bogota_spatialite.db';

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
    // 1. Efecto para consultar calles_bogota cuando cambia la localidad
    effect(() => {
      const isReady = this.dbReady();
      const locKey = this.mapState.selectedLocality();

      if (this.map && isReady) {
        if (locKey === 'none') {
          this.clearCurrentRoads();
          this.map.flyTo(this.BOGOTA_CENTER, this.DEFAULT_ZOOM, {
            duration: 1.2,
            easeLinearity: 0.25
          });
        } else if (locKey === 'all_city') {
          this.queryRoadsFromDb(null);
        } else {
          this.queryRoadsFromDb(locKey);
        }
      }
    });

    // 2. Efecto para filtrar jerarquía vial o buscar calle por nombre
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

    // 3. Efecto para consultar puntos_accidentes desde la DB
    effect(() => {
      const isReady = this.dbReady();
      const showAcc = this.mapState.showAccidentPoints();
      const locKey = this.mapState.selectedLocality();

      if (this.map && isReady) {
        if (showAcc) {
          this.queryAccidentsFromDb(locKey);
        } else {
          this.clearAccidentLayer();
        }
      }
    });
  }

  ngOnInit(): void {
    this.initializeMap();
    this.initSpatialiteDatabase();
  }

  ngOnDestroy(): void {
    if (this.db) {
      this.db.close();
    }
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

  /**
   * Carga accidentes_bogota_spatialite.db en memoria usando SQL.js
   */
  private async initSpatialiteDatabase(): Promise<void> {
    this.mapState.isLocalityLoading.set(true);
    this.mapState.loadingProgressText.set('Abriendo accidentes_bogota_spatialite.db...');
    this.errorMessage.set(null);

    try {
      const SQL = await initSqlJs({
        locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
      });

      const response = await fetch(this.DB_PATH);
      if (!response.ok) {
        throw new Error(`No se encontró ${this.DB_PATH}`);
      }

      const buffer = await response.arrayBuffer();
      this.db = new SQL.Database(new Uint8Array(buffer));
      this.dbReady.set(true);
      this.mapState.isLocalityLoading.set(false);
    } catch (err) {
      console.error('Error al cargar la base de datos SpatiaLite:', err);
      this.errorMessage.set(
        'No se pudo abrir data/accidentes_bogota_spatialite.db. Verifica haber copiado el archivo .db a frontend/public/data/.'
      );
      this.mapState.isLocalityLoading.set(false);
    }
  }

  /**
   * Consulta la tabla calles_bogota (geometría LINESTRING) directamente en la DB
   */
  private queryRoadsFromDb(localityKey: string | null): void {
    if (!this.db) return;

    this.mapState.isLocalityLoading.set(true);
    this.mapState.loadingProgressText.set(
      localityKey ? `Consultando calles_bogota (${localityKey})...` : 'Consultando toda la tabla calles_bogota...'
    );
    this.errorMessage.set(null);

    setTimeout(() => {
      try {
        let stmt;
        if (localityKey) {
          stmt = this.db.prepare(
            'SELECT id, nom, tipo, localidad, geom FROM calles_bogota WHERE localidad = :loc;'
          );
          stmt.bind({ ':loc': localityKey });
        } else {
          stmt = this.db.prepare('SELECT id, nom, tipo, localidad, geom FROM calles_bogota;');
        }

        const features: GeoJSON.Feature[] = [];

        while (stmt.step()) {
          const row = stmt.getAsObject();
          const wkt = (row['geom'] || '').toString();
          const coords = this.parseWktLineString(wkt);

          if (coords.length >= 2) {
            features.push({
              type: 'Feature',
              properties: {
                id: row['id'],
                nom: row['nom'] === 'NULL' ? '' : row['nom'],
                tipo: row['tipo'],
                localidad: row['localidad']
              },
              geometry: {
                type: 'LineString',
                coordinates: coords
              }
            });
          }
        }
        stmt.free();

        this.clearCurrentRoads();
        const collection: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features
        };
        this.currentGeoJsonData = collection;
        this.renderRoadNetwork(collection, true);
      } catch (err) {
        console.error('Error en SELECT sobre calles_bogota:', err);
        this.errorMessage.set('Error al consultar la tabla calles_bogota en la base de datos.');
      } finally {
        this.mapState.isLocalityLoading.set(false);
      }
    }, 20);
  }

  /**
   * Consulta la tabla puntos_accidentes (geometría POINT) directamente en la DB
   */
  private queryAccidentsFromDb(localityKey: string): void {
    if (!this.db) return;

    try {
      this.clearAccidentLayer();
      this.accidentLayer = L.layerGroup();

      const targetLoc = this.mapState.targetLocation();
      const locCode = targetLoc ? targetLoc.code : null;

      let stmt;
      if (localityKey !== 'none' && localityKey !== 'all_city' && locCode) {
        stmt = this.db.prepare(`
          SELECT id_local, CODIGO_ACCIDENTE, FECHA, HORA, GRAVEDAD, GRAVEDAD_DESC,
                 CLASE_DESC, CHOQUE_DESC, DIRECCION, DIRECCION_COMPLETA, CODIGO_LOCALIDAD, geom
          FROM puntos_accidentes
          WHERE CODIGO_LOCALIDAD = :code;
        `);
        stmt.bind({ ':code': locCode });
      } else {
        stmt = this.db.prepare(`
          SELECT id_local, CODIGO_ACCIDENTE, FECHA, HORA, GRAVEDAD, GRAVEDAD_DESC,
                 CLASE_DESC, CHOQUE_DESC, DIRECCION, DIRECCION_COMPLETA, CODIGO_LOCALIDAD, geom
          FROM puntos_accidentes;
        `);
      }

      let count = 0;

      while (stmt.step()) {
        const row = stmt.getAsObject();
        const wkt = (row['geom'] || '').toString();
        const pt = this.parseWktPoint(wkt);

        if (!pt) continue;

        const [lat, lon] = pt;
        const codigo = row['CODIGO_ACCIDENTE'] || row['id_local'];
        const gravedadCode = (row['GRAVEDAD'] || '3').toString().trim();
        const gravedadDesc = row['GRAVEDAD_DESC'] || 'Solo daños';
        const claseDesc = row['CLASE_DESC'] || 'Vehículo';
        const direccion = row['DIRECCION_COMPLETA'] || row['DIRECCION'] || 'Sin dirección';
        const fecha = row['FECHA'] || 'N/A';
        const hora = row['HORA'] || '';

        // Color según gravedad del accidente
        let fillColor = '#F59E0B'; // 3: Solo daños (Naranja)
        let borderColor = '#B45309';
        if (gravedadCode === '1') {
          fillColor = '#991B1B'; // 1: Con muertos (Rojo oscuro)
          borderColor = '#450A0A';
        } else if (gravedadCode === '2') {
          fillColor = '#EF4444'; // 2: Con heridos (Rojo vivo)
          borderColor = '#991B1B';
        }

        const marker = L.circleMarker([lat, lon], {
          radius: 4.5,
          fillColor,
          color: borderColor,
          weight: 1.2,
          opacity: 0.95,
          fillOpacity: 0.85
        });

        marker.bindTooltip(`<b>Accidente #${codigo}</b> (${gravedadDesc})<br>${direccion}`, {
          direction: 'top',
          className: 'road-hover-tooltip'
        });

        marker.bindPopup(`
          <div class="road-popup-card">
            <h4 style="color: #DC2626;">Siniestro #${codigo}</h4>
            <div class="road-popup-row">
              <span class="road-popup-label">Gravedad:</span>
              <span class="road-popup-val">${gravedadDesc}</span>
            </div>
            <div class="road-popup-row">
              <span class="road-popup-label">Clase:</span>
              <span class="road-popup-val">${claseDesc}</span>
            </div>
            <div class="road-popup-row">
              <span class="road-popup-label">Fecha / Hora:</span>
              <span class="road-popup-val">${fecha} ${hora}</span>
            </div>
            <div class="road-popup-row">
              <span class="road-popup-label">Dirección:</span>
              <span class="road-popup-val">${direccion}</span>
            </div>
            <div class="road-popup-row">
              <span class="road-popup-label">WKT DB:</span>
              <span class="road-popup-val">${wkt}</span>
            </div>
          </div>
        `);

        this.accidentLayer.addLayer(marker);
        count++;
      }
      stmt.free();

      this.accidentLayer.addTo(this.map);
      this.layerControl.addOverlay(this.accidentLayer, 'Puntos de Accidentes (DB)');
      this.mapState.accidentCount.set(count);
    } catch (err) {
      console.error('Error en SELECT sobre puntos_accidentes:', err);
    }
  }

  /**
   * Convierte 'LINESTRING(lon1 lat1, lon2 lat2, ...)' a arreglo [[lon1, lat1], [lon2, lat2]]
   */
  private parseWktLineString(wkt: string): [number, number][] {
    const startIdx = wkt.indexOf('(');
    const endIdx = wkt.lastIndexOf(')');
    if (startIdx === -1 || endIdx === -1) return [];

    const content = wkt.substring(startIdx + 1, endIdx);
    const pairs = content.split(',');
    const coords: [number, number][] = [];

    for (const pair of pairs) {
      const parts = pair.trim().split(/\s+/);
      if (parts.length >= 2) {
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lon) && !isNaN(lat)) {
          coords.push([lon, lat]);
        }
      }
    }
    return coords;
  }

  /**
   * Convierte 'POINT(lon lat)' a tupla [lat, lon] para Leaflet
   */
  private parseWktPoint(wkt: string): [number, number] | null {
    const startIdx = wkt.indexOf('(');
    const endIdx = wkt.lastIndexOf(')');
    if (startIdx === -1 || endIdx === -1) return null;

    const content = wkt.substring(startIdx + 1, endIdx).trim();
    const parts = content.split(/\s+/);
    if (parts.length >= 2) {
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lon) && !isNaN(lat)) {
        return [lat, lon];
      }
    }
    return null;
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
              <span class="road-popup-label">Localidad (DB):</span>
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
    this.layerControl.addOverlay(this.roadLayer, 'Malla Vial (DB)');

    // Asegurar que los puntos de accidentes queden por encima de las líneas viales
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