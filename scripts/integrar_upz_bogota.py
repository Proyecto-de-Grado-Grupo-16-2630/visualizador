import json, os, sqlite3, ssl, urllib.parse, urllib.request, time
from shapely.geometry import shape, Point, Polygon, MultiPolygon
from shapely.strtree import STRtree

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB_PATH = os.path.join(BASE_DIR, "accidentes_bogota_spatialite.db")
UPZ_DIR = os.path.join(BASE_DIR, "data", "upz")
UPZ_GEOJSON = os.path.join(UPZ_DIR, "upz_bogota.geojson")
PUNTOS_GEOJSON = os.path.join(BASE_DIR, "data", "puntos", "geocodificacion_Final_3406.geojson")

def descargar_upz():
    os.makedirs(UPZ_DIR, exist_ok=True)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    
    ideca_urls = [
        "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/espaciopublico/indicadorespaciopublico/MapServer/1/query?where=1=1&outFields=*&outSR=4326&f=geojson",
        "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/ordenamientoterritorial/unidadplaneamientolocal/MapServer/0/query?where=1=1&outFields=*&outSR=4326&f=geojson"
    ]
    for url in ideca_urls:
        try:
            print("Intentando descargar polígonos desde IDECA (Catastro Bogotá)...")
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("features"):
                    with open(UPZ_GEOJSON, "w", encoding="utf-8") as f: json.dump(data, f)
                    print("-> Éxito descargando desde IDECA.")
                    return data.get("features")
        except Exception as e:
            print(f" -> IDECA falló ({e}).")

    print("Activando Plan B (Servidores Espejo de OpenStreetMap)...")
    overpass_q = """
    [out:json][timeout:90];
    area["name"="Bogotá"]["admin_level"~"6|7"]->.b;
    (relation["boundary"="administrative"]["admin_level"~"8|9"](area.b););
    out geom;
    """
    servidores_osm = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.private.coffee/api/interpreter"
    ]
    for srv in servidores_osm:
        try:
            print(f"Consultando servidor OSM: {srv}...")
            req = urllib.request.Request(srv, data=urllib.parse.urlencode({"data": overpass_q}).encode("utf-8"), headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=90, context=ctx) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
                features = []
                for i, el in enumerate(raw.get("elements", []), 1):
                    tags = el.get("tags", {})
                    coords = []
                    for m in el.get("members", []):
                        if m.get("role") == "outer" and "geometry" in m:
                            ring = [[pt["lon"], pt["lat"]] for pt in m["geometry"]]
                            if ring and ring[0] != ring[-1]: ring.append(ring[0])
                            if len(ring) >= 4: coords.append(ring)
                    if coords:
                        features.append({
                            "type": "Feature",
                            "properties": {"CODIGO_UPZ": tags.get("ref", f"UPZ-{i}"), "NOMBRE_UPZ": tags.get("name", f"Sector {i}")},
                            "geometry": {"type": "Polygon", "coordinates": [coords[0]]}
                        })
                if features:
                    with open(UPZ_GEOJSON, "w", encoding="utf-8") as f: json.dump({"type": "FeatureCollection", "features": features}, f)
                    print("-> Éxito descargando desde OpenStreetMap.")
                    return features
        except Exception as e:
            print(f" -> Servidor falló ({e}). Reintentando en otro nodo...")
            time.sleep(4)
    return []

# EXTRACTOR INTELIGENTE
def extraer_propiedad(props, claves, default="", es_nombre=False):
    props_upper = {str(k).upper(): v for k, v in props.items() if v is not None}
    # 1. Búsqueda exacta
    for clave in claves:
        if clave.upper() in props_upper:
            val = str(props_upper[clave.upper()]).strip()
            if val and val.lower() != "null": return val
    # 2. Búsqueda difusa (Cualquier columna que contenga NOM o COD)
    for k, v in props_upper.items():
        v_str = str(v).strip()
        if not v_str or v_str.lower() == "null": continue
        if es_nombre and any(sub in k for sub in ["NOM", "NAM", "DESC"]):
            if not v_str.isdigit(): return v_str
        elif not es_nombre and any(sub in k for sub in ["COD", "ID", "REF", "NUM"]):
            return v_str
    return default

