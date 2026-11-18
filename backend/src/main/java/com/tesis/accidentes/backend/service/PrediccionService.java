package com.tesis.accidentes.backend.service;

import com.tesis.accidentes.backend.dto.PrediccionRiesgoRequestDto;
import com.tesis.accidentes.backend.dto.PrediccionRiesgoResponseDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class PrediccionService {

    private final RestTemplate restTemplate;

    @Value("${ml.service.url:http://localhost:8000/api/v1/predecir-riesgo}")
    private String mlServiceUrl;

    public PrediccionService() {
        this.restTemplate = new RestTemplate();
    }

    public PrediccionRiesgoResponseDto predecirRiesgo(PrediccionRiesgoRequestDto request, String targetUrlOverride) {
        String endpoint = (targetUrlOverride != null && !targetUrlOverride.isBlank())
                ? targetUrlOverride.trim()
                : mlServiceUrl;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<PrediccionRiesgoRequestDto> entity = new HttpEntity<>(request, headers);
        ResponseEntity<PrediccionRiesgoResponseDto> response = restTemplate.postForEntity(
                endpoint,
                entity,
                PrediccionRiesgoResponseDto.class
        );
        return response.getBody();
    }
}