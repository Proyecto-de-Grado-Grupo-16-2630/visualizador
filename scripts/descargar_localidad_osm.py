import sys
import json
import os
import time
import urllib.request
import urllib.parse

BBOX_LOCALIDADES = {
    "kennedy": [4.605, -74.185, 4.665, -74.125],
    "suba": [4.710, -74.140, 4.790, -74.045],
    "engativa": [4.680, -74.145, 4.730, -74.085],
    "chapinero": [4.630, -74.070, 4.695, -74.025],
    "usaquen": [4.685, -74.055, 4.810, -74.010],
    "fontibon": [4.650, -74.175, 4.700, -74.110],
    "bosa": [4.590, -74.215, 4.655, -74.165],
    "santafe": [4.580, -74.085, 4.630, -74.030],
    "teusaquillo": [4.625, -74.100, 4.665, -74.065],
    "puentearanda": [4.600, -74.135, 4.645, -74.095],
    "barriosunidos": [4.655, -74.090, 4.695, -74.055],
    "ciudadbolivar": [4.450, -74.200, 4.580, -74.130],
    "tunjuelito": [4.560, -74.155, 4.600, -74.120],
    "rafaeluribe": [4.545, -74.130, 4.590, -74.095],
    "sancristobal": [4.515, -74.115, 4.590, -74.060],
    "usme": [4.420, -74.160, 4.545, -74.080],
    "losmartires": [4.595, -74.100, 4.620, -74.075],
    "antonionarino": [4.575, -74.115, 4.600, -74.085],
    "lacandelaria": [4.590, -74.080, 4.605, -74.065],
    "sumapaz": [4.150, -74.300, 4.350, -74.150]
}

SERVIDORES = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
]

def descargar_localidad(nombre_localidad: str, carpeta_salida: str) -> bool:
    bbox = BBOX_LOCALIDADES[nombre_localidad]
    s, w, n, e = bbox[0], bbox[1], bbox[2], bbox[3]

    query = f"""
    [out:json][timeout:180];
    (
      way["highway"~"primary|secondary|tertiary|residential|trunk|living_street"]({s},{w},{n},{e});
    );
    out geom;
    """

    data = urllib.parse.urlencode({"data": query}).encode("utf-8")

    for intento, url_servidor in enumerate(SERVIDORES):
        try:
            print(f"Consultando {nombre_localidad} en servidor alternativo {intento + 1}...")
            req = urllib.request.Request(
                url_servidor,
                data=data,
                headers={"User-Agent": f"VisorTesisBogotaEngine/{intento + 1}.0"}
            )
            with urllib.request.urlopen(req, timeout=190) as resp:
                resultado = json.loads(resp.read().decode("utf-8"))

            elementos = resultado.get("elements", [])
            features = []

            for elem in elementos:
                geometria_pts = elem.get("geometry", [])
                if len(geometria_pts) < 2:
                    continue

                coords = [[round(p["lon"], 5), round(p["lat"], 5)] for p in geometria_pts]
                tags = elem.get("tags", {})
                nombre = tags.get("name", "").strip()
                tipo = tags.get("highway", "residential")

                features.append({
                    "type": "Feature",
                    "properties": {
                        "id": str(elem.get("id")),
                        "nom": nombre,
                        "tipo": tipo
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": coords
                    }
                })

            geojson_final = {
                "type": "FeatureCollection",
                "features": features
            }

            ruta_archivo = os.path.join(carpeta_salida, f"{nombre_localidad}.geojson")
            with open(ruta_archivo, "w", encoding="utf-8") as f:
                json.dump(geojson_final, f, separators=(",", ":"), ensure_ascii=False)

            print(f"Descargada con exito: {nombre_localidad} ({len(features)} tramos)")
            return True

        except Exception as err:
            print(f"Fallo en servidor {intento + 1}: {err}")
            time.sleep(5)

    return False

def ejecutar():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    carpeta_destino = os.path.join(base_dir, "frontend", "public", "data", "localidades")
    os.makedirs(carpeta_destino, exist_ok=True)

    arg = sys.argv[1].lower().strip() if len(sys.argv) > 1 else "missing"

    if arg in ["all", "missing"]:
        for loc in BBOX_LOCALIDADES.keys():
            ruta_existente = os.path.join(carpeta_destino, f"{loc}.geojson")
            if os.path.exists(ruta_existente) and os.path.getsize(ruta_existente) > 1000:
                print(f"Omitiendo {loc} (ya existe)")
                continue

            print(f"Descargando pendiente: {loc}")
            exito = descargar_localidad(loc, carpeta_destino)
            if exito:
                time.sleep(6)
            else:
                time.sleep(12)
        print("Proceso de descarga de pendientes completado.")
    else:
        if arg in BBOX_LOCALIDADES:
            descargar_localidad(arg, carpeta_destino)
        else:
            print(f"Localidad no valida: {arg}")

if __name__ == "__main__":
    ejecutar()