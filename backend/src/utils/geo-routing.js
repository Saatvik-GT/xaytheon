/**
 * XAYTHEON - Geo-Routing Utility
 * 
 * Calculates geographic distances using the Haversine formula
 * and provides nearest-neighbor selection for global traffic distribution.
 */

const REGIONS = Object.freeze({
    'na-east': Object.freeze({ name: 'North America (East)', lat: 39.0438, lon: -77.4874 }),
    'na-west': Object.freeze({ name: 'North America (West)', lat: 45.5231, lon: -122.6765 }),
    'eu-central': Object.freeze({ name: 'Europe (Central)', lat: 50.1109, lon: 8.6821 }),
    'ap-south': Object.freeze({ name: 'Asia Pacific (South)', lat: 1.3521, lon: 103.8198 }),
    'sa-east': Object.freeze({ name: 'South America (East)', lat: -23.5505, lon: -46.6333 })
});

const DEFAULT_REGION = 'na-east';

const EARTH_RADIUS_KM = 6371;

// Simple in-memory cache (LRU-style limit)
const cache = new Map();
const CACHE_LIMIT = 1000;

/**
 * Convert degrees to radians
 */
function toRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Calculate great-circle distance using Haversine formula
 */
function getDistance(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}

/**
 * Validate latitude and longitude inputs
 */
function validateCoordinates(lat, lon) {
    if (
        typeof lat !== 'number' ||
        typeof lon !== 'number' ||
        Number.isNaN(lat) ||
        Number.isNaN(lon) ||
        lat < -90 || lat > 90 ||
        lon < -180 || lon > 180
    ) {
        return false;
    }
    return true;
}

/**
 * Find the closest region based on user coordinates
 */
exports.findNearestRegion = (userLat, userLon) => {

    if (!validateCoordinates(userLat, userLon)) {
        return DEFAULT_REGION;
    }

    const cacheKey = `${userLat}:${userLon}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    let nearest = DEFAULT_REGION;
    let minDistance = Infinity;

    // Deterministic ordering
    const regionEntries = Object.entries(REGIONS).sort(([a], [b]) => a.localeCompare(b));

    for (const [id, region] of regionEntries) {
        const d = getDistance(userLat, userLon, region.lat, region.lon);
        if (d < minDistance) {
            minDistance = d;
            nearest = id;
        }
    }

    // Maintain simple bounded cache
    if (cache.size >= CACHE_LIMIT) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }

    cache.set(cacheKey, nearest);

    return nearest;
};

exports.REGIONS = REGIONS;
