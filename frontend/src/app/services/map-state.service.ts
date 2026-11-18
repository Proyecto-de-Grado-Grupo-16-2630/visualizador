import { Injectable, signal } from '@angular/core';
import { PrediccionResponse } from './mapa-api.service';

export type VisualizationMode = 'points' | 'heatmap' | 'choropleth';
export type SidebarTab = 'explorer' | 'predictor';

export interface UpzOption {
  codigo: string;
  nombre: string;
  totalAccidentes: number;
}

export interface MonthOption {
  value: string;
  label: string;
}

@Injectable({
  providedIn: 'root'
})
export class MapStateService {
  public activeSidebarTab = signal<SidebarTab>('explorer');

  public selectedYear = signal<string>('all');
  public selectedMonth = signal<string>('all');
  public availableYears = signal<string[]>([]);
  public selectedUpz = signal<string>('all');
  public availableUpzList = signal<UpzOption[]>([]);
  public visualizationMode = signal<VisualizationMode>('points');

  public roadCount = signal<number>(0);
  public accidentCount = signal<number>(0);
  public upzCount = signal<number>(0);
  public currentZoom = signal<number>(12);
  public isLocalityLoading = signal<boolean>(false);
  public loadingProgressText = signal<string>('');
  public activeSearchQuery = signal<string>('');
  public isolateSearchedRoad = signal<boolean>(false);

  public showAccidentPoints = signal<boolean>(true);
  public showRoadNetwork = signal<boolean>(true);

  public roadOpacity = signal<number>(0.75);
  public autoFilterByZoom = signal<boolean>(true);

  // Estado del modelo de prediccion de riesgo ML
  public predictionResult = signal<PrediccionResponse | null>(null);
  public isPredicting = signal<boolean>(false);
  public predictionError = signal<string | null>(null);

  public readonly months: MonthOption[] = [
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
  ];

  public selectedRoadTypes = signal<Record<string, boolean>>({
    primary: true,
    secondary: true,
    tertiary: true,
    residential: true
  });

  public setSidebarTab(tab: SidebarTab): void {
    this.activeSidebarTab.set(tab);
  }

  public hasActiveFilters(): boolean {
    return (
      this.selectedUpz() !== 'all' ||
      this.selectedYear() !== 'all' ||
      this.selectedMonth() !== 'all' ||
      this.activeSearchQuery().length > 0 ||
      this.predictionResult() !== null
    );
  }

  public setUpz(codigoUpz: string): void {
    this.selectedUpz.set(codigoUpz);
    this.activeSearchQuery.set('');
    this.isolateSearchedRoad.set(false);
  }

  public setYear(year: string): void {
    this.selectedYear.set(year);
  }

  public setMonth(month: string): void {
    this.selectedMonth.set(month);
  }

  public setRoadOpacity(opacity: number): void {
    this.roadOpacity.set(opacity);
  }

  public toggleAutoFilterByZoom(): void {
    this.autoFilterByZoom.set(!this.autoFilterByZoom());
  }

  public setVisualizationMode(mode: VisualizationMode): void {
    this.visualizationMode.set(mode);
    this.showAccidentPoints.set(true);
  }

  public toggleRoadType(type: string): void {
    const updated = { ...this.selectedRoadTypes() };
    updated[type] = !updated[type];
    this.selectedRoadTypes.set(updated);
  }

  public toggleAccidentPoints(): void {
    this.showAccidentPoints.set(!this.showAccidentPoints());
  }

  public toggleRoadNetwork(): void {
    this.showRoadNetwork.set(!this.showRoadNetwork());
  }

  public executeSearch(query: string): void {
    this.activeSearchQuery.set(query.trim().toLowerCase());
  }

  public clearSearch(): void {
    this.activeSearchQuery.set('');
    this.isolateSearchedRoad.set(false);
  }

  public toggleIsolateSearchedRoad(): void {
    this.isolateSearchedRoad.set(!this.isolateSearchedRoad());
  }

  public clearPrediction(): void {
    this.predictionResult.set(null);
    this.predictionError.set(null);
  }

  /**
   * Retorna el color hexadecimal oficial de acuerdo con el umbral de nivel_riesgo.
   */
  public getRiskLevelColor(nivelRiesgo?: string | null): string {
    const normalized = String(nivelRiesgo || '').toUpperCase().trim();
    if (normalized === 'CRÍTICO' || normalized === 'CRITICO') return '#FF0000';
    if (normalized === 'ALTO') return '#FF8C00';
    if (normalized === 'MEDIO') return '#FFD700';
    if (normalized === 'BAJO') return '#008000';
    return '#38BDF8';
  }
}