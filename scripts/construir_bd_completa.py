import glob, json, os, shutil, sqlite3, ssl, time, urllib.parse, urllib.request
from shapely.geometry import shape, Point, Polygon, MultiPolygon
from shapely.strtree import STRtree

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW_DIR = os.path.join(BASE_DIR, "backend", "data", "raw")
LOCALIDADES_DIR = os.path.join(RAW_DIR, "localidades")
PUNTOS_GEOJSON = os.path.join(RAW_DIR, "puntos", "geocodificacion_Final_3406.geojson")
UPZ_GEOJSON = os.path.join(RAW_DIR, "upz", "upz_bogota.geojson")

DB_BACKEND_PATH = os.path.join(BASE_DIR, "backend", "data", "accidentes_bogota_spatialite.db")
DB_ROOT_PATH = os.path.join(BASE_DIR, "accidentes_bogota_spatialite.db")

def obtener_poligonos_upz():
    os.makedirs(os.path.dirname(UPZ_GEOJSON), exist_ok=True)
    if os.path.exists(UPZ_GEOJSON) and os.path.getsize(UPZ_GEOJSON) > 2000:
        with open(UPZ_GEOJSON, "r", encoding="utf-8") as f:
            feats = json.load(f).get("features", [])
            if feats:
                print(f"1. Usando {len(feats)} poligonos de UPZ en cache ({UPZ_GEOJSON}).")
                return feats

    ctx = ssl.create_default_context()
    ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    ideca_urls = [
        "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/ordenamientoterritorial/unidadplaneamientolocal/MapServer/0/query?where=1=1&outFields=*&outSR=4326&f=geojson",
        "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/espaciopublico/indicadorespaciopublico/MapServer/1/query?where=1=1&outFields=*&outSR=4326&f=geojson"
    ]
    for url in ideca_urls:
        try:
            print(f"Consultando UPZ oficiales en IDECA: {url[:75]}...")
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=25, context=ctx) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                feats = data.get("features", [])
                if feats:
                    with open(UPZ_GEOJSON, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False)
                    print(f"-> Descargados {len(feats)} poligonos desde IDECA.")
                    return feats
        except Exception as e:
            print(f"   Aviso IDECA: {e}")
    return []

def extraer_propiedad(props, claves, default="", es_nombre=False):
    props_upper = {str(k).upper(): v for k, v in props.items() if v is not None}
    for clave in claves:
        if clave.upper() in props_upper:
            val = str(props_upper[clave.upper()]).strip()
            if val and val.lower() != "null": return val
    for k, v in props_upper.items():
        v_str = str(v).strip()
        if not v_str or v_str.lower() == "null": continue
        if es_nombre and any(s in k for s in ["NOM", "NAM", "DESC"]) and not v_str.isdigit():
            return v_str
        elif not es_nombre and any(s in k for s in ["COD", "ID", "REF"]):
            return v_str
    return default

