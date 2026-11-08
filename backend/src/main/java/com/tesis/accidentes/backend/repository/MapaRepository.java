package com.tesis.accidentes.backend.repository;

import com.tesis.accidentes.backend.dto.GeoJsonFeatureDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public class MapaRepository {

    private final JdbcTemplate jdbcTemplate;

    public MapaRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<GeoJsonFeatureDto> findCalles(String localidad, String codigoUpz) {
        StringBuilder sql = new StringBuilder(
            "SELECT id_local, id, nom, tipo, localidad, codigo_upz, geom FROM calles_bogota WHERE 1=1"
        );
        List<Object> params = new ArrayList<>();

        if (localidad != null && !localidad.isBlank() && !localidad.equalsIgnoreCase("all_city") && !localidad.equalsIgnoreCase("none") && !localidad.equalsIgnoreCase("all")) {
            sql.append(" AND LOWER(localidad) = LOWER(?)");
            params.add(localidad.trim());
        }

        if (codigoUpz != null && !codigoUpz.isBlank() && !codigoUpz.equalsIgnoreCase("all")) {
            sql.append(" AND codigo_upz = ?");
            params.add(codigoUpz.trim());
        }

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> {
            Map<String, Object> props = new HashMap<>();
            props.put("id_local", rs.getInt("id_local"));
            props.put("id", rs.getString("id"));
            props.put("nom", rs.getString("nom"));
            props.put("tipo", rs.getString("tipo"));
            props.put("localidad", rs.getString("localidad"));
            props.put("codigo_upz", rs.getString("codigo_upz"));

            Map<String, Object> geometry = parseWktToGeoJsonGeometry(rs.getString("geom"));
            return new GeoJsonFeatureDto(props, geometry);
        }, params.toArray());
    }

    public List<GeoJsonFeatureDto> findAccidentes(String codigoLocalidad, String anio, String mes, String dia, String codigoUpz) {
        StringBuilder sql = new StringBuilder(
            "SELECT id_local, CODIGO_ACCIDENTE, FECHA, HORA, GRAVEDAD, GRAVEDAD_DESC, " +
            "CLASE_DESC, CHOQUE_DESC, DIRECCION, DIRECCION_COMPLETA, CODIGO_LOCALIDAD, " +
            "CODIGO_UPZ, NOMBRE_UPZ, geom FROM puntos_accidentes WHERE 1=1"
        );
        List<Object> params = new ArrayList<>();

        if (codigoLocalidad != null && !codigoLocalidad.isBlank() && !codigoLocalidad.equalsIgnoreCase("all")) {
            sql.append(" AND CAST(CODIGO_LOCALIDAD AS TEXT) = ?");
            params.add(codigoLocalidad.trim());
        }

        if (anio != null && !anio.isBlank() && !anio.equalsIgnoreCase("all")) {
            sql.append(" AND substr(FECHA, 1, 4) = ?");
            params.add(anio.trim());
        }

        if (mes != null && !mes.isBlank() && !mes.equalsIgnoreCase("all")) {
            String mesPad = mes.trim().length() == 1 ? "0" + mes.trim() : mes.trim();
            sql.append(" AND substr(FECHA, 6, 2) = ?");
            params.add(mesPad);
        }

        if (dia != null && !dia.isBlank() && !dia.equalsIgnoreCase("all")) {
            String diaPad = dia.trim().length() == 1 ? "0" + dia.trim() : dia.trim();
            sql.append(" AND substr(FECHA, 9, 2) = ?");
            params.add(diaPad);
        }

        if (codigoUpz != null && !codigoUpz.isBlank() && !codigoUpz.equalsIgnoreCase("all")) {
            sql.append(" AND CODIGO_UPZ = ?");
            params.add(codigoUpz.trim());
        }

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> {
            Map<String, Object> props = new HashMap<>();
            props.put("id_local", rs.getInt("id_local"));
            props.put("CODIGO_ACCIDENTE", rs.getString("CODIGO_ACCIDENTE"));
            props.put("FECHA", rs.getString("FECHA"));
            props.put("HORA", rs.getString("HORA"));
            props.put("GRAVEDAD", rs.getString("GRAVEDAD"));
            props.put("GRAVEDAD_DESC", rs.getString("GRAVEDAD_DESC"));
            props.put("CLASE_DESC", rs.getString("CLASE_DESC"));
            props.put("CHOQUE_DESC", rs.getString("CHOQUE_DESC"));
            props.put("DIRECCION", rs.getString("DIRECCION"));
            props.put("DIRECCION_COMPLETA", rs.getString("DIRECCION_COMPLETA"));
            props.put("CODIGO_LOCALIDAD", rs.getString("CODIGO_LOCALIDAD"));
            props.put("CODIGO_UPZ", rs.getString("CODIGO_UPZ"));
            props.put("NOMBRE_UPZ", rs.getString("NOMBRE_UPZ"));

            Map<String, Object> geometry = parseWktToGeoJsonGeometry(rs.getString("geom"));
            return new GeoJsonFeatureDto(props, geometry);
        }, params.toArray());
    }

    public List<GeoJsonFeatureDto> findUpzPolygons(String codigoLocalidad, String anio, String mes, String dia) {
        StringBuilder sql = new StringBuilder(
            "SELECT u.id_local, u.codigo_upz, u.nombre, u.codigo_localidad, u.geom, " +
            "COUNT(p.id_local) AS total_accidentes, " +
            "SUM(CASE WHEN CAST(p.GRAVEDAD AS TEXT) = '1' THEN 1 ELSE 0 END) AS muertos, " +
            "SUM(CASE WHEN CAST(p.GRAVEDAD AS TEXT) = '2' THEN 1 ELSE 0 END) AS heridos, " +
            "SUM(CASE WHEN CAST(p.GRAVEDAD AS TEXT) = '3' THEN 1 ELSE 0 END) AS solo_danos " +
            "FROM upz_bogota u " +
            "LEFT JOIN puntos_accidentes p ON u.codigo_upz = p.CODIGO_UPZ"
        );
        List<Object> params = new ArrayList<>();

        if (anio != null && !anio.isBlank() && !anio.equalsIgnoreCase("all")) {
            sql.append(" AND substr(p.FECHA, 1, 4) = ?");
            params.add(anio.trim());
        }

        if (mes != null && !mes.isBlank() && !mes.equalsIgnoreCase("all")) {
            String mesPad = mes.trim().length() == 1 ? "0" + mes.trim() : mes.trim();
            sql.append(" AND substr(p.FECHA, 6, 2) = ?");
            params.add(mesPad);
        }

        if (dia != null && !dia.isBlank() && !dia.equalsIgnoreCase("all")) {
            String diaPad = dia.trim().length() == 1 ? "0" + dia.trim() : dia.trim();
            sql.append(" AND substr(p.FECHA, 9, 2) = ?");
            params.add(diaPad);
        }

        sql.append(" WHERE 1=1");
        if (codigoLocalidad != null && !codigoLocalidad.isBlank() && !codigoLocalidad.equalsIgnoreCase("all")) {
            sql.append(" AND (u.codigo_localidad = ? OR EXISTS (SELECT 1 FROM puntos_accidentes pa WHERE pa.CODIGO_UPZ = u.codigo_upz AND CAST(pa.CODIGO_LOCALIDAD AS TEXT) = ?))");
            params.add(codigoLocalidad.trim());
            params.add(codigoLocalidad.trim());
        }

        sql.append(" GROUP BY u.id_local, u.codigo_upz, u.nombre, u.codigo_localidad, u.geom");

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> {
            Map<String, Object> props = new HashMap<>();
            props.put("id_local", rs.getInt("id_local"));
            props.put("codigo_upz", rs.getString("codigo_upz"));
            props.put("nombre", rs.getString("nombre"));
            props.put("codigo_localidad", rs.getString("codigo_localidad"));
            props.put("total_accidentes", rs.getInt("total_accidentes"));
            props.put("muertos", rs.getInt("muertos"));
            props.put("heridos", rs.getInt("heridos"));
            props.put("solo_danos", rs.getInt("solo_danos"));

            Map<String, Object> geometry = parseWktToGeoJsonGeometry(rs.getString("geom"));
            return new GeoJsonFeatureDto(props, geometry);
        }, params.toArray());
    }

    public List<String> findDistinctYears() {
        String sql = "SELECT DISTINCT substr(FECHA, 1, 4) AS anio FROM puntos_accidentes " +
                     "WHERE FECHA IS NOT NULL AND length(FECHA) >= 4 ORDER BY anio DESC";
        return jdbcTemplate.queryForList(sql, String.class);
    }

    private Map<String, Object> parseWktToGeoJsonGeometry(String wkt) {
        Map<String, Object> geom = new HashMap<>();
        if (wkt == null || wkt.isBlank()) return geom;
        String trimmed = wkt.trim();

        if (trimmed.startsWith("POINT")) {
            String content = trimmed.substring(trimmed.indexOf('(') + 1, trimmed.lastIndexOf(')')).trim();
            String[] parts = content.split("\\s+");
            if (parts.length >= 2) {
                geom.put("type", "Point");
                geom.put("coordinates", List.of(Double.parseDouble(parts[0]), Double.parseDouble(parts[1])));
            }
        } else if (trimmed.startsWith("LINESTRING")) {
            String content = trimmed.substring(trimmed.indexOf('(') + 1, trimmed.lastIndexOf(')')).trim();
            geom.put("type", "LineString");
            geom.put("coordinates", parseCoordSequence(content));
        } else if (trimmed.startsWith("MULTIPOLYGON")) {
            String body = trimmed.substring(trimmed.indexOf("(((") + 3, trimmed.lastIndexOf(")))")).trim();
            String[] polyBlocks = body.split("\\)\\s*\\)\\s*,\\s*\\(\\s*\\(");
            List<List<List<List<Double>>>> multiCoords = new ArrayList<>();
            for (String polyBlock : polyBlocks) {
                String[] rings = polyBlock.split("\\)\\s*,\\s*\\(");
                List<List<List<Double>>> polyRings = new ArrayList<>();
                for (String ring : rings) {
                    polyRings.add(parseCoordSequence(ring));
                }
                multiCoords.add(polyRings);
            }
            geom.put("type", "MultiPolygon");
            geom.put("coordinates", multiCoords);
        } else if (trimmed.startsWith("POLYGON")) {
            String body = trimmed.substring(trimmed.indexOf("((") + 2, trimmed.lastIndexOf("))")).trim();
            String[] rings = body.split("\\)\\s*,\\s*\\(");
            List<List<List<Double>>> polyRings = new ArrayList<>();
            for (String ring : rings) {
                polyRings.add(parseCoordSequence(ring));
            }
            geom.put("type", "Polygon");
            geom.put("coordinates", polyRings);
        }
        return geom;
    }

    private List<List<Double>> parseCoordSequence(String seq) {
        List<List<Double>> coords = new ArrayList<>();
        String[] pairs = seq.split(",");
        for (String pair : pairs) {
            String clean = pair.replace("(", "").replace(")", "").trim();
            String[] xy = clean.split("\\s+");
            if (xy.length >= 2) {
                coords.add(List.of(Double.parseDouble(xy[0]), Double.parseDouble(xy[1])));
            }
        }
        return coords;
    }
}