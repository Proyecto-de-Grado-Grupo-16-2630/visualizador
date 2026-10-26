import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapStateService } from '../../services/map-state.service';
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

  ngOnInit(): void {
    this.mapaApi.getAniosDisponibles().subscribe({
      next: (anios) => this.mapState.availableYears.set(anios),
      error: () => this.mapState.availableYears.set(['2020'])
    });
  }

  public onLocalityChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.searchQueryText = '';
    this.mapState.setLocality(select.value);
  }

  public onYearChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.mapState.setYear(select.value);
  }

  public onToggleType(type: string): void {
    this.mapState.toggleRoadType(type);
  }

  public onToggleAccidents(): void {
    this.mapState.toggleAccidentPoints();
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
    this.mapState.setLocality('none');
    this.mapState.setYear('all');
    this.mapState.selectedRoadTypes.set({
      primary: true,
      secondary: true,
      tertiary: true,
      residential: true
    });
  }
}