def integrar_todo():
    features = descargar_upz()
    if not features:
        print("Cancelando cruce espacial por falta de polígonos.")
        return

    upz_registros, upz_geoms = [], []
    for idx, feat in enumerate(features, 1):
        geom_json = feat.get("geometry")
        if not geom_json: continue
        geom_shp = shape(geom_json).buffer(0)
        if geom_shp.is_empty: continue
        
        props = feat.get("properties") or {}
        cod_upz = extraer_propiedad(props, ["UPlCodigo", "UPZ_CODIGO", "CODIGO_UPZ", "UPL_ID", "SCACODIGO"], f"U-{idx}", False)
        nom_upz = extraer_propiedad(props, ["UPlNombre", "UPZ_NOMBRE", "NOMBRE_UPZ", "NOMBRE", "SCANOMBRE"], f"Zona {cod_upz}", True)
        
        geom_wkt = MultiPolygon([geom_shp]).wkt if isinstance(geom_shp, Polygon) else geom_shp.wkt
        upz_registros.append({
            "id_local": idx, "codigo_upz": cod_upz, "nombre": nom_upz.title(), # Title Case para que se vea bien
            "codigo_localidad": "", "geom": geom_shp, "wkt": geom_wkt,
            "total_accidentes": 0, "muertos": 0, "heridos": 0, "solo_danos": 0
        })
        upz_geoms.append(geom_shp)

    tree = STRtree(upz_geoms)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("DROP TABLE IF EXISTS upz_bogota;")
    cur.execute("""CREATE TABLE upz_bogota (
        id_local INTEGER PRIMARY KEY AUTOINCREMENT, codigo_upz TEXT, nombre TEXT, codigo_localidad TEXT,
        total_accidentes INTEGER DEFAULT 0, muertos INTEGER DEFAULT 0, heridos INTEGER DEFAULT 0, solo_danos INTEGER DEFAULT 0, geom TEXT NOT NULL
    );""")

    with open(PUNTOS_GEOJSON, "r", encoding="utf-8") as f: puntos_fc = json.load(f)
    cur.execute("DROP TABLE IF EXISTS puntos_accidentes;")
    cur.execute("""CREATE TABLE puntos_accidentes (
        id_local INTEGER PRIMARY KEY AUTOINCREMENT, CODIGO_ACCIDENTE TEXT, FECHA TEXT, HORA TEXT, GRAVEDAD TEXT, GRAVEDAD_DESC TEXT,
        CLASE_DESC TEXT, CHOQUE_DESC TEXT, DIRECCION TEXT, DIRECCION_COMPLETA TEXT, CODIGO_LOCALIDAD TEXT, CODIGO_UPZ TEXT, NOMBRE_UPZ TEXT, geom TEXT NOT NULL
    );""")

    accidentes_rows = []
    for feat in puntos_fc.get("features", []):
        geom_json = feat.get("geometry")
        if not geom_json or geom_json.get("type") != "Point": continue
        coords = geom_json.get("coordinates", [])
        if len(coords) < 2: continue
        lon, lat = float(coords[0]), float(coords[1])
        pt = Point(lon, lat)
        
        upz_match = None
        for c_idx in tree.query(pt):
            if upz_geoms[c_idx].contains(pt) or upz_geoms[c_idx].touches(pt):
                upz_match = upz_registros[c_idx]; break
        
        if not upz_match and upz_geoms:
            nearest_idx = min(range(len(upz_geoms)), key=lambda i: upz_geoms[i].distance(pt))
            upz_match = upz_registros[nearest_idx]

        props = feat.get("properties", {})
        gravedad = str(props.get("GRAVEDAD", "3"))
        if upz_match:
            upz_match["total_accidentes"] += 1
            if gravedad == "1": upz_match["muertos"] += 1
            elif gravedad == "2": upz_match["heridos"] += 1
            else: upz_match["solo_danos"] += 1

        accidentes_rows.append((
            str(props.get("CODIGO_ACCIDENTE", props.get("id_local", ""))), str(props.get("FECHA", "")), str(props.get("HORA", "")),
            gravedad, str(props.get("GRAVEDAD_DESC", "Solo daños")), str(props.get("CLASE_DESC", "")), str(props.get("CHOQUE_DESC", "")),
            str(props.get("DIRECCION", "")), str(props.get("DIRECCION_COMPLETA", props.get("DIRECCION", ""))), str(props.get("CODIGO_LOCALIDAD", "")),
            upz_match["codigo_upz"] if upz_match else "", upz_match["nombre"] if upz_match else "", f"POINT({lon} {lat})"
        ))

    cur.executemany("INSERT INTO puntos_accidentes (CODIGO_ACCIDENTE, FECHA, HORA, GRAVEDAD, GRAVEDAD_DESC, CLASE_DESC, CHOQUE_DESC, DIRECCION, DIRECCION_COMPLETA, CODIGO_LOCALIDAD, CODIGO_UPZ, NOMBRE_UPZ, geom) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", accidentes_rows)

    cur.execute("ALTER TABLE calles_bogota ADD COLUMN codigo_upz TEXT;")
    calles = cur.execute("SELECT id_local, geom FROM calles_bogota").fetchall()
    updates_calles = []
    for id_calle, wkt_line in calles:
        try:
            pt_str = wkt_line.split("(")[1].split(",")[0].strip().split()
            pt_ini = Point(float(pt_str[0]), float(pt_str[1]))
            match_idx = -1
            for c_idx in tree.query(pt_ini):
                if upz_geoms[c_idx].contains(pt_ini): match_idx = c_idx; break
            if match_idx == -1 and upz_geoms:
                match_idx = min(range(len(upz_geoms)), key=lambda i: upz_geoms[i].distance(pt_ini))
            if match_idx != -1: updates_calles.append((upz_registros[match_idx]["codigo_upz"], id_calle))
        except Exception: continue
    
    cur.executemany("UPDATE calles_bogota SET codigo_upz = ? WHERE id_local = ?", updates_calles)
    cur.executemany("INSERT INTO upz_bogota (id_local, codigo_upz, nombre, codigo_localidad, total_accidentes, muertos, heridos, solo_danos, geom) VALUES (?,?,?,?,?,?,?,?,?)",
        [(u["id_local"], u["codigo_upz"], u["nombre"], u["codigo_localidad"], u["total_accidentes"], u["muertos"], u["heridos"], u["solo_danos"], u["wkt"]) for u in upz_registros])

    conn.commit()
    conn.close()
    print(f"\n=== PROCESO COMPLETADO EXITOSAMENTE ===")
    print(f"-> Polígonos de UPZ almacenados: {len(upz_registros)}")

if __name__ == "__main__":
    integrar_todo()