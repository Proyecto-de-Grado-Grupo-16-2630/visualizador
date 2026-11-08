import { Injectable, signal } from '@angular/core';

export type VisualizationMode = 'points' | 'heatmap' | 'choropleth';

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
  public selectedYear = signal<string>('all');
  public selectedMonth = signal<string>('all');
  public selectedDay = signal<string>('all');
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

  public roadOpacity = signal<number>(0.85);
  public autoFilterByZoom = signal<boolean>(true);

  public readonly months: MonthOption[] = [
    { value: '01', label: '01 - Enero' },
    { value: '02', label: '02 - Febrero' },
    { value: '03', label: '03 - Marzo' },
    { value: '04', label: '04 - Abril' },
    { value: '05', label: '05 - Mayo' },
    { value: '06', label: '06 - Junio' },
    { value: '07', label: '07 - Julio' },
    { value: '08', label: '08 - Agosto' },
    { value: '09', label: '09 - Septiembre' },
    { value: '10', label: '10 - Octubre' },
    { value: '11', label: '11 - Noviembre' },
    { value: '12', label: '12 - Diciembre' }
  ];

  public readonly days: string[] = Array.from({ length: 31 }, (_, i) =>
    String(i + 1).padStart(2, '0')
  );

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

  public setMonth(month: string): void {
    this.selectedMonth.set(month);
  }

  public setDay(day: string): void {
    this.selectedDay.set(day);
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
}