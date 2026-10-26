package com.tesis.accidentes.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import javax.sql.DataSource;
import java.io.File;

/**
 * Configuracion de conexion a la base de datos SQLite/SpatiaLite mediante rutas relativas.
 */
@Configuration
public class DatabaseConfig {

    @Bean
    public DataSource dataSource() {
        String[] candidatePaths = {
                "data/accidentes_bogota_spatialite.db",
                "backend/data/accidentes_bogota_spatialite.db",
                "../frontend/public/data/accidentes_bogota_spatialite.db",
                "accidentes_bogota_spatialite.db"
        };

        String resolvedPath = "data/accidentes_bogota_spatialite.db";
        for (String path : candidatePaths) {
            File file = new File(path);
            if (file.exists()) {
                resolvedPath = file.getPath();
                break;
            }
        }

        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.sqlite.JDBC");
        dataSource.setUrl("jdbc:sqlite:" + resolvedPath);
        return dataSource;
    }
}
