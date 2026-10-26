package com.tesis.accidentes.backend.dto;

import java.util.List;

/**
 * Representa una coleccion de entidades geoespaciales (FeatureCollection) en formato GeoJSON.
 */
public class GeoJsonCollectionDto {
    private final String type = "FeatureCollection";
    private List<GeoJsonFeatureDto> features;

    public GeoJsonCollectionDto(List<GeoJsonFeatureDto> features) {
        this.features = features;
    }

    public String getType() {
        return type;
    }

    public List<GeoJsonFeatureDto> getFeatures() {
        return features;
    }
}
