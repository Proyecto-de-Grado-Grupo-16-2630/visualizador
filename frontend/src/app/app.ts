import { Component } from '@angular/core';
import { SidebarFiltersComponent } from './components/sidebar-filters/sidebar-filters';
import { MapViewComponent } from './components/map-view/map-view';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SidebarFiltersComponent, MapViewComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}