package com.tesis.accidentes.backend.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Repositorio de acceso a datos para las tablas espaciales calles_bogota y puntos_accidentes.
 */
@Repository
public class MapaRepository {

    private final JdbcTemplate jdbcTemplate;

    public MapaRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Consulta los segmentos viales filtrados opcionalmente por clave de localidad.
     */
    public List<Map<String, Object>> findCalles(String localidad) {
        if (localidad != null && !localidad.isBlank() && !localidad.equalsIgnoreCase("all_city")) {
            String sql = "SELECT id, nom, tipo, localidad, geom FROM calles_bogota WHERE LOWER(localidad) = LOWER(?)";
            return jdbcTemplate.queryForList(sql, localidad.trim());
        }
        return jdbcTemplate.queryForList("SELECT id, nom, tipo, localidad, geom FROM calles_bogota");
    }

    /**
     * Consulta los siniestros viales filtrados opcionalmente por codigo de localidad y anio.
     */
    public List<Map<String, Object>> findAccidentes(String codigoLocalidad, String anio) {
        StringBuilder sql = new StringBuilder(
                "SELECT id_local, CODIGO_ACCIDENTE, FECHA, HORA, GRAVEDAD, GRAVEDAD_DESC, " +
                "CLASE_DESC, CHOQUE_DESC, DIRECCION, DIRECCION_COMPLETA, CODIGO_LOCALIDAD, geom " +
                "FROM puntos_accidentes WHERE 1=1"
        );
        List<Object> params = new ArrayList<>();

        if (codigoLocalidad != null && !codigoLocalidad.isBlank() && !codigoLocalidad.equalsIgnoreCase("all")) {
            sql.append(" AND CAST(CODIGO_LOCALIDAD AS TEXT) = ?");
            params.add(codigoLocalidad.trim());
        }

        if (anio != null && !anio.isBlank() && !anio.equalsIgnoreCase("all")) {
            sql.append(" AND FECHA LIKE ?");
            params.add("%" + anio.trim() + "%");
        }

        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    /**
     * Obtiene la lista ordenada de anios disponibles en los registros de siniestralidad.
     */
    public List<String> findAniosDisponibles() {
        String sql = "SELECT DISTINCT SUBSTR(TRIM(FECHA), 1, 4) AS anio " +
                     "FROM puntos_accidentes " +
                     "WHERE FECHA IS NOT NULL AND LENGTH(TRIM(FECHA)) >= 4 " +
                     "ORDER BY anio DESC";
        List<String> rawYears = jdbcTemplate.queryForList(sql, String.class);
        return rawYears.stream()
                .filter(y -> y != null && y.matches("\\d{4}"))
                .toList();
    }
}
