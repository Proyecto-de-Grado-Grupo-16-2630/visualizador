package com.tesis.accidentes.backend.controller;

import com.tesis.accidentes.backend.dto.PrediccionRiesgoRequestDto;
import com.tesis.accidentes.backend.dto.PrediccionRiesgoResponseDto;
import com.tesis.accidentes.backend.service.PrediccionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mapa")
public class PrediccionController {

    private final PrediccionService prediccionService;

    public PrediccionController(PrediccionService prediccionService) {
        this.prediccionService = prediccionService;
    }

    @PostMapping("/predecir-riesgo")
    public ResponseEntity<PrediccionRiesgoResponseDto> predecirRiesgo(
            @RequestBody PrediccionRiesgoRequestDto request,
            @RequestHeader(value = "X-ML-Target-Url", required = false) String targetUrlOverride) {
        return ResponseEntity.ok(prediccionService.predecirRiesgo(request, targetUrlOverride));
    }
}