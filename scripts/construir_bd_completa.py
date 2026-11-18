import csv, glob, json, os, re, shutil, sqlite3, ssl, sys, urllib.request
from shapely.geometry import shape, Point, Polygon, MultiPolygon
from shapely.strtree import STRtree

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW_DIR = os.path.join(BASE_DIR, "backend", "data", "raw")
LOCALIDADES_DIR = os.path.join(RAW_DIR, "localidades")
PUNTOS_GEOJSON = os.path.join(RAW_DIR, "puntos", "geocodificacion_Final_3406.geojson")
PUNTOS_CSV = os.path.join(RAW_DIR, "puntos", "tesis_geocodificacion_consolidada_ROOFTOP_Bogota.csv")
UPZ_GEOJSON = os.path.join(RAW_DIR, "upz", "upz_bogota.geojson")

DB_BACKEND_PATH = os.path.join(BASE_DIR, "backend", "data", "accidentes_bogota_spatialite.db")
DB_ROOT_PATH = os.path.join(BASE_DIR, "accidentes_bogota_spatialite.db")

def normalizar_fecha_iso(fecha_raw, anio_col=None, mes_col=None):
    texto = str(fecha_raw or "").strip()
    if len(texto) >= 10 and texto[4] in ("-", "/") and texto[7] in ("-", "/"):
        return f"{texto[:4]}-{texto[5:7]}-{texto[8:10]}"
    m_iso = re.match(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})", texto)
    if m_iso:
        return f"{int(m_iso.group(1)):04d}-{int(m_iso.group(2)):02d}-{int(m_iso.group(3)):02d}"
    m_lat = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})", texto)
    if m_lat:
        return f"{int(m_lat.group(3)):04d}-{int(m_lat.group(2)):02d}-{int(m_lat.group(1)):02d}"
    if anio_col and mes_col:
        try:
            return f"{int(str(anio_col).strip()):04d}-{int(str(mes_col).strip()):02d}-01"
        except ValueError:
            pass
    return texto

def inferir_codigo_gravedad(grav_val, grav_desc):
    g_str = str(grav_val or "").strip()
    if g_str in ("1", "2", "3"):
        return g_str
    desc = str(grav_desc or "").lower()
    if "muerto" in desc:
        return "1"
    if "herido" in desc:
        return "2"
    return "3"

