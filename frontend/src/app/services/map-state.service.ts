import { Injectable, signal } from '@angular/core';

export interface LocalityCoord {
  name: string;
  lat: number;
  lng: number;
}

@Injectable({
  providedIn: 'root'
})
export class MapStateService {
  public selectedLocality = signal<string>('none');
  public targetLocation = signal<LocalityCoord | null>(null);
  public roadCount = signal<number>(0);
  public currentZoom = signal<number>(12);
  public isLocalityLoading = signal<boolean>(false);
  public loadingProgressText = signal<string>('');
  public activeSearchQuery = signal<string>('');
  public isolateSearchedRoad = signal<boolean>(false);
  public selectedRoadTypes = signal<Record<string, boolean>>({
    primary: true,
    secondary: true,
    tertiary: true,
    residential: true
  });

  public localities: Record<string, LocalityCoord> = {
    usaquen: { name: 'Usaquén', lat: 4.710, lng: -74.030 },
    chapinero: { name: 'Chapinero', lat: 4.645, lng: -74.060 },
    santafe: { name: 'Santa Fe', lat: 4.600, lng: -74.070 },
    sancristobal: { name: 'San Cristóbal', lat: 4.560, lng: -74.085 },
    usme: { name: 'Usme', lat: 4.480, lng: -74.120 },
    tunjuelito: { name: 'Tunjuelito', lat: 4.575, lng: -74.135 },
    bosa: { name: 'Bosa', lat: 4.620, lng: -74.190 },
    kennedy: { name: 'Kennedy', lat: 4.630, lng: -74.150 },
    fontibon: { name: 'Fontibón', lat: 4.675, lng: -74.145 },
    engativa: { name: 'Engativá', lat: 4.700, lng: -74.115 },
    suba: { name: 'Suba', lat: 4.745, lng: -74.090 },
    barriosunidos: { name: 'Barrios Unidos', lat: 4.670, lng: -74.075 },
    teusaquillo: { name: 'Teusaquillo', lat: 4.645, lng: -74.085 },
    losmartires: { name: 'Los Mártires', lat: 4.605, lng: -74.090 },
    antonionarino: { name: 'Antonio Nariño', lat: 4.585, lng: -74.100 },
    puentearanda: { name: 'Puente Aranda', lat: 4.620, lng: -74.115 },
    lacandelaria: { name: 'La Candelaria', lat: 4.595, lng: -74.073 },
    rafaeluribe: { name: 'Rafael Uribe Uribe', lat: 4.565, lng: -74.110 },
    ciudadbolivar: { name: 'Ciudad Bolívar', lat: 4.530, lng: -74.155 },
    sumapaz: { name: 'Sumapaz', lat: 4.150, lng: -74.300 }
  };

  public setLocality(key: string): void {
    this.selectedLocality.set(key);
    this.activeSearchQuery.set('');
    this.isolateSearchedRoad.set(false);
    if (key === 'none') {
      this.targetLocation.set(null);
    } else if (key === 'all_city') {
      this.targetLocation.set({ name: 'Toda Bogotá D.C.', lat: 4.6533, lng: -74.0836 });
    } else if (this.localities[key]) {
      this.targetLocation.set(this.localities[key]);
    }
  }

  public toggleRoadType(type: string): void {
    const updated = { ...this.selectedRoadTypes() };
    updated[type] = !updated[type];
    this.selectedRoadTypes.set(updated);
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