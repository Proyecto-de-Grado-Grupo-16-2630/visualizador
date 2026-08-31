import json
import os
import sys
from pyproj import CRS, Transformer

def convertir_y_optimizar_malla_pot(archivo_origen: str, archivo_destino: str):
    """
    Convierte y optimiza capas viales EsriJSON a GeoJSON estándar (WGS84 / EPSG:4326).
    Aplica técnicas de reducción de peso para datasets de gran volumen.
    """
    if not os.path.exists(archivo_origen):
        print(f"Error: No se encontró el archivo '{archivo_origen}'.", file=sys.stderr)
        return

    print(f"Iniciando lectura de {archivo_origen}...")
    with open(archivo_origen, "r", encoding="utf-8") as f:
        datos = json.load(f)

    # Definición de sistemas de coordenadas (Plano Cartesiano Bogotá a WGS84)
    wkt_origen = datos.get("spatialReference", {}).get("wkt")
    if wkt_origen:
        crs_in = CRS.from_wkt(wkt_origen)
    else:
        crs_in = CRS.from_proj4(
            "+proj=tmerc +lat_0=4.680486111 +lon_0=-74.14659167 "
            "+k=1 +x_0=92334.879 +y_0=109320.965 +ellps=GRS80 +units=m +no_defs"
        )
    crs_out = CRS.from_epsg(4326)
    transformer = Transformer.from_crs(crs_in, crs_out, always_xy=True)

    features = []
    elementos = datos.get("features", [])
    total = len(elementos)
    print(f"Procesando {total:,} registros de vías...")

    for item in elementos:
        atributos = item.get("attributes", {})
        rutas = item.get("geometry", {}).get("paths", [])

        for ruta in rutas:
            if not ruta or len(ruta) < 2:
                continue

            coordenadas = []
            for punto in ruta:
                x, y = punto[0], punto[1]
                lon, lat = transformer.transform(x, y)
                # 5 decimales representan precisión de ~1 metro
                coordenadas.append([round(lon, 5), round(lat, 5)])

            features.append({
                "type": "Feature",
                "properties": {
                    "id": atributos.get("CODIGO_ID"),
                    "nom": (atributos.get("NOMBRE") or "").strip(),
                    "tipo": atributos.get("TIPO_VIA")
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": coordenadas
                }
            })

    geojson_final = {
        "type": "FeatureCollection",
        "features": features
    }

    print(f"Escribiendo salida optimizada en {archivo_destino}...")
    with open(archivo_destino, "w", encoding="utf-8") as f:
        # Exportar sin espacios extra para minimizar el tamaño en disco
        json.dump(geojson_final, f, separators=(",", ":"), ensure_ascii=False)

    tamano_mb = os.path.getsize(archivo_destino) / (1024 * 1024)
    print(f"Proceso concluido exitosamente. Tamaño final: {tamano_mb:.2f} MB ({len(features):,} tramos generados).")

if __name__ == "__main__":
    convertir_y_optimizar_malla_pot(
        archivo_origen="malla_intermedia_pot.geojson",
        archivo_destino="malla_vial_wgs84.geojson"
    )