def obtener_poligonos_upz():
    os.makedirs(os.path.dirname(UPZ_GEOJSON), exist_ok=True)
    if os.path.exists(UPZ_GEOJSON) and os.path.getsize(UPZ_GEOJSON) > 2000:
        with open(UPZ_GEOJSON, "r", encoding="utf-8") as f:
            feats = json.load(f).get("features", [])
            if feats:
                print(f"1. Usando {len(feats)} poligonos de UPZ en cache.")
                return feats

    ctx = ssl.create_default_context()
    ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    ideca_urls = [
        "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/ordenamientoterritorial/unidadplaneamientolocal/MapServer/0/query?where=1=1&outFields=*&outSR=4326&f=geojson",
        "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/espaciopublico/indicadorespaciopublico/MapServer/1/query?where=1=1&outFields=*&outSR=4326&f=geojson"
    ]
    for url in ideca_urls:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=25, context=ctx) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                feats = data.get("features", [])
                if feats:
                    with open(UPZ_GEOJSON, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False)
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
    if not os.path.exists(PUNTOS_CSV):
        print(f"[ERROR CRITICO] No existe el archivo CSV en: {PUNTOS_CSV}")
        sys.exit(1)

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
        try:
            os.remove(DB_BACKEND_PATH)
        except PermissionError:
            print("[ERROR CRITICO] El archivo backend/data/accidentes_bogota_spatialite.db esta bloqueado por Spring Boot o DBeaver. Deten Spring Boot (Ctrl+C) e intenta de nuevo.")
            sys.exit(1)

    conn = sqlite3.connect(DB_BACKEND_PATH)
    cur = conn.cursor()

    cur.execute("CREATE TABLE geometry_columns (f_table_name TEXT, f_geometry_column TEXT, geometry_type TEXT, coord_dimension INTEGER, srid INTEGER, spatial_index_enabled INTEGER);")
    cur.execute("CREATE TABLE spatial_ref_sys (srid INTEGER PRIMARY KEY, auth_name TEXT, auth_srid INTEGER, ref_sys_name TEXT);")
    cur.execute("INSERT INTO spatial_ref_sys VALUES (4326, 'epsg', 4326, 'WGS 84');")
    cur.executemany("INSERT INTO geometry_columns VALUES (?, 'geom', ?, 2, 4326, 1);", [
        ("puntos_accidentes", "POINT"),
        ("calles_bogota", "LINESTRING"),
        ("upz_bogota", "MULTIPOLYGON")
    ])

    cur.execute("""
        CREATE TABLE puntos_accidentes (
            id_local INTEGER PRIMARY KEY AUTOINCREMENT,
            CODIGO_ACCIDENTE TEXT UNIQUE, FECHA TEXT, HORA TEXT, GRAVEDAD TEXT, GRAVEDAD_DESC TEXT,
            CLASE_DESC TEXT, CHOQUE_DESC TEXT, DIRECCION TEXT, DIRECCION_COMPLETA TEXT,
            CODIGO_LOCALIDAD TEXT, CODIGO_UPZ TEXT, NOMBRE_UPZ TEXT, geom TEXT NOT NULL
        );
    """)

    codigos_vistos = set()
    acc_rows = []
    duplicados_omitidos = 0
    conteo_csv = 0
    conteo_geojson = 0

    def registrar_punto(cod_acc, fecha, anio_col, mes_col, hora, grav_raw, grav_desc, clase_desc, choque_desc, dir_corta, dir_comp, cod_loc, lon, lat):
        nonlocal duplicados_omitidos
        cod_clean = str(cod_acc or "").strip()
        if cod_clean.endswith(".0"):
            cod_clean = cod_clean[:-2]
        if cod_clean:
            if cod_clean in codigos_vistos:
                duplicados_omitidos += 1
                return False
            codigos_vistos.add(cod_clean)

        fecha_norm = normalizar_fecha_iso(fecha, anio_col, mes_col)
        pt = Point(lon, lat)
        upz_match = None
        if tree is not None:
            for c_idx in tree.query(pt):
                if upz_geoms[c_idx].contains(pt) or upz_geoms[c_idx].touches(pt):
                    upz_match = upz_registros[c_idx]; break
            if not upz_match and upz_geoms:
                nearest_idx = min(range(len(upz_geoms)), key=lambda i: upz_geoms[i].distance(pt))
                upz_match = upz_registros[nearest_idx]

        grav_code = inferir_codigo_gravedad(grav_raw, grav_desc)
        if upz_match:
            upz_match["total_accidentes"] += 1
            if grav_code == "1": upz_match["muertos"] += 1
            elif grav_code == "2": upz_match["heridos"] += 1
            else: upz_match["solo_danos"] += 1

        acc_rows.append((
            cod_clean, fecha_norm, str(hora or "").strip(),
            grav_code, str(grav_desc or "Solo daños").strip(), str(clase_desc or "").strip(),
            str(choque_desc or "Vehículo").strip(), str(dir_corta or "").strip(),
            str(dir_comp or dir_corta or "").strip(), str(cod_loc or "").strip(),
            upz_match["codigo_upz"] if upz_match else "",
            upz_match["nombre"] if upz_match else "",
            f"POINT({lon} {lat})"
        ))
        return True

    # 1. Leer CSV Nuevo (6.321 registros 2015-2020)
    print(f"2. Procesando CSV consolidado: {PUNTOS_CSV}...")
    with open(PUNTOS_CSV, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                lat = float(str(row.get("LATITUD", "")).replace(",", ".").strip())
                lon = float(str(row.get("LONGITUD", "")).replace(",", ".").strip())
            except ValueError:
                continue
            if registrar_punto(
                row.get("CODIGO_ACCIDENTE"), row.get("FECHA"), row.get("ANIO"), row.get("MES"),
                row.get("HORA"), row.get("GRAVEDAD"), row.get("GRAVEDAD_DESC"), row.get("CLASE_DESC"),
                row.get("CHOQUE_DESC"), row.get("DIRECCION"), row.get("DIRECCION_COMPLETA"),
                row.get("CODIGO_LOCALIDAD"), lon, lat
            ):
                conteo_csv += 1
    print(f"   -> Insertados desde CSV nuevo: {conteo_csv:,} siniestros.")

    # 2. Fusionar con GeoJSON anterior (3.406 registros) omitiendo duplicados
    if os.path.exists(PUNTOS_GEOJSON):
        print(f"3. Fusionando con GeoJSON anterior: {os.path.basename(PUNTOS_GEOJSON)}...")
        with open(PUNTOS_GEOJSON, "r", encoding="utf-8") as f:
            puntos_fc = json.load(f)
        for feat in puntos_fc.get("features", []):
            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates", [])
            if geom.get("type") != "Point" or len(coords) < 2: continue
            lon, lat = float(coords[0]), float(coords[1])
            props = feat.get("properties") or {}
            if registrar_punto(
                props.get("CODIGO_ACCIDENTE"), props.get("FECHA"), props.get("ANIO"), props.get("MES"),
                props.get("HORA"), props.get("GRAVEDAD"), props.get("GRAVEDAD_DESC"), props.get("CLASE_DESC"),
                props.get("CHOQUE_DESC"), props.get("DIRECCION"), props.get("DIRECCION_COMPLETA"),
                props.get("CODIGO_LOCALIDAD"), lon, lat
            ):
                conteo_geojson += 1
        print(f"   -> Adicionales unicos desde GeoJSON: {conteo_geojson:,} (Duplicados omitidos: {duplicados_omitidos:,}).")

    cur.executemany("""
        INSERT OR IGNORE INTO puntos_accidentes (
            CODIGO_ACCIDENTE, FECHA, HORA, GRAVEDAD, GRAVEDAD_DESC, CLASE_DESC,
            CHOQUE_DESC, DIRECCION, DIRECCION_COMPLETA, CODIGO_LOCALIDAD, CODIGO_UPZ, NOMBRE_UPZ, geom
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?);
    """, acc_rows)
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

    # AUDITORIA REAL DESDE SQLITE
    resumen_anios = cur.execute("SELECT substr(FECHA,1,4) AS anio, COUNT(*) FROM puntos_accidentes GROUP BY anio ORDER BY anio DESC;").fetchall()
    resumen_meses = cur.execute("SELECT substr(FECHA,6,2) AS mes, COUNT(*) FROM puntos_accidentes GROUP BY mes ORDER BY mes ASC;").fetchall()
    total_final = cur.execute("SELECT COUNT(*) FROM puntos_accidentes;").fetchone()[0]
    conn.close()

    try:
        shutil.copy2(DB_BACKEND_PATH, DB_ROOT_PATH)
    except PermissionError:
        print("Aviso: No se pudo copiar a la raiz porque DBeaver la tiene abierta, pero backend/data/ ya fue actualizada.")

    print("\n" + "=" * 68)
    print(f"AUDITORIA SQLITE DE PUNTOS_ACCIDENTES (TOTAL: {total_final:,} SINIESTROS)")
    print("=" * 68)
    print("Distribución por Año en la Base de Datos:")
    for a, c in resumen_anios:
        print(f"   * Año {a}: {c:,} accidentes")
    print("\nDistribución por Mes en la Base de Datos:")
    print("   " + ", ".join([f"Mes {m}: {c}" for m, c in resumen_meses]))
    print("=" * 68)

if __name__ == "__main__":
    construir_bd()