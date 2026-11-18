package com.tesis.accidentes.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class PrediccionRiesgoRequestDto {

    @JsonProperty("total_actores")
    private Integer totalActores;

    @JsonProperty("total_vehiculos")
    private Integer totalVehiculos;

    @JsonProperty("cant_ciclistas")
    private Integer cantCiclistas;

    @JsonProperty("choque_vehiculo")
    private Integer choqueVehiculo;

    @JsonProperty("choque_sin_registro")
    private Integer choqueSinRegistro;

    @JsonProperty("objeto_fijo_no_aplica")
    private Integer objetoFijoNoAplica;

    @JsonProperty("clase_camion_furgon")
    private Integer claseCamionFurgon;

    @JsonProperty("clase_campero")
    private Integer claseCampero;

    @JsonProperty("estrategia")
    private String estrategia;

    @JsonProperty("direccion")
    private String direccion;

    public Integer getTotalActores() { return totalActores; }
    public void setTotalActores(Integer totalActores) { this.totalActores = totalActores; }

    public Integer getTotalVehiculos() { return totalVehiculos; }
    public void setTotalVehiculos(Integer totalVehiculos) { this.totalVehiculos = totalVehiculos; }

    public Integer getCantCiclistas() { return cantCiclistas; }
    public void setCantCiclistas(Integer cantCiclistas) { this.cantCiclistas = cantCiclistas; }

    public Integer getChoqueVehiculo() { return choqueVehiculo; }
    public void setChoqueVehiculo(Integer choqueVehiculo) { this.choqueVehiculo = choqueVehiculo; }

    public Integer getChoqueSinRegistro() { return choqueSinRegistro; }
    public void setChoqueSinRegistro(Integer choqueSinRegistro) { this.choqueSinRegistro = choqueSinRegistro; }

    public Integer getObjetoFijoNoAplica() { return objetoFijoNoAplica; }
    public void setObjetoFijoNoAplica(Integer objetoFijoNoAplica) { this.objetoFijoNoAplica = objetoFijoNoAplica; }

    public Integer getClaseCamionFurgon() { return claseCamionFurgon; }
    public void setClaseCamionFurgon(Integer claseCamionFurgon) { this.claseCamionFurgon = claseCamionFurgon; }

    public Integer getClaseCampero() { return claseCampero; }
    public void setClaseCampero(Integer claseCampero) { this.claseCampero = claseCampero; }

    public String getEstrategia() { return estrategia; }
    public void setEstrategia(String estrategia) { this.estrategia = estrategia; }

    public String getDireccion() { return direccion; }
    public void setDireccion(String direccion) { this.direccion = direccion; }
}