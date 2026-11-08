package com.tesis.accidentes.backend.controller;

import com.tesis.accidentes.backend.dto.GeoJsonCollectionDto;
import com.tesis.accidentes.backend.service.MapaService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/mapa")
public class MapaController {

    private final MapaService mapaService;

    public MapaController(MapaService mapaService) {
        this.mapaService = mapaService;
    }

    @GetMapping("/calles")
    public ResponseEntity<GeoJsonCollectionDto> getCalles(
            @RequestParam(required = false) String localidad,
            @RequestParam(required = false) String upz) {
        return ResponseEntity.ok(mapaService.obtenerCalles(localidad, upz));
    }

    @GetMapping("/accidentes")
    public ResponseEntity<GeoJsonCollectionDto> getAccidentes(
            @RequestParam(required = false) String localidad,
            @RequestParam(required = false) String anio,
            @RequestParam(required = false) String mes,
            @RequestParam(required = false) String dia,
            @RequestParam(required = false) String upz) {
        return ResponseEntity.ok(mapaService.obtenerAccidentes(localidad, anio, mes, dia, upz));
    }

    @GetMapping("/upz")
    public ResponseEntity<GeoJsonCollectionDto> getUpz(
            @RequestParam(required = false) String localidad,
            @RequestParam(required = false) String anio,
            @RequestParam(required = false) String mes,
            @RequestParam(required = false) String dia) {
        return ResponseEntity.ok(mapaService.obtenerUpz(localidad, anio, mes, dia));
    }

    @GetMapping("/anios")
    public ResponseEntity<List<String>> getAnios() {
        return ResponseEntity.ok(mapaService.obtenerAniosDisponibles());
    }
}