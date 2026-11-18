package com.tesis.accidentes.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

public class PrediccionRiesgoResponseDto {

    @JsonProperty("estrategia_aplicada")
    private String estrategiaAplicada;

    @JsonProperty("prediccion_codigo")
    private Integer prediccionCodigo;

    @JsonProperty("prediccion_descripcion")
    private String prediccionDescripcion;

    @JsonProperty("probabilidades")
    private Map<String, Double> probabilidades;

    @JsonProperty("nivel_riesgo")
    private String nivelRiesgo;

    @JsonProperty("ubicacion")
    private UbicacionDto ubicacion;

    public static class UbicacionDto {
        @JsonProperty("estado")
        private String estado;

        @JsonProperty("direccion_ingresada")
        private String direccionIngresada;

        @JsonProperty("direccion_normalizada")
        private String direccionNormalizada;

        @JsonProperty("direccion_oficial")
        private String direccionOficial;

        @JsonProperty("latitud")
        private Double latitud;

        @JsonProperty("longitud")
        private Double longitud;

        public String getEstado() { return estado; }
        public void setEstado(String estado) { this.estado = estado; }

        public String getDireccionIngresada() { return direccionIngresada; }
        public void setDireccionIngresada(String direccionIngresada) { this.direccionIngresada = direccionIngresada; }

        public String getDireccionNormalizada() { return direccionNormalizada; }
        public void setDireccionNormalizada(String direccionNormalizada) { this.direccionNormalizada = direccionNormalizada; }

        public String getDireccionOficial() { return direccionOficial; }
        public void setDireccionOficial(String direccionOficial) { this.direccionOficial = direccionOficial; }

        public Double getLatitud() { return latitud; }
        public void setLatitud(Double latitud) { this.latitud = latitud; }

        public Double getLongitud() { return longitud; }
        public void setLongitud(Double longitud) { this.longitud = longitud; }
    }

    public String getEstrategiaAplicada() { return estrategiaAplicada; }
    public void setEstrategiaAplicada(String estrategiaAplicada) { this.estrategiaAplicada = estrategiaAplicada; }

    public Integer getPrediccionCodigo() { return prediccionCodigo; }
    public void setPrediccionCodigo(Integer prediccionCodigo) { this.prediccionCodigo = prediccionCodigo; }

    public String getPrediccionDescripcion() { return prediccionDescripcion; }
    public void setPrediccionDescripcion(String prediccionDescripcion) { this.prediccionDescripcion = prediccionDescripcion; }

    public Map<String, Double> getProbabilidades() { return probabilidades; }
    public void setProbabilidades(Map<String, Double> probabilidades) { this.probabilidades = probabilidades; }

    public String getNivelRiesgo() { return nivelRiesgo; }
    public void setNivelRiesgo(String nivelRiesgo) { this.nivelRiesgo = nivelRiesgo; }

    public UbicacionDto getUbicacion() { return ubicacion; }
    public void setUbicacion(UbicacionDto ubicacion) { this.ubicacion = ubicacion; }
}