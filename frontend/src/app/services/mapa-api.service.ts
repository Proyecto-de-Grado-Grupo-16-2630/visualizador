import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MapaApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:8080/api/mapa';

  public getCalles(localidad?: string | null, codigoUpz?: string | null): Observable<GeoJSON.FeatureCollection> {
    let params = new HttpParams();
    if (localidad && localidad !== 'none' && localidad !== 'all_city') {
      params = params.set('localidad', localidad);
    }
    if (codigoUpz && codigoUpz !== 'all') {
      params = params.set('upz', codigoUpz);
    }
    return this.http.get<GeoJSON.FeatureCollection>(`${this.API_URL}/calles`, { params });
  }

  public getAccidentes(codigoLocalidad?: string | null, anio?: string | null, codigoUpz?: string | null): Observable<GeoJSON.FeatureCollection> {
    let params = new HttpParams();
    if (codigoLocalidad && codigoLocalidad !== 'all') {
      params = params.set('localidad', codigoLocalidad);
    }
    if (anio && anio !== 'all') {
      params = params.set('anio', anio);
    }
    if (codigoUpz && codigoUpz !== 'all') {
      params = params.set('upz', codigoUpz);
    }
    return this.http.get<GeoJSON.FeatureCollection>(`${this.API_URL}/accidentes`, { params });
  }

  public getUpz(codigoLocalidad?: string | null, anio?: string | null): Observable<GeoJSON.FeatureCollection> {
    let params = new HttpParams();
    if (codigoLocalidad && codigoLocalidad !== 'all') {
      params = params.set('localidad', codigoLocalidad);
    }
    if (anio && anio !== 'all') {
      params = params.set('anio', anio);
    }
    return this.http.get<GeoJSON.FeatureCollection>(`${this.API_URL}/upz`, { params });
  }

  public getAniosDisponibles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.API_URL}/anios`);
  }
}