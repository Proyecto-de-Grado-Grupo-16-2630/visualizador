import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapStateService, VisualizationMode } from '../../services/map-state.service';
import { MapaApiService } from '../../services/mapa-api.service';

@Component({
  selector: 'app-sidebar-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar-filters.html',
  styleUrl: './sidebar-filters.scss'
})
export class SidebarFiltersComponent implements OnInit {
  public readonly mapState = inject(MapStateService);
  private readonly mapaApi = inject(MapaApiService);
  public searchQueryText: string = '';

  constructor() {
    // Recalcular conteos de UPZ en el selector cada vez que cambie la fecha
    effect(() => {
      const year = this.mapState.selectedYear();
      const month = this.mapState.selectedMonth();
      const day = this.mapState.selectedDay();
      this.loadUpzOptions(year, month, day);
    });
  }

  ngOnInit(): void {
    this.mapaApi.getAniosDisponibles().subscribe({
      next: (anios) => this.mapState.availableYears.set(anios),
      error: () => this.mapState.availableYears.set(['2020'])
    });
  }

  private loadUpzOptions(year: string, month: string, day: string): void {
    this.mapaApi.getUpz(null, year, month, day).subscribe({
      next: (collection) => {
        const upzOpts = (collection.features || [])
          .map((f) => ({
            codigo: String(f.properties?.['codigo_upz'] || ''),
            nombre: String(f.properties?.['nombre'] || ''),
            totalAccidentes: Number(f.properties?.['total_accidentes'] || 0)
          }))
          .filter((u) => u.codigo.length > 0)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.mapState.availableUpzList.set(upzOpts);
      }
    });
  }

  public onUpzChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.searchQueryText = '';
    this.mapState.setUpz(select.value);
  }

  public onYearChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.mapState.setYear(select.value);
  }

  public onMonthChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.mapState.setMonth(select.value);
  }

  public onDayChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.mapState.setDay(select.value);
  }

  public onOpacityChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.mapState.setRoadOpacity(Number(input.value));
  }

  public onToggleZoomFilter(): void {
    this.mapState.toggleAutoFilterByZoom();
  }

  public onSelectMode(mode: VisualizationMode): void {
    this.mapState.setVisualizationMode(mode);
  }

  public onToggleType(type: string): void {
    this.mapState.toggleRoadType(type);
  }

  public onToggleAccidents(): void {
    this.mapState.toggleAccidentPoints();
  }

  public onToggleRoadNetwork(): void {
    this.mapState.toggleRoadNetwork();
  }

  public onSearch(): void {
    this.mapState.executeSearch(this.searchQueryText);
  }

  public onClearSearch(): void {
    this.searchQueryText = '';
    this.mapState.clearSearch();
  }

  public onToggleIsolate(): void {
    this.mapState.toggleIsolateSearchedRoad();
  }

  public resetFilters(): void {
    this.searchQueryText = '';
    this.mapState.setUpz('all');
    this.mapState.setYear('all');
    this.mapState.setMonth('all');
    this.mapState.setDay('all');
    this.mapState.setRoadOpacity(0.85);
    this.mapState.autoFilterByZoom.set(true);
    this.mapState.setVisualizationMode('points');
    this.mapState.showRoadNetwork.set(true);
    this.mapState.showAccidentPoints.set(true);
    this.mapState.selectedRoadTypes.set({
      primary: true,
      secondary: true,
      tertiary: true,
      residential: true
    });
  }
}