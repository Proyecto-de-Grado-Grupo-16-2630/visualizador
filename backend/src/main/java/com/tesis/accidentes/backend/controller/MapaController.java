package com.tesis.accidentes.backend.controller;

import com.tesis.accidentes.backend.dto.GeoJsonCollectionDto;
import com.tesis.accidentes.backend.service.MapaService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controlador REST para el suministro de capas cartograficas y datos de accidentalidad.
 */
@RestController
@RequestMapping("/api/mapa")
public class MapaController {

    private final MapaService mapaService;

    public MapaController(MapaService mapaService) {
        this.mapaService = mapaService;
    }

    @GetMapping("/calles")
    public ResponseEntity<GeoJsonCollectionDto> getCalles(
            @RequestParam(name = "localidad", required = false) String localidad) {
        return ResponseEntity.ok(mapaService.obtenerCallesGeoJson(localidad));
    }

    @GetMapping("/accidentes")
    public ResponseEntity<GeoJsonCollectionDto> getAccidentes(
            @RequestParam(name = "localidad", required = false) String codigoLocalidad,
            @RequestParam(name = "anio", required = false) String anio) {
        return ResponseEntity.ok(mapaService.obtenerAccidentesGeoJson(codigoLocalidad, anio));
    }

    @GetMapping("/anios")
    public ResponseEntity<List<String>> getAniosDisponibles() {
        return ResponseEntity.ok(mapaService.obtenerAniosDisponibles());
    }
}
