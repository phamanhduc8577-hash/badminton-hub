package com.smashflow.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class GeoLocationService {

    private static final double EARTH_RADIUS_METERS = 6371000.0;

    /**
     * Calculate distance between two GPS coordinates using Haversine formula
     * @return distance in meters
     */
    public double calculateDistanceMeters(BigDecimal lat1, BigDecimal lon1, BigDecimal lat2, BigDecimal lon2) {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
            return Double.MAX_VALUE;
        }

        double dLat = Math.toRadians(lat2.doubleValue() - lat1.doubleValue());
        double dLon = Math.toRadians(lon2.doubleValue() - lon1.doubleValue());

        double originLat = Math.toRadians(lat1.doubleValue());
        double destLat = Math.toRadians(lat2.doubleValue());

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(originLat) * Math.cos(destLat);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS_METERS * c;
    }
}
