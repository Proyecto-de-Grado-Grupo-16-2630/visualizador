package com.tesis.accidentes.backend.service;

import com.tesis.accidentes.backend.dto.GeoJsonCollectionDto;
import com.tesis.accidentes.backend.dto.GeoJsonFeatureDto;
import com.tesis.accidentes.backend.repository.MapaRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Servicio de logica de negocio para la conversion de geometrias WKT a colecciones GeoJSON.
 */
@Service
public class MapaService {

    private final MapaRepository mapaRepository;

    public MapaService(MapaRepository mapaRepository) {
        this.mapaRepository = mapaRepository;
    }

    public GeoJsonCollectionDto obtenerCallesGeoJson(String localidad) {
        List<Map<String, Object>> rows = mapaRepository.findCalles(localidad);
        List<GeoJsonFeatureDto> features = new ArrayList<>(rows.size());

        for (Map<String, Object> row : rows) {
            String wkt = String.valueOf(row.getOrDefault("geom", ""));
            List<double[]> coordinates = parseWktLineString(wkt);

            if (coordinates.size() >= 2) {
                Map<String, Object> props = new HashMap<>();
                props.put("id", row.get("id"));
                Object nomObj = row.get("nom");
                props.put("nom", (nomObj == null || "NULL".equalsIgnoreCase(nomObj.toString())) ? "" : nomObj.toString());
                props.put("tipo", row.get("tipo"));
                props.put("localidad", row.get("localidad"));

                Map<String, Object> geometry = new HashMap<>();
                geometry.put("type", "LineString");
                geometry.put("coordinates", coordinates);

                features.add(new GeoJsonFeatureDto(props, geometry));
            }
        }
        return new GeoJsonCollectionDto(features);
    }

    public GeoJsonCollectionDto obtenerAccidentesGeoJson(String codigoLocalidad, String anio) {
        List<Map<String, Object>> rows = mapaRepository.findAccidentes(codigoLocalidad, anio);
        List<GeoJsonFeatureDto> features = new ArrayList<>(rows.size());

        for (Map<String, Object> row : rows) {
            String wkt = String.valueOf(row.getOrDefault("geom", ""));
            double[] point = parseWktPoint(wkt);

            if (point != null) {
                Map<String, Object> props = new HashMap<>();
                props.put("id_local", row.get("id_local"));
                props.put("CODIGO_ACCIDENTE", row.get("CODIGO_ACCIDENTE"));
                props.put("FECHA", row.get("FECHA"));
                props.put("HORA", row.get("HORA"));
                props.put("GRAVEDAD", row.get("GRAVEDAD"));
                props.put("GRAVEDAD_DESC", row.get("GRAVEDAD_DESC"));
                props.put("CLASE_DESC", row.get("CLASE_DESC"));
                props.put("CHOQUE_DESC", row.get("CHOQUE_DESC"));
                props.put("DIRECCION", row.get("DIRECCION"));
                props.put("DIRECCION_COMPLETA", row.get("DIRECCION_COMPLETA"));
                props.put("CODIGO_LOCALIDAD", row.get("CODIGO_LOCALIDAD"));

                Map<String, Object> geometry = new HashMap<>();
                geometry.put("type", "Point");
                geometry.put("coordinates", point);

                features.add(new GeoJsonFeatureDto(props, geometry));
            }
        }
        return new GeoJsonCollectionDto(features);
    }

    public List<String> obtenerAniosDisponibles() {
        return mapaRepository.findAniosDisponibles();
    }

    private List<double[]> parseWktLineString(String wkt) {
        int start = wkt.indexOf('(');
        int end = wkt.lastIndexOf(')');
        if (start == -1 || end == -1 || end <= start) {
            return List.of();
        }
        String content = wkt.substring(start + 1, end);
        String[] pairs = content.split(",");
        List<double[]> coords = new ArrayList<>(pairs.length);

        for (String pair : pairs) {
            String[] parts = pair.trim().split("\\s+");
            if (parts.length >= 2) {
                try {
                    double lon = Double.parseDouble(parts[0]);
                    double lat = Double.parseDouble(parts[1]);
                    coords.add(new double[]{lon, lat});
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return coords;
    }

    private double[] parseWktPoint(String wkt) {
        int start = wkt.indexOf('(');
        int end = wkt.lastIndexOf(')');
        if (start == -1 || end == -1 || end <= start) {
            return null;
        }
        String[] parts = wkt.substring(start + 1, end).trim().split("\\s+");
        if (parts.length >= 2) {
            try {
                double lon = Double.parseDouble(parts[0]);
                double lat = Double.parseDouble(parts[1]);
                return new double[]{lon, lat};
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }
}
