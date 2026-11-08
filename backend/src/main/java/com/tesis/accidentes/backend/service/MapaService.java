package com.tesis.accidentes.backend.service;

import com.tesis.accidentes.backend.dto.GeoJsonCollectionDto;
import com.tesis.accidentes.backend.repository.MapaRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MapaService {

    private final MapaRepository mapaRepository;

    public MapaService(MapaRepository mapaRepository) {
        this.mapaRepository = mapaRepository;
    }

    public GeoJsonCollectionDto obtenerCalles(String localidad, String codigoUpz) {
        return new GeoJsonCollectionDto(mapaRepository.findCalles(localidad, codigoUpz));
    }

    public GeoJsonCollectionDto obtenerAccidentes(String codigoLocalidad, String anio, String mes, String dia, String codigoUpz) {
        return new GeoJsonCollectionDto(mapaRepository.findAccidentes(codigoLocalidad, anio, mes, dia, codigoUpz));
    }

    public GeoJsonCollectionDto obtenerUpz(String codigoLocalidad, String anio, String mes, String dia) {
        return new GeoJsonCollectionDto(mapaRepository.findUpzPolygons(codigoLocalidad, anio, mes, dia));
    }

    public List<String> obtenerAniosDisponibles() {
        return mapaRepository.findDistinctYears();
    }
}