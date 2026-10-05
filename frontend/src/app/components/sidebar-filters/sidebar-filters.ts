import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapStateService } from '../../services/map-state.service';

@Component({
  selector: 'app-sidebar-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar-filters.html',
  styleUrl: './sidebar-filters.scss'
})
export class SidebarFiltersComponent {
  public mapState = inject(MapStateService);
  public searchQueryText: string = '';

  public onLocalityChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.searchQueryText = '';
    this.mapState.setLocality(select.value);
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

  public onToggleType(typeKey: string): void {
    this.mapState.toggleRoadType(typeKey);
  }

  public resetFilters(): void {
    this.searchQueryText = '';
    this.mapState.setLocality('none');
  }
}