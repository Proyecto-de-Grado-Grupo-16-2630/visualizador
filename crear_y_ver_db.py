import sqlite3
import os
import re

ARCHIVO_SQL = "accidentes_bogota_spatialite.sql"
ARCHIVO_DB = "accidentes_bogota_spatialite.db"

def main():
    if not os.path.exists(ARCHIVO_SQL):
        print(f"Error: No se encontró el archivo '{ARCHIVO_SQL}' en la raíz.")
        return

    # Si ya existe una versión previa incompleta, la eliminamos
    if os.path.exists(ARCHIVO_DB):
        os.remove(ARCHIVO_DB)

    print(f"1. Creando base de datos '{ARCHIVO_DB}' desde '{ARCHIVO_SQL}'...")
    conn = sqlite3.connect(ARCHIVO_DB)
    cursor = conn.cursor()

    # Catálogo maestro oficial de SpatiaLite
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

    # Función para procesar GeomFromText y almacenar la geometría WKT
    conn.create_function("GeomFromText", 2, lambda wkt, srid: wkt)

    re_add_geom = re.compile(r"SELECT AddGeometryColumn\('([^']+)',\s*'([^']+)',\s*(\d+),\s*'([^']+)',\s*'([^']+)'\)", re.IGNORECASE)

    with open(ARCHIVO_SQL, "r", encoding="utf-8") as f:
        for linea in f:
            l = linea.strip()
            if not l or l.startswith("--"):
                continue

            # Omitir inicializaciones nativas de C
            if "InitSpatialMetaData" in l or "CreateSpatialIndex" in l:
                continue

            # Interceptar AddGeometryColumn para registrar en geometry_columns y alterar la tabla
            match_geom = re_add_geom.search(l)
            if match_geom:
                tabla, col, srid, tipo_geom, dim = match_geom.groups()
                cursor.execute(f'ALTER TABLE "{tabla}" ADD COLUMN "{col}" {tipo_geom};')
                cursor.execute(
                    "INSERT INTO geometry_columns VALUES (?, ?, ?, ?, ?, ?);",
                    (tabla, col, tipo_geom, 2, int(srid), 1)
                )
                continue

            # Ejecutar sentencias SQL (CREATE TABLE, INSERT, BEGIN, COMMIT)
            try:
                cursor.execute(l)
            except Exception as err:
                print(f"Aviso en sentencia: {err}")

    conn.commit()
    print("-> Base de datos construida con éxito.\n")

    # =========================================================================
    # VISUALIZACIÓN DE LAS TABLAS
    # =========================================================================
    print("=" * 80)
    print("CATÁLOGO ESPACIAL (geometry_columns):")
    print("=" * 80)
    cursor.execute("SELECT f_table_name, f_geometry_column, geometry_type, srid FROM geometry_columns;")
    filas_cat = cursor.fetchall()
    print(f"{'Tabla':<25} | {'Columna Geom':<15} | {'Tipo':<12} | {'SRID'}")
    print("-" * 80)
    for r in filas_cat:
        print(f"{r[0]:<25} | {r[1]:<15} | {r[2]:<12} | {r[3]}")

    print("\n" + "=" * 80)
    print("CONTEOS TOTALES:")
    print("=" * 80)
    cursor.execute("SELECT COUNT(*) FROM puntos_accidentes;")
    total_acc = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM calles_usaquen;")
    total_calles = cursor.fetchone()[0]
    print(f"Total Accidentes registrados: {total_acc} (Esperado: 400)")
    print(f"Total Calles registradas:     {total_calles} (Esperado: 200)")

    print("\n" + "=" * 80)
    print("MUESTRA: 3 ACCIDENTES (puntos_accidentes con geometría POINT):")
    print("=" * 80)
    cursor.execute("SELECT id_local, CODIGO_ACCIDENTE, DIRECCION, geom FROM puntos_accidentes LIMIT 3;")
    for r in cursor.fetchall():
        print(f"ID: {r[0]} | Código: {r[1]} | Dir: {r[2]}\nGeom: {r[3]}\n" + "-" * 40)

    print("\n" + "=" * 80)
    print("MUESTRA: 3 VÍAS (calles_usaquen con geometría LINESTRING):")
    print("=" * 80)
    cursor.execute("SELECT id_local, nom, tipo, geom FROM calles_usaquen LIMIT 3;")
    for r in cursor.fetchall():
        nombre = r[1] if r[1] != "NULL" else "Sin Nombre"
        geom_str = r[3][:65] + "..." if len(r[3]) > 65 else r[3]
        print(f"ID: {r[0]} | Nombre: {nombre} | Tipo: {r[2]}\nGeom: {geom_str}\n" + "-" * 40)

    conn.close()

if __name__ == "__main__":
    main()