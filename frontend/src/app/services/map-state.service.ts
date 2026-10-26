import { Injectable, signal } from '@angular/core';

export type VisualizationMode = 'points' | 'heatmap' | 'choropleth';

export interface UpzOption {
  codigo: string;
  nombre: string;
  totalAccidentes: number;
}

@Injectable({
  providedIn: 'root'
})
export class MapStateService {
  public selectedYear = signal<string>('all');
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
  
  // Toggles de Capas Principales
  public showAccidentPoints = signal<boolean>(true);
  public showRoadNetwork = signal<boolean>(true);

  public selectedRoadTypes = signal<Record<string, boolean>>({
    primary: true,
    secondary: true,
    tertiary: true,
    residential: true
  });

  public setUpz(codigoUpz: string): void {
    this.selectedUpz.set(codigoUpz);
    this.activeSearchQuery.set('');
    this.isolateSearchedRoad.set(false);
  }

  public setYear(year: string): void {
    this.selectedYear.set(year);
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
}