def construir_bd():
    # Asegurar que las localidades pendientes se intenten descargar
    import descargar_localidad_osm
    descargar_localidad_osm.ejecutar()

    features_upz = obtener_poligonos_upz()
    upz_registros, upz_geoms = [], []
    for idx, feat in enumerate(features_upz, 1):
        geom_json = feat.get("geometry")
        if not geom_json: continue
        geom_shp = shape(geom_json).buffer(0)
        if geom_shp.is_empty: continue
        props = feat.get("properties") or {}
        cod_upz = extraer_propiedad(props, ["CODIGO_UPL", "UPlCodigo", "UPZ_CODIGO", "CODIGO_UPZ", "SCACODIGO"], f"UPZ-{idx}", False)
        nom_upz = extraer_propiedad(props, ["NOMBRE", "UPlNombre", "UPZ_NOMBRE", "NOMBRE_UPZ", "SCANOMBRE"], f"Sector {cod_upz}", True)
        wkt = MultiPolygon([geom_shp]).wkt if isinstance(geom_shp, Polygon) else geom_shp.wkt
        upz_registros.append({
            "id_local": idx, "codigo_upz": cod_upz, "nombre": nom_upz.title(),
            "codigo_localidad": "", "geom": geom_shp, "wkt": wkt,
            "total_accidentes": 0, "muertos": 0, "heridos": 0, "solo_danos": 0
        })
        upz_geoms.append(geom_shp)

    tree = STRtree(upz_geoms) if upz_geoms else None

    os.makedirs(os.path.dirname(DB_BACKEND_PATH), exist_ok=True)
    if os.path.exists(DB_BACKEND_PATH):
        os.remove(DB_BACKEND_PATH)

    conn = sqlite3.connect(DB_BACKEND_PATH)
    cur = conn.cursor()

    # 1. Catalogo SpatiaLite
    cur.execute("CREATE TABLE geometry_columns (f_table_name TEXT, f_geometry_column TEXT, geometry_type TEXT, coord_dimension INTEGER, srid INTEGER, spatial_index_enabled INTEGER);")
    cur.execute("CREATE TABLE spatial_ref_sys (srid INTEGER PRIMARY KEY, auth_name TEXT, auth_srid INTEGER, ref_sys_name TEXT);")
    cur.execute("INSERT INTO spatial_ref_sys VALUES (4326, 'epsg', 4326, 'WGS 84');")
    cur.executemany("INSERT INTO geometry_columns VALUES (?, 'geom', ?, 2, 4326, 1);", [
        ("puntos_accidentes", "POINT"),
        ("calles_bogota", "LINESTRING"),
        ("upz_bogota", "MULTIPOLYGON")
    ])

    # 2. Tabla puntos_accidentes (3.406 accidentes)
    cur.execute("""
        CREATE TABLE puntos_accidentes (
            id_local INTEGER PRIMARY KEY AUTOINCREMENT,
            CODIGO_ACCIDENTE TEXT, FECHA TEXT, HORA TEXT, GRAVEDAD TEXT, GRAVEDAD_DESC TEXT,
            CLASE_DESC TEXT, CHOQUE_DESC TEXT, DIRECCION TEXT, DIRECCION_COMPLETA TEXT,
            CODIGO_LOCALIDAD TEXT, CODIGO_UPZ TEXT, NOMBRE_UPZ TEXT, geom TEXT NOT NULL
        );
    """)

    with open(PUNTOS_GEOJSON, "r", encoding="utf-8") as f:
        puntos_fc = json.load(f)

    acc_rows = []
    for feat in puntos_fc.get("features", []):
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates", [])
        if geom.get("type") != "Point" or len(coords) < 2: continue
        lon, lat = float(coords[0]), float(coords[1])
        pt = Point(lon, lat)

        upz_match = None
        if tree is not None:
            for c_idx in tree.query(pt):
                if upz_geoms[c_idx].contains(pt) or upz_geoms[c_idx].touches(pt):
                    upz_match = upz_registros[c_idx]; break
            if not upz_match and upz_geoms:
                nearest_idx = min(range(len(upz_geoms)), key=lambda i: upz_geoms[i].distance(pt))
                upz_match = upz_registros[nearest_idx]

        props = feat.get("properties") or {}
        grav = str(props.get("GRAVEDAD") or "3").strip()
        if upz_match:
            upz_match["total_accidentes"] += 1
            if grav == "1": upz_match["muertos"] += 1
            elif grav == "2": upz_match["heridos"] += 1
            else: upz_match["solo_danos"] += 1

        acc_rows.append((
            str(props.get("CODIGO_ACCIDENTE") or ""), str(props.get("FECHA") or ""), str(props.get("HORA") or ""),
            grav, str(props.get("GRAVEDAD_DESC") or "Solo daños"), str(props.get("CLASE_DESC") or ""),
            str(props.get("CHOQUE_DESC") or ""), str(props.get("DIRECCION") or ""),
            str(props.get("DIRECCION_COMPLETA") or props.get("DIRECCION") or ""),
            str(props.get("CODIGO_LOCALIDAD") or ""),
            upz_match["codigo_upz"] if upz_match else "",
            upz_match["nombre"] if upz_match else "",
            f"POINT({lon} {lat})"
        ))

    cur.executemany("INSERT INTO puntos_accidentes (CODIGO_ACCIDENTE, FECHA, HORA, GRAVEDAD, GRAVEDAD_DESC, CLASE_DESC, CHOQUE_DESC, DIRECCION, DIRECCION_COMPLETA, CODIGO_LOCALIDAD, CODIGO_UPZ, NOMBRE_UPZ, geom) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?);", acc_rows)
    cur.execute("CREATE INDEX idx_acc_fecha ON puntos_accidentes(FECHA);")
    cur.execute("CREATE INDEX idx_acc_upz ON puntos_accidentes(CODIGO_UPZ);")

    # 3. Tabla calles_bogota
    cur.execute("""
        CREATE TABLE calles_bogota (
            id_local INTEGER PRIMARY KEY AUTOINCREMENT,
            localidad TEXT, id TEXT, nom TEXT, tipo TEXT, codigo_upz TEXT, geom TEXT NOT NULL
        );
    """)

    calles_rows = []
    for ruta in sorted(glob.glob(os.path.join(LOCALIDADES_DIR, "*.geojson"))):
        loc_name = os.path.basename(ruta).replace(".geojson", "").lower()
        try:
            with open(ruta, "r", encoding="utf-8") as f:
                fc = json.load(f)
        except Exception:
            continue

        for feat in fc.get("features", []):
            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates", [])
            if geom.get("type") != "LineString" or len(coords) < 2: continue
            pts_str = ", ".join([f"{pt[0]} {pt[1]}" for pt in coords])
            pt_ini = Point(float(coords[0][0]), float(coords[0][1]))

            cod_upz_calle = ""
            if tree is not None:
                match_idx = -1
                for c_idx in tree.query(pt_ini):
                    if upz_geoms[c_idx].contains(pt_ini):
                        match_idx = c_idx; break
                if match_idx == -1 and upz_geoms:
                    match_idx = min(range(len(upz_geoms)), key=lambda i: upz_geoms[i].distance(pt_ini))
                if match_idx != -1:
                    cod_upz_calle = upz_registros[match_idx]["codigo_upz"]

            props = feat.get("properties") or {}
            calles_rows.append((
                loc_name, str(props.get("id") or ""), str(props.get("nom") or ""),
                str(props.get("tipo") or "residential"), cod_upz_calle, f"LINESTRING({pts_str})"
            ))

    cur.executemany("INSERT INTO calles_bogota (localidad, id, nom, tipo, codigo_upz, geom) VALUES (?,?,?,?,?,?);", calles_rows)
    cur.execute("CREATE INDEX idx_calles_upz ON calles_bogota(codigo_upz);")
    cur.execute("CREATE INDEX idx_calles_tipo ON calles_bogota(tipo);")

    # 4. Tabla upz_bogota
    cur.execute("""
        CREATE TABLE upz_bogota (
            id_local INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_upz TEXT, nombre TEXT, codigo_localidad TEXT,
            total_accidentes INTEGER DEFAULT 0, muertos INTEGER DEFAULT 0,
            heridos INTEGER DEFAULT 0, solo_danos INTEGER DEFAULT 0, geom TEXT NOT NULL
        );
    """)
    cur.executemany("INSERT INTO upz_bogota (id_local, codigo_upz, nombre, codigo_localidad, total_accidentes, muertos, heridos, solo_danos, geom) VALUES (?,?,?,?,?,?,?,?,?);", [
        (u["id_local"], u["codigo_upz"], u["nombre"], u["codigo_localidad"], u["total_accidentes"], u["muertos"], u["heridos"], u["solo_danos"], u["wkt"])
        for u in upz_registros
    ])

    conn.commit()
    conn.close()

    # Copiar tambien a la raiz para que DBeaver siempre vea la misma base de datos poblada
    try:
        shutil.copy2(DB_BACKEND_PATH, DB_ROOT_PATH)
    except PermissionError:
        print("Aviso: Cierra la conexion en DBeaver si deseas actualizar la copia de la raiz.")

    print("=" * 65)
    print(f"BASE DE DATOS CONSTRUIDA Y SINCRONIZADA:")
    print(f"-> Ruta Backend : {DB_BACKEND_PATH}")
    print(f"-> Ruta DBeaver : {DB_ROOT_PATH}")
    print(f"-> Accidentes   : {len(acc_rows):,}")
    print(f"-> Calles       : {len(calles_rows):,}")
    print(f"-> UPZ / UPL    : {len(upz_registros):,}")
    print("=" * 65)

if __name__ == "__main__":
    construir_bd()