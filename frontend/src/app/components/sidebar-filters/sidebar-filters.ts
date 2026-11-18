import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapStateService, VisualizationMode, SidebarTab } from '../../services/map-state.service';
import { MapaApiService, PrediccionRequest } from '../../services/mapa-api.service';

export type TipoChoqueOption = 'colision_vehiculo' | 'sin_registro' | 'otro';

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

  // Campos del Formulario de Prediccion de Riesgo Vial (FastAPI v1.2.0)
  public totalActores: number = 2;
  public totalVehiculos: number = 2;
  public cantCiclistas: number = 0;
  public tipoChoqueSeleccionado: TipoChoqueOption = 'colision_vehiculo';
  public impactoObjetoFijo: boolean = false;
  public participoCamionFurgon: boolean = false;
  public participoCampero: boolean = false;
  public estrategiaModelo: 'A' | 'B' = 'A';
  public direccionSiniestro: string = '';
  public customMlUrl: string = 'http://localhost:8000/api/v1/predecir-riesgo';
  public showAdvancedMlConfig: boolean = false;

  constructor() {
    effect(() => {
      const year = this.mapState.selectedYear();
      const month = this.mapState.selectedMonth();
      this.loadUpzOptions(year, month);
    });
  }

  ngOnInit(): void {
    this.mapaApi.getAniosDisponibles().subscribe({
      next: (anios) => this.mapState.availableYears.set(anios),
      error: () => this.mapState.availableYears.set(['2020', '2019', '2018', '2017', '2016', '2015'])
    });
  }

  private loadUpzOptions(year: string, month: string): void {
    this.mapaApi.getUpz(null, year, month).subscribe({
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

  public onSwitchTab(tab: SidebarTab): void {
    this.mapState.setSidebarTab(tab);
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

  /**
   * Construye el JSON siguiendo las reglas de mapeo de la especificacion tecnica y ejecuta la inferencia.
   */
  public onSubmitPrediction(): void {
    const actores = Math.max(1, Math.floor(Number(this.totalActores) || 1));
    const vehiculos = Math.max(0, Math.floor(Number(this.totalVehiculos) || 0));
    const ciclistas = Math.max(0, Math.floor(Number(this.cantCiclistas) || 0));

    let choqueVehiculo = 0;
    let choqueSinRegistro = 0;
    if (this.tipoChoqueSeleccionado === 'colision_vehiculo') {
      choqueVehiculo = 1;
      choqueSinRegistro = 0;
    } else if (this.tipoChoqueSeleccionado === 'sin_registro') {
      choqueVehiculo = 0;
      choqueSinRegistro = 1;
    }

    // Regla 3: NO impacto contra objeto fijo -> 1 | SI impacto contra objeto fijo -> 0
    const objetoFijoNoAplica = this.impactoObjetoFijo ? 0 : 1;

    const dirTrimmed = this.direccionSiniestro.trim();

    const payload: PrediccionRequest = {
      total_actores: actores,
      total_vehiculos: vehiculos,
      cant_ciclistas: ciclistas,
      choque_vehiculo: choqueVehiculo,
      choque_sin_registro: choqueSinRegistro,
      objeto_fijo_no_aplica: objetoFijoNoAplica,
      clase_camion_furgon: this.participoCamionFurgon ? 1 : 0,
      clase_campero: this.participoCampero ? 1 : 0,
      estrategia: this.estrategiaModelo,
      direccion: dirTrimmed.length > 0 ? dirTrimmed : null
    };

    this.mapState.isPredicting.set(true);
    this.mapState.predictionError.set(null);

    this.mapaApi.predecirRiesgo(payload, this.customMlUrl).subscribe({
      next: (response) => {
        this.mapState.predictionResult.set(response);
        this.mapState.isPredicting.set(false);
      },
      error: (err) => {
        console.error('Error al invocar el microservicio de prediccion:', err);
        this.mapState.predictionError.set(
          'No se pudo conectar con el microservicio de predicción (FastAPI en puerto 8000). Verifique que el servidor Python esté en ejecución.'
        );
        this.mapState.isPredicting.set(false);
      }
    });
  }

  public onClearPrediction(): void {
    this.mapState.clearPrediction();
  }

  public resetFilters(): void {
    this.searchQueryText = '';
    this.mapState.setUpz('all');
    this.mapState.setYear('all');
    this.mapState.setMonth('all');
    this.mapState.setRoadOpacity(0.75);
    this.mapState.autoFilterByZoom.set(true);
    this.mapState.clearPrediction();
    this.mapState.selectedRoadTypes.set({
      primary: true,
      secondary: true,
      tertiary: true,
      residential: true
    });
  }
}