import json
import os
import glob

# Rutas relativas calculadas desde la raíz del proyecto
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CARPETA_LOCALIDADES = os.path.join(BASE_DIR, "frontend", "public", "data", "localidades")
ARCHIVO_PUNTOS = os.path.join(BASE_DIR, "frontend", "public", "data", "puntos", "geocodificacion_Final_3406.geojson")
DB_SQL_OUTPUT = os.path.join(BASE_DIR, "accidentes_bogota_spatialite.sql")

def escapar(texto):
    if texto is None:
        return "NULL"
    limpio = str(texto).replace("'", "''").strip()
    return f"'{limpio}'" if limpio else "NULL"

def main():
    sql = []
    
    sql.append("-- ====================================================================")
    sql.append("-- METADATOS Y CATÁLOGO SPATIALITE (EPSG 4326)")
    sql.append("-- ====================================================================")
    sql.append("SELECT InitSpatialMetaData(1);")
    sql.append("")

    # =========================================================================
    # 1. TABLA: PUNTOS DE ACCIDENTES (POINT)
    # =========================================================================
    print(f"1. Leyendo accidentes desde '{os.path.relpath(ARCHIVO_PUNTOS, BASE_DIR)}'...")
    if os.path.exists(ARCHIVO_PUNTOS):
        with open(ARCHIVO_PUNTOS, "r", encoding="utf-8") as f:
            data_puntos = json.load(f)

        features_puntos = data_puntos.get("features", [])
        
        keys_puntos = set()
        for feat in features_puntos:
            if feat.get("properties"):
                keys_puntos.update(feat["properties"].keys())
        cols_puntos = sorted(keys_puntos)

        sql.append("DROP TABLE IF EXISTS puntos_accidentes;")
        cols_def = ", ".join([f'"{c}" TEXT' for c in cols_puntos])
        sql.append(f"CREATE TABLE puntos_accidentes (id_local INTEGER PRIMARY KEY AUTOINCREMENT, {cols_def});")
        sql.append("SELECT AddGeometryColumn('puntos_accidentes', 'geom', 4326, 'POINT', 'XY');")
        sql.append("SELECT CreateSpatialIndex('puntos_accidentes', 'geom');")
        sql.append("")

        sql.append("BEGIN TRANSACTION;")
        insertados_pts = 0

        for feat in features_puntos:
            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates", [])

            if geom.get("type") == "Point" and len(coords) >= 2:
                lon, lat = coords[0], coords[1]
                wkt_point = f"GeomFromText('POINT({lon} {lat})', 4326)"
                
                props = feat.get("properties") or {}
                vals = [escapar(props.get(k)) for k in cols_puntos]
                cols_str = ", ".join([f'"{c}"' for c in cols_puntos])
                vals_str = ", ".join(vals)
                
                sql.append(f"INSERT INTO puntos_accidentes ({cols_str}, geom) VALUES ({vals_str}, {wkt_point});")
                insertados_pts += 1

        sql.append("COMMIT;")
        sql.append("")
        print(f"   -> {insertados_pts:,} puntos de accidentes procesados exitosamente.")
    else:
        print(f"   [Error] No se encontró el archivo de puntos en: {ARCHIVO_PUNTOS}")

    # =========================================================================
    # 2. TABLA: CALLES DE TODAS LAS LOCALIDADES (LINESTRING)
    # =========================================================================
    print(f"\n2. Leyendo archivos viales desde '{os.path.relpath(CARPETA_LOCALIDADES, BASE_DIR)}'...")
    archivos_geojson = glob.glob(os.path.join(CARPETA_LOCALIDADES, "*.geojson"))

    if archivos_geojson:
        # Explorar propiedades dinámicas de las vías
        keys_calles = set()
        for ruta in archivos_geojson:
            try:
                with open(ruta, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for feat in data.get("features", []):
                        if feat.get("properties"):
                            keys_calles.update(feat["properties"].keys())
            except Exception:
                continue

        cols_calles = sorted(keys_calles)
        sql.append("DROP TABLE IF EXISTS calles_bogota;")
        
        # Incluye columna para identificar la localidad de procedencia
        cols_def_calles = ", ".join([f'"{c}" TEXT' for c in cols_calles])
        sql.append(f"CREATE TABLE calles_bogota (id_local INTEGER PRIMARY KEY AUTOINCREMENT, localidad TEXT, {cols_def_calles});")
        sql.append("SELECT AddGeometryColumn('calles_bogota', 'geom', 4326, 'LINESTRING', 'XY');")
        sql.append("SELECT CreateSpatialIndex('calles_bogota', 'geom');")
        sql.append("")

        sql.append("BEGIN TRANSACTION;")
        total_vias = 0

        for ruta in archivos_geojson:
            nombre_loc = os.path.basename(ruta).replace(".geojson", "").lower()
            try:
                with open(ruta, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as err:
                print(f"   [Aviso] Omitiendo {nombre_loc}: {err}")
                continue

            vias_localidad = 0
            for feat in data.get("features", []):
                geom = feat.get("geometry") or {}
                coords = geom.get("coordinates", [])

                if geom.get("type") == "LineString" and len(coords) >= 2:
                    pts_str = ", ".join([f"{pt[0]} {pt[1]}" for pt in coords])
                    wkt_line = f"GeomFromText('LINESTRING({pts_str})', 4326)"

                    props = feat.get("properties") or {}
                    vals = [escapar(props.get(k)) for k in cols_calles]

                    cols_str = ", ".join([f'"{c}"' for c in cols_calles])
                    vals_str = ", ".join(vals)

                    sql.append(f"INSERT INTO calles_bogota (localidad, {cols_str}, geom) VALUES ('{nombre_loc}', {vals_str}, {wkt_line});")
                    vias_localidad += 1

            total_vias += vias_localidad
            print(f"   -> {nombre_loc:<16}: {vias_localidad:,} tramos.")

        sql.append("COMMIT;")
        sql.append("")
        print(f"   -> Total de vías procesadas en Bogotá: {total_vias:,}")
    else:
        print(f"   [Error] No se encontraron archivos .geojson en: {CARPETA_LOCALIDADES}")

    # Guardar archivo .sql en la raíz
    with open(DB_SQL_OUTPUT, "w", encoding="utf-8") as f:
        f.write("\n".join(sql))

    print(f"\nArchivo SpatiaLite generado en la raíz: '{os.path.basename(DB_SQL_OUTPUT)}'")

if __name__ == "__main__":
    main()