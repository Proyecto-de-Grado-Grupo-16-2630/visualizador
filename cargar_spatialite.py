import json
import os

DB_SQL_OUTPUT = "accidentes_bogota_spatialite.sql"
GEOJSON_PUNTOS = "2500_geocodificados_2498.geojson"
GEOJSON_CALLES = "usaquen.geojson"

MAX_CALLES = 200
MAX_PUNTOS = 400

SOLO_PUNTOS_USAQUEN = False

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

    print(f"Leyendo {GEOJSON_PUNTOS}...")
    if os.path.exists(GEOJSON_PUNTOS):
        with open(GEOJSON_PUNTOS, "r", encoding="utf-8") as f:
            data_puntos = json.load(f)

        features_puntos = data_puntos.get("features", [])
        
        # Extraer nombres de atributos
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
            if insertados_pts >= MAX_PUNTOS:
                break

            props = feat.get("properties") or {}
            
            # Filtro opcional por localidad
            if SOLO_PUNTOS_USAQUEN and str(props.get("CODIGO_LOCALIDAD", "")).strip() != "1":
                continue

            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates", [])

            if geom.get("type") == "Point" and len(coords) >= 2:
                lon, lat = coords[0], coords[1]
                wkt_point = f"GeomFromText('POINT({lon} {lat})', 4326)"
                
                vals = [escapar(props.get(k)) for k in cols_puntos]
                cols_str = ", ".join([f'"{c}"' for c in cols_puntos])
                vals_str = ", ".join(vals)
                
                sql.append(f"INSERT INTO puntos_accidentes ({cols_str}, geom) VALUES ({vals_str}, {wkt_point});")
                insertados_pts += 1

        sql.append("COMMIT;")
        sql.append("")
        print(f"-> {insertados_pts} puntos de accidentes preparados (tope: {MAX_PUNTOS}).")
    else:
        print(f"No se encontró {GEOJSON_PUNTOS}")

    print(f"\nLeyendo {GEOJSON_CALLES}...")
    if os.path.exists(GEOJSON_CALLES):
        with open(GEOJSON_CALLES, "r", encoding="utf-8") as f:
            data_calles = json.load(f)

        features_calles = data_calles.get("features", [])

        keys_calles = set()
        for feat in features_calles:
            if feat.get("properties"):
                keys_calles.update(feat["properties"].keys())
        cols_calles = sorted(keys_calles)

        sql.append("DROP TABLE IF EXISTS calles_usaquen;")
        cols_def_calles = ", ".join([f'"{c}" TEXT' for c in cols_calles])
        sql.append(f"CREATE TABLE calles_usaquen (id_local INTEGER PRIMARY KEY AUTOINCREMENT, {cols_def_calles});")
        sql.append("SELECT AddGeometryColumn('calles_usaquen', 'geom', 4326, 'LINESTRING', 'XY');")
        sql.append("SELECT CreateSpatialIndex('calles_usaquen', 'geom');")
        sql.append("")

        sql.append("BEGIN TRANSACTION;")
        insertadas_calles = 0

        for feat in features_calles:
            if insertadas_calles >= MAX_CALLES:
                break

            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates", [])

            if geom.get("type") == "LineString" and len(coords) >= 2:
                pts_str = ", ".join([f"{pt[0]} {pt[1]}" for pt in coords])
                wkt_line = f"GeomFromText('LINESTRING({pts_str})', 4326)"
                
                props = feat.get("properties") or {}
                vals = [escapar(props.get(k)) for k in cols_calles]
                
                cols_str = ", ".join([f'"{c}"' for c in cols_calles])
                vals_str = ", ".join(vals)
                
                sql.append(f"INSERT INTO calles_usaquen ({cols_str}, geom) VALUES ({vals_str}, {wkt_line});")
                insertadas_calles += 1

        sql.append("COMMIT;")
        sql.append("")
        print(f"-> {insertadas_calles} vías LineString preparadas (tope: {MAX_CALLES}).")
    else:
        print(f"No se encontró {GEOJSON_CALLES}")

    # Guardar archivo .sql
    with open(DB_SQL_OUTPUT, "w", encoding="utf-8") as f:
        f.write("\n".join(sql))

    print(f"\nArchivo SpatiaLite generado: '{DB_SQL_OUTPUT}'")

if __name__ == "__main__":
    main()