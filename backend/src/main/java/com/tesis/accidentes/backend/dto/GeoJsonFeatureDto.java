package com.tesis.accidentes.backend.dto;

import java.util.Map;

/**
 * Representa una entidad individual (Feature) bajo el estandar GeoJSON RFC 7946.
 */
public class GeoJsonFeatureDto {
    private final String type = "Feature";
    private Map<String, Object> properties;
    private Map<String, Object> geometry;

    public GeoJsonFeatureDto(Map<String, Object> properties, Map<String, Object> geometry) {
        this.properties = properties;
        this.geometry = geometry;
    }

    public String getType() {
        return type;
    }

    public Map<String, Object> getProperties() {
        return properties;
    }

    public Map<String, Object> getGeometry() {
        return geometry;
    }
}
