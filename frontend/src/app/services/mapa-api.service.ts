import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';

export interface PrediccionRequest {
  total_actores: number;
  total_vehiculos: number;
  cant_ciclistas: number;
  choque_vehiculo: number;
  choque_sin_registro: number;
  objeto_fijo_no_aplica: number;
  clase_camion_furgon: number;
  clase_campero: number;
  estrategia?: 'A' | 'B';
  direccion?: string | null;
}

export interface PrediccionUbicacion {
  estado: 'ENCONTRADA' | 'NO_SOLICITADA' | 'NO_ENCONTRADA' | 'ERROR_SERVICIO' | 'DEPENDENCIA_FALTANTE' | string;
  direccion_ingresada: string | null;
  direccion_normalizada: string | null;
  direccion_oficial: string | null;
  latitud: number | null;
  longitud: number | null;
}

export interface PrediccionResponse {
  estrategia_aplicada: string;
  prediccion_codigo: number;
  prediccion_descripcion: string;
  probabilidades: {
    solo_danos: number;
    con_heridos: number;
    con_muertos: number;
  };
  nivel_riesgo: 'CRÍTICO' | 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO' | string;
  ubicacion: PrediccionUbicacion | null;
}

@Injectable({
  providedIn: 'root'
})
export class MapaApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:8080/api/mapa';
  private readonly DEFAULT_FASTAPI_URL = 'http://localhost:8000/api/v1/predecir-riesgo';

  public getCalles(localidad?: string | null, codigoUpz?: string | null): Observable<GeoJSON.FeatureCollection> {
    let params = new HttpParams();
    if (localidad && localidad !== 'none' && localidad !== 'all_city' && localidad !== 'all') {
      params = params.set('localidad', localidad);
    }
    if (codigoUpz && codigoUpz !== 'all') {
      params = params.set('upz', codigoUpz);
    }
    return this.http.get<GeoJSON.FeatureCollection>(`${this.API_URL}/calles`, { params });
  }

  public getAccidentes(
    codigoLocalidad?: string | null,
    anio?: string | null,
    mes?: string | null,
    codigoUpz?: string | null
  ): Observable<GeoJSON.FeatureCollection> {
    let params = new HttpParams();
    if (codigoLocalidad && codigoLocalidad !== 'all') {
      params = params.set('localidad', codigoLocalidad);
    }
    if (anio && anio !== 'all') {
      params = params.set('anio', anio);
    }
    if (mes && mes !== 'all') {
      params = params.set('mes', mes);
    }
    if (codigoUpz && codigoUpz !== 'all') {
      params = params.set('upz', codigoUpz);
    }
    return this.http.get<GeoJSON.FeatureCollection>(`${this.API_URL}/accidentes`, { params });
  }

  public getUpz(
    codigoLocalidad?: string | null,
    anio?: string | null,
    mes?: string | null
  ): Observable<GeoJSON.FeatureCollection> {
    let params = new HttpParams();
    if (codigoLocalidad && codigoLocalidad !== 'all') {
      params = params.set('localidad', codigoLocalidad);
    }
    if (anio && anio !== 'all') {
      params = params.set('anio', anio);
    }
    if (mes && mes !== 'all') {
      params = params.set('mes', mes);
    }
    return this.http.get<GeoJSON.FeatureCollection>(`${this.API_URL}/upz`, { params });
  }

  public getAniosDisponibles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.API_URL}/anios`);
  }

  /**
   * Consume el microservicio de prediccion a traves del Gateway Spring Boot (8080)
   * con respaldo automatico directo hacia FastAPI (8000 / URL personalizada o Ngrok).
   */
  public predecirRiesgo(payload: PrediccionRequest, customEndpointUrl?: string): Observable<PrediccionResponse> {
    const targetFastApi = (customEndpointUrl && customEndpointUrl.trim().length > 0)
      ? customEndpointUrl.trim()
      : this.DEFAULT_FASTAPI_URL;

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-ML-Target-Url': targetFastApi
    });

    return this.http.post<PrediccionResponse>(`${this.API_URL}/predecir-riesgo`, payload, { headers }).pipe(
      catchError(() => {
        return this.http.post<PrediccionResponse>(targetFastApi, payload, {
          headers: new HttpHeaders({ 'Content-Type': 'application/json' })
        });
      })
    );
  }
}