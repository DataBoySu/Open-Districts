// ─── GEO SERVICE — OpenDistricts V4 ───────────────────────────────────────────
// GeoJSON loading, caching, and bounding box helpers.
// All geographic data access flows through this module.

// ── CACHE ─────────────────────────────────────────────────────────────────────

const _geoCache = new Map(); // url → GeoJSON FeatureCollection

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/**
 * Load a GeoJSON file by URL. Caches the result in memory.
 * Falls back to mock inline geometry when the URL is not available
 * (dev mode — real files will be served at those paths in production).
 *
 * @param {string} url
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export async function loadGeoJSON(url) {
    if (_geoCache.has(url)) return _geoCache.get(url);

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        _geoCache.set(url, data);
        return data;
    } catch (err) {
        console.warn(`[GeoService] Could not load ${url}. Using mock geometry.`, err.message);
        const mock = _getMockGeometry(url);
        _geoCache.set(url, mock);
        return mock;
    }
}

/**
 * Convert a District boundingBox object to a Leaflet LatLngBounds array.
 * @param {{ north, south, east, west }} bb
 * @returns {[[number,number],[number,number]]}  [[sw], [ne]]
 */
export function boundingBoxToLeaflet(bb) {
    return [
        [bb.south, bb.west],
        [bb.north, bb.east]
    ];
}

/**
 * Build a Leaflet circle marker options object for an event's geoPoint.
 * @param {string} severity  "critical"|"elevated"|"informational"|"clear"
 * @returns {Object}  Leaflet CircleMarker options
 */
export function severityMarkerOptions(severity) {
    const CONFIG = {
        critical: { color: "#CF222E", fillColor: "#CF222E", radius: 12, weight: 2, fillOpacity: 0.85 },
        elevated: { color: "#9A6700", fillColor: "#9A6700", radius: 9, weight: 2, fillOpacity: 0.75 },
        informational: { color: "#1F6FEB", fillColor: "#1F6FEB", radius: 7, weight: 2, fillOpacity: 0.65 },
        clear: { color: "#1A7F37", fillColor: "#1A7F37", radius: 5, weight: 1, fillOpacity: 0.50 }
    };
    return CONFIG[severity] ?? CONFIG.informational;
}

/**
 * Build Leaflet polygon style for a severity class.
 * District View: low fill, pulse on critical only.
 * Live Mode fills are applied via CSS class on the parent element.
 *
 * @param {string} severity
 * @param {boolean} focused  Whether this polygon is currently focused
 * @returns {Object}  Leaflet PathOptions
 */
export function severityPolygonStyle(severity, focused = false) {
    const BASE = {
        critical: { color: "#CF222E", fillColor: "#CF222E", fillOpacity: 0.05, weight: focused ? 2.5 : 1.5, opacity: focused ? 0.55 : 0.22 },
        elevated: { color: "#9A6700", fillColor: "#9A6700", fillOpacity: 0.05, weight: focused ? 2.0 : 1.5, opacity: focused ? 0.50 : 0.18 },
        informational: { color: "#1F6FEB", fillColor: "#1F6FEB", fillOpacity: 0.04, weight: focused ? 1.5 : 1, opacity: focused ? 0.45 : 0.15 },
        clear: { color: "#1A7F37", fillColor: "#1A7F37", fillOpacity: 0.02, weight: 1, opacity: 0.10 }
    };
    return BASE[severity] ?? BASE.clear;
}

/**
 * Returns the Leaflet style for the district boundary ring.
 * Always visible. No fill.
 */
export function districtBoundaryStyle() {
    return {
        color: "rgba(13,17,23,0.15)",
        fill: false,
        weight: 1,
        interactive: false
    };
}

// ── MOCK GEOMETRY FALLBACK ────────────────────────────────────────────────────
// Used in dev when the /data/geo/ path is not served.
// Returns a plausible GeoJSON polygon for the district from path parsing.

function _getMockGeometry(url) {
    // Derive approximate center from known districts
    const CENTERS = {
        "khordha": { lat: 20.18, lng: 85.76, spread: 0.22 },
        "cuttack": { lat: 20.46, lng: 85.88, spread: 0.18 },
        "puri": { lat: 19.81, lng: 85.83, spread: 0.20 },
        "ganjam": { lat: 19.73, lng: 84.81, spread: 0.30 },
        "balangir": { lat: 20.58, lng: 83.22, spread: 0.28 },
        "pune": { lat: 18.80, lng: 74.05, spread: 0.60 },
        "mumbai": { lat: 19.08, lng: 72.87, spread: 0.19 },
        "nagpur": { lat: 21.10, lng: 79.07, spread: 0.33 }
    };

    // Extract district key from URL path
    const parts = url.split("/");
    const fileName = (parts.pop() ?? "").replace(".geojson", "");
    const c = CENTERS[fileName] ?? { lat: 20.0, lng: 85.0, spread: 0.3 };

    // Generate a rough convex polygon around center
    const s = c.spread;
    const coords = [
        [c.lng - s * 0.4, c.lat + s],
        [c.lng + s * 0.6, c.lat + s * 0.8],
        [c.lng + s, c.lat + s * 0.2],
        [c.lng + s * 0.8, c.lat - s * 0.5],
        [c.lng + s * 0.1, c.lat - s],
        [c.lng - s * 0.6, c.lat - s * 0.7],
        [c.lng - s, c.lat - s * 0.1],
        [c.lng - s * 0.7, c.lat + s * 0.5],
        [c.lng - s * 0.4, c.lat + s]  // close ring
    ];

    return {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                id: fileName,
                properties: { name: fileName, districtId: fileName },
                geometry: { type: "Polygon", coordinates: [coords] }
            }
        ]
    };
}
