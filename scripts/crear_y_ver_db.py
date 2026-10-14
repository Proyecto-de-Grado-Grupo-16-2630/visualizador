import sqlite3
import os
import re

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ARCHIVO_SQL = os.path.join(BASE_DIR, "accidentes_bogota_spatialite.sql")
ARCHIVO_DB = os.path.join(BASE_DIR, "accidentes_bogota_spatialite.db")

def main():
    if not os.path.exists(ARCHIVO_SQL):
        print(f"Error: No se encontró '{os.path.relpath(ARCHIVO_SQL, BASE_DIR)}'. Ejecuta primero cargar_spatialite.py.")
        return

    if os.path.exists(ARCHIVO_DB):
        try:
            os.remove(ARCHIVO_DB)
        except PermissionError:
            print(f"Error: '{os.path.basename(ARCHIVO_DB)}' está en uso (probablemente en DBeaver). Desconéctalo e inténtalo de nuevo.")
            return

    print(f"1. Creando base de datos '{os.path.basename(ARCHIVO_DB)}'...")
    
    # isolation_level = None permite que SQLite gestione BEGIN TRANSACTION / COMMIT sin conflicto con Python
    conn = sqlite3.connect(ARCHIVO_DB)
    conn.isolation_level = None
    cursor = conn.cursor()

    # Tablas del catálogo oficial SpatiaLite
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS geometry_columns (
        f_table_name TEXT,
        f_geometry_column TEXT,
        geometry_type TEXT,
        coord_dimension INTEGER,
        srid INTEGER,
        spatial_index_enabled INTEGER
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS spatial_ref_sys (
        srid INTEGER PRIMARY KEY,
        auth_name TEXT,
        auth_srid INTEGER,
        ref_sys_name TEXT
    );
    """)
    cursor.execute("INSERT OR IGNORE INTO spatial_ref_sys VALUES (4326, 'epsg', 4326, 'WGS 84');")

    # Registro de la función GeomFromText
    conn.create_function("GeomFromText", 2, lambda wkt, srid: wkt)

    re_add_geom = re.compile(r"SELECT AddGeometryColumn\('([^']+)',\s*'([^']+)',\s*(\d+),\s*'([^']+)',\s*'([^']+)'\)", re.IGNORECASE)

    print("2. Ejecutando sentencias del archivo SQL...")
    with open(ARCHIVO_SQL, "r", encoding="utf-8") as f:
        for linea in f:
            l = linea.strip()
            if not l or l.startswith("--"):
                continue

            # Omitir funciones de C nativas no requeridas en esta fase
            if "InitSpatialMetaData" in l or "CreateSpatialIndex" in l:
                continue

            # Interceptar AddGeometryColumn para registrar en el catálogo y agregar la columna
            match_geom = re_add_geom.search(l)
            if match_geom:
                tabla, col, srid, tipo_geom, dim = match_geom.groups()
                cursor.execute(f'ALTER TABLE "{tabla}" ADD COLUMN "{col}" {tipo_geom};')
                cursor.execute(
                    "INSERT INTO geometry_columns VALUES (?, ?, ?, ?, ?, ?);",
                    (tabla, col, tipo_geom, 2, int(srid), 1)
                )
                continue

            try:
                cursor.execute(l)
            except Exception as err:
                print(f"Aviso en sentencia: {err}")

    print("-> Base de datos construida con éxito.\n")

    # =========================================================================
    # VERIFICACIÓN DE TABLAS Y CONTEOS
    # =========================================================================
    total_acc = 0
    total_calles = 0

    try:
        cursor.execute("SELECT COUNT(*) FROM puntos_accidentes;")
        total_acc = cursor.fetchone()[0]
    except Exception as e:
        print(f"Error consultando puntos_accidentes: {e}")

    try:
        cursor.execute("SELECT COUNT(*) FROM calles_bogota;")
        total_calles = cursor.fetchone()[0]
    except Exception as e:
        print(f"Error consultando calles_bogota: {e}")

    print("=" * 80)
    print("CATÁLOGO ESPACIAL (geometry_columns):")
    print("=" * 80)
    cursor.execute("SELECT f_table_name, f_geometry_column, geometry_type, srid FROM geometry_columns;")
    for r in cursor.fetchall():
        print(f"{r[0]:<25} | {r[1]:<15} | {r[2]:<12} | {r[3]}")

    print("\n" + "=" * 80)
    print("CONTEOS TOTALES:")
    print("=" * 80)
    print(f"Total Accidentes registrados : {total_acc:,}")
    print(f"Total Calles de Bogotá       : {total_calles:,}")

    if total_acc > 0:
        print("\n" + "=" * 80)
        print("MUESTRA: 3 ACCIDENTES (POINT WGS84):")
        print("=" * 80)
        cursor.execute("SELECT id_local, CODIGO_ACCIDENTE, DIRECCION, geom FROM puntos_accidentes LIMIT 3;")
        for r in cursor.fetchall():
            print(f"ID: {r[0]} | Código: {r[1]} | Dir: {r[2]}\nGeom: {r[3]}\n" + "-" * 40)

    if total_calles > 0:
        print("\n" + "=" * 80)
        print("MUESTRA: 3 VÍAS (LINESTRING WGS84):")
        print("=" * 80)
        cursor.execute("SELECT id_local, localidad, nom, tipo, geom FROM calles_bogota LIMIT 3;")
        for r in cursor.fetchall():
            nombre = r[2] if r[2] and r[2] != "NULL" else "Sin Nombre"
            geom_str = r[4][:65] + "..." if len(r[4]) > 65 else r[4]
            print(f"ID: {r[0]} | Localidad: {r[1]} | Vía: {nombre} | Tipo: {r[3]}\nGeom: {geom_str}\n" + "-" * 40)

    conn.close()

if __name__ == "__main__":
    main()