import { Component, OnInit, OnDestroy, signal, inject, effect } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet.heat';
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
  private heatLayer: any = null;
  private choroplethLayer: L.GeoJSON | null = null;
  private layerControl!: L.Control.Layers;
  private currentGeoJsonData: GeoJSON.FeatureCollection | null = null;

  public errorMessage = signal<string | null>(null);
  public isLegendCollapsed = signal<boolean>(false);

  private readonly BOGOTA_CENTER: L.LatLngExpression = [4.6533, -74.0836];
  private readonly DEFAULT_ZOOM: number = 12;

  constructor() {
    // 1. Consulta al Backend cuando cambia la UPZ o se prende/apaga la malla vial
    effect(() => {
      const upzCode = this.mapState.selectedUpz();
      const showRoads = this.mapState.showRoadNetwork();
      if (this.map) {
        if (showRoads) {
          this.fetchRoadsFromBackend(upzCode);
        } else {
          this.clearCurrentRoads();
        }
      }
    });

    // 2. Re-filtrar tipos de via cuando cambia jerarquia manual, zoom progresivo o busqueda
    effect(() => {
      this.mapState.selectedRoadTypes();
      this.mapState.autoFilterByZoom();
      this.mapState.isolateSearchedRoad();
      const query = this.mapState.activeSearchQuery();
      if (this.currentGeoJsonData && this.mapState.showRoadNetwork()) {
        this.renderRoadNetwork(this.currentGeoJsonData, false);
        if (query.length > 0) this.zoomToSearchedRoads(query);
      }
    });

    // 3. Actualizar transparencia/opacidad de las vias instantaneamente al mover el slider
    effect(() => {
      this.mapState.roadOpacity();
      if (this.roadLayer) {
        this.updateLayerStyles();
      }
    });

    // 4. Consulta reactiva de Accidentes / Calor / Coropletas ante cualquier cambio de Anio, Mes, Dia o UPZ
    effect(() => {
      const showAcc = this.mapState.showAccidentPoints();
      const year = this.mapState.selectedYear();
      const month = this.mapState.selectedMonth();
      const day = this.mapState.selectedDay();
      const upzCode = this.mapState.selectedUpz();
      const mode = this.mapState.visualizationMode();

      if (this.map) {
        if (!showAcc) {
          this.clearAllAccidentVisualizations();
        } else if (mode === 'choropleth') {
          this.fetchChoroplethFromBackend(year, month, day, upzCode);
        } else {
          this.fetchAccidentsFromBackend(year, month, day, upzCode, mode);
        }
      }
    });
  }

  ngOnInit(): void {
    this.initializeMap();
    this.fetchAccidentsFromBackend('all', 'all', 'all', 'all', 'points');
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

  public toggleLegend(): void {
    this.isLegendCollapsed.set(!this.isLegendCollapsed());
  }

  private initializeMap(): void {
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 });

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

    this.map.attributionControl.setPrefix('Leaflet | IDECA / OpenStreetMap');
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    this.layerControl = L.control.layers({ 'OpenStreetMap': osmLayer, 'CartoDB Dark': darkLayer }, undefined, { position: 'topright' }).addTo(this.map);

    this.map.on('zoomend', () => {
      const newZoom = this.map.getZoom();
      this.mapState.currentZoom.set(newZoom);
      if (this.currentGeoJsonData && this.mapState.showRoadNetwork()) {
        if (this.mapState.autoFilterByZoom()) {
          this.renderRoadNetwork(this.currentGeoJsonData, false);
        } else {
          this.updateLayerStyles();
        }
      }
    });
  }

  private fetchRoadsFromBackend(upzCode: string): void {
    this.mapState.isLocalityLoading.set(true);
    this.mapState.loadingProgressText.set('Cargando malla vial desde SpatiaLite...');
    this.mapaApi.getCalles(null, upzCode).subscribe({
      next: (collection) => {
        this.clearCurrentRoads();
        this.currentGeoJsonData = collection;
        this.renderRoadNetwork(collection, upzCode !== 'all');
        this.mapState.isLocalityLoading.set(false);
      },
      error: () => {
        this.mapState.isLocalityLoading.set(false);
      }
    });
  }

  private fetchAccidentsFromBackend(year: string, month: string, day: string, upzCode: string, mode: 'points' | 'heatmap'): void {
    this.mapaApi.getAccidentes(null, year, month, day, upzCode).subscribe({
      next: (collection) => {
        this.clearAllAccidentVisualizations();
        if (mode === 'heatmap') this.renderHeatmap(collection);
        else this.renderAccidents(collection);
      }
    });
  }

  private fetchChoroplethFromBackend(year: string, month: string, day: string, upzCode: string): void {
    this.mapaApi.getUpz(null, year, month, day).subscribe({
      next: (collection) => {
        this.clearAllAccidentVisualizations();
        this.renderChoroplethUpz(collection, upzCode);
      }
    });
  }

  private renderAccidents(collection: GeoJSON.FeatureCollection): void {
    this.accidentLayer = L.layerGroup();
    let count = 0;
    for (const feat of (collection?.features || [])) {
      const geom = feat.geometry as GeoJSON.Point;
      if (!geom || geom.type !== 'Point' || !geom.coordinates) continue;
      const [lon, lat] = geom.coordinates;
      const props = feat.properties || {};
      const gravedadCode = String(props['GRAVEDAD'] || '3').trim();
      let fillColor = '#F59E0B';
      let borderColor = '#B45309';
      if (gravedadCode === '1') { fillColor = '#991B1B'; borderColor = '#450A0A'; }
      else if (gravedadCode === '2') { fillColor = '#EF4444'; borderColor = '#991B1B'; }

      const marker = L.circleMarker([lat, lon], {
        radius: 4.8,
        fillColor,
        color: borderColor,
        weight: 1.3,
        opacity: 0.95,
        fillOpacity: 0.85
      });
      marker.bindPopup(
        `<b>Siniestro #${props['CODIGO_ACCIDENTE']}</b><br>` +
        `<b>Fecha:</b> ${props['FECHA']} ${props['HORA'] || ''}<br>` +
        `<b>Gravedad:</b> ${props['GRAVEDAD_DESC']}<br>` +
        `<b>UPZ:</b> ${props['NOMBRE_UPZ'] || 'N/A'}<br>` +
        `<b>Dirección:</b> ${props['DIRECCION_COMPLETA']}`
      );
      this.accidentLayer.addLayer(marker);
      count++;
    }
    this.accidentLayer.addTo(this.map);
    this.layerControl.addOverlay(this.accidentLayer, 'Puntos de Accidentes');
    this.mapState.accidentCount.set(count);
  }

  private renderHeatmap(collection: GeoJSON.FeatureCollection): void {
    const heatPoints: [number, number, number][] = [];
    for (const feat of (collection?.features || [])) {
      const geom = feat.geometry as GeoJSON.Point;
      if (!geom || geom.type !== 'Point' || !geom.coordinates) continue;
      const [lon, lat] = geom.coordinates;
      const gravedadCode = String(feat.properties?.['GRAVEDAD'] || '3').trim();
      const intensity = gravedadCode === '1' ? 1.0 : (gravedadCode === '2' ? 0.75 : 0.45);
      heatPoints.push([lat, lon, intensity]);
    }
    const heatFactory = (L as any).heatLayer;
    if (heatFactory) {
      this.heatLayer = heatFactory(heatPoints, {
        radius: 22, blur: 16, maxZoom: 16, max: 1.0,
        gradient: { 0.2: '#3B82F6', 0.45: '#10B981', 0.7: '#F59E0B', 0.9: '#EF4444', 1.0: '#7F1D1D' }
      }).addTo(this.map);
      this.layerControl.addOverlay(this.heatLayer, 'Mapa de Calor');
    }
    this.mapState.accidentCount.set(heatPoints.length);
  }

  private renderChoroplethUpz(collection: GeoJSON.FeatureCollection, selectedUpzCode: string): void {
    const allFeatures = collection?.features || [];
    const filteredFeatures = selectedUpzCode !== 'all'
      ? allFeatures.filter((f) => String(f.properties?.['codigo_upz']) === selectedUpzCode)
      : allFeatures;
    let totalAccidentsInUpz = 0;
    for (const f of filteredFeatures) totalAccidentsInUpz += Number(f.properties?.['total_accidentes'] || 0);

    this.choroplethLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures } as any, {
      style: (feature: any) => ({
        fillColor: this.getChoroplethColor(Number(feature?.properties?.['total_accidentes'] || 0)),
        weight: 1.8, opacity: 1, color: '#1E293B', dashArray: '3', fillOpacity: 0.72
      }),
      onEachFeature: (feature: any, layer: any) => {
        const props = feature.properties || {};
        layer.bindTooltip(
          `<b>${props['nombre']}</b><br>Total Siniestros: <b>${props['total_accidentes']}</b>` +
          `<br>Muertos: ${props['muertos']} | Heridos: ${props['heridos']} | Solo daños: ${props['solo_danos']}`
        );
        layer.on({
          mouseover: (e: any) => {
            e.target.setStyle({ weight: 3.2, color: '#38BDF8', dashArray: '', fillOpacity: 0.86 });
            if (e.target.bringToFront) e.target.bringToFront();
          },
          mouseout: (e: any) => {
            if (this.choroplethLayer) this.choroplethLayer.resetStyle(e.target);
          }
        });
      }
    }).addTo(this.map);
    this.layerControl.addOverlay(this.choroplethLayer, 'Coropletas UPZ');
    this.mapState.upzCount.set(filteredFeatures.length);
    this.mapState.accidentCount.set(totalAccidentsInUpz);

    if (selectedUpzCode !== 'all') {
      const bounds = this.choroplethLayer.getBounds();
      if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [35, 35] });
    }
  }

  public getChoroplethColor(d: number): string {
    return d > 200 ? '#7F1D1D' : d > 140 ? '#B91C1C' : d > 90 ? '#EF4444' : d > 50 ? '#F97316' : d > 20 ? '#F59E0B' : d > 5 ? '#FCD34D' : '#FEF08A';
  }

  private clearCurrentRoads(): void {
    if (this.roadLayer) {
      this.map.removeLayer(this.roadLayer);
      this.layerControl.removeLayer(this.roadLayer);
      this.roadLayer = null;
    }
    this.currentGeoJsonData = null;
    this.mapState.roadCount.set(0);
  }

  private clearAllAccidentVisualizations(): void {
    if (this.accidentLayer) { this.map.removeLayer(this.accidentLayer); this.layerControl.removeLayer(this.accidentLayer); this.accidentLayer = null; }
    if (this.heatLayer) { this.map.removeLayer(this.heatLayer); this.layerControl.removeLayer(this.heatLayer); this.heatLayer = null; }
    if (this.choroplethLayer) { this.map.removeLayer(this.choroplethLayer); this.layerControl.removeLayer(this.choroplethLayer); this.choroplethLayer = null; }
    this.mapState.accidentCount.set(0);
  }

  private zoomToSearchedRoads(query: string): void {
    if (!this.roadLayer) return;
    const bounds = L.latLngBounds([]);
    let matchCount = 0;
    this.roadLayer.eachLayer((layer: any) => {
      const nom = String(layer.feature?.properties?.['nom'] || '').toLowerCase();
      if (nom.includes(query)) {
        matchCount++;
        if (layer.getBounds) bounds.extend(layer.getBounds());
        if (layer.bringToFront) layer.bringToFront();
      }
    });
    if (matchCount > 0 && bounds.isValid()) this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }

  /**
   * Determina si un tipo de via debe mostrarse segun los checkboxes y el nivel de Zoom actual.
   */
  private isRoadVisibleAtCurrentZoom(tipo: string, zoom: number): boolean {
    const visibleTypes = this.mapState.selectedRoadTypes();
    const autoZoom = this.mapState.autoFilterByZoom();

    if (tipo === 'primary' || tipo === 'trunk' || tipo === 'primary_link' || tipo === 'trunk_link') {
      return !!visibleTypes['primary'];
    }
    if (tipo === 'secondary' || tipo === 'secondary_link') {
      if (!visibleTypes['secondary']) return false;
      return !autoZoom || zoom >= 12;
    }
    if (tipo === 'tertiary' || tipo === 'tertiary_link') {
      if (!visibleTypes['tertiary']) return false;
      return !autoZoom || zoom >= 13;
    }
    if (!visibleTypes['residential']) return false;
    return !autoZoom || zoom >= 14;
  }

  private renderRoadNetwork(data: GeoJSON.FeatureCollection, autoFitBounds: boolean): void {
    if (this.roadLayer) {
      this.map.removeLayer(this.roadLayer);
      this.layerControl.removeLayer(this.roadLayer);
      this.roadLayer = null;
    }

    const currentZoom = this.map.getZoom();
    const query = this.mapState.activeSearchQuery();
    const isolate = this.mapState.isolateSearchedRoad();

    const filteredFeatures = (data.features || []).filter((f) => {
      const tipo = String(f.properties?.['tipo'] || 'residential').toLowerCase();
      const nom = String(f.properties?.['nom'] || '').toLowerCase();

      // Si el usuario busco una calle por nombre, siempre mostrar las coincidencias
      if (query.length > 0 && nom.includes(query)) {
        return true;
      }
      if (query.length > 0 && isolate) {
        return false;
      }
      return this.isRoadVisibleAtCurrentZoom(tipo, currentZoom);
    });

    this.roadLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures } as any, {
      style: (f: any) => this.getRoadStyle(f, currentZoom),
      onEachFeature: (f: any, layer: any) => {
        const nom = f.properties?.['nom'] || 'Vía Urbana';
        const tipo = f.properties?.['tipo'] || 'residential';
        layer.bindTooltip(`${nom} (${tipo})`);
        layer.on({
          mouseover: (e: any) => e.target.setStyle({ color: '#00FFFF', weight: 4.5, opacity: 1 }),
          mouseout: (e: any) => e.target.setStyle(this.getRoadStyle(f, this.map.getZoom()))
        });
      }
    }).addTo(this.map);

    this.layerControl.addOverlay(this.roadLayer, 'Malla Vial');

    if (autoFitBounds) {
      const bounds = this.roadLayer.getBounds();
      if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [25, 25], maxZoom: 15 });
    }

    this.mapState.roadCount.set(filteredFeatures.length);
  }

  private getRoadStyle(feature: any, zoom: number): L.PathOptions {
    const query = this.mapState.activeSearchQuery();
    const nom = String(feature?.properties?.['nom'] || '').toLowerCase();
    const opacity = this.mapState.roadOpacity();

    if (query.length > 0 && nom.includes(query)) {
      return { color: '#A855F7', weight: 4.2, opacity: 1 };
    }

    const tipo = String(feature?.properties?.['tipo'] || 'residential').toLowerCase();
    const isPrimary = tipo === 'primary' || tipo === 'trunk' || tipo === 'primary_link' || tipo === 'trunk_link';
    const isSecondary = tipo === 'secondary' || tipo === 'secondary_link';
    const isTertiary = tipo === 'tertiary' || tipo === 'tertiary_link';

    const color = isPrimary ? '#1D4ED8' : isSecondary ? '#0284C7' : isTertiary ? '#38BDF8' : '#60A5FA';
    const baseWeight = zoom >= 15 ? 3.2 : zoom >= 14 ? 2.3 : zoom >= 13 ? 1.8 : 1.3;
    const weight = isPrimary ? baseWeight + 0.8 : isSecondary ? baseWeight + 0.3 : baseWeight;

    return { color, weight, opacity };
  }

  private updateLayerStyles(): void {
    if (this.roadLayer) {
      const zoom = this.map.getZoom();
      this.roadLayer.setStyle((f: any) => this.getRoadStyle(f, zoom));
    }
  }
}