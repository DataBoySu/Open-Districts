// ─── MAP CONTROLLER — v4-app.js extraction ────────────────────────────────────
// Owns: Leaflet init (ONCE), GeoJSON layer management, animation arbitration.
// Receives: { state, ds, emit } context.
// Exports: init(ctx) → { loadDistrictGeo, syncFocus, syncModeClass, runArbitration }
// ─────────────────────────────────────────────────────────────────────────────

import { boundingBoxToLeaflet, severityPolygonStyle, districtBoundaryStyle, severityMarkerOptions }
    from "../services/geo-service.js";

let _ctx;

// ── Leaflet handles (module-scoped, not on AppState) ──────────────
let _map;
let _boundaryLayer, _regionsLayer, _markersLayer;
const _regionLayerMap = new Map(); // regionId → Leaflet layer

// ═══════════════════════════════════════════════════════════════════
// INIT — called ONCE at boot
// ═══════════════════════════════════════════════════════════════════

export function init(ctx) {
    _ctx = ctx;
    _initLeaflet();
}

function _initLeaflet() {
    _map = L.map("map", {
        zoomControl: false,
        doubleClickZoom: false,
        minZoom: 10,
        maxZoom: 15,
        scrollWheelZoom: true,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(_map);

    // Custom zoom buttons
    document.getElementById("zoom-in").addEventListener("click", () => _map.zoomIn());
    document.getElementById("zoom-out").addEventListener("click", () => _map.zoomOut());

    // Pan lifecycle → auto-hide timeline + arbitration suspension
    _map.on("movestart", () => {
        _ctx.state.isPanning = true;
        if (!_ctx.state.manuallyCollapsed) {
            document.getElementById("timeline-panel").classList.add("hidden");
        }
        _suspendAnimations();
        clearTimeout(_ctx.state.autoHideTimer);
    });

    _map.on("moveend", () => {
        clearTimeout(_ctx.state.autoHideTimer);
        _ctx.state.autoHideTimer = setTimeout(() => {
            if (!_ctx.state.manuallyCollapsed) {
                document.getElementById("timeline-panel").classList.remove("hidden");
            }
            _ctx.state.isPanning = false;
            runArbitration();
        }, _ctx.state.manuallyCollapsed ? 300 : 500);
    });
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC
// ═══════════════════════════════════════════════════════════════════

/** Load geography for a district. Clears previous layers. */
export async function loadDistrictGeo(district, events) {
    // Tear down previous layers
    if (_boundaryLayer) _map.removeLayer(_boundaryLayer);
    if (_regionsLayer) _map.removeLayer(_regionsLayer);
    if (_markersLayer) _map.removeLayer(_markersLayer);
    _regionLayerMap.clear();

    // Fit to bounds
    const bounds = boundingBoxToLeaflet(district.boundingBox);
    _map.fitBounds(bounds, { padding: [20, 20] });

    // Try to load GeoJSON — falls back to mock grid in geo-service
    const geoData = await _ctx.ds.getGeoJSON(district.geoJsonUrl);

    const severityMap = _buildSeverityByRegion(events);

    // District boundary ring
    _boundaryLayer = L.geoJSON(geoData, {
        style: districtBoundaryStyle(),
        interactive: false,
    }).addTo(_map);

    // Sub-district polygons
    _regionsLayer = L.geoJSON(geoData, {
        style: feature => {
            const regionId = feature.properties?.id ?? feature.id ?? "";
            const sev = severityMap[regionId]?.severity ?? "clear";
            return severityPolygonStyle(sev, false);
        },
        onEachFeature: (feature, layer) => {
            const regionId = feature.properties?.id ?? feature.id ?? "";
            _regionLayerMap.set(regionId, layer);
            layer.on("click", () => {
                const ev = _topEventForRegion(regionId, events);
                _ctx.emit("map:regionClick", { eventId: ev?.id ?? null });
            });
        },
    }).addTo(_map);

    // Apply severity CSS classes after Leaflet adds SVG to DOM
    setTimeout(() => {
        _regionsLayer.eachLayer(layer => {
            const regionId = _idFromLayer(layer);
            if (!regionId || !layer._path) return;
            const sev = severityMap[regionId]?.severity ?? "clear";
            _applySevClass(layer._path, sev);
        });
        runArbitration();
    }, 120);

    // Point markers
    const group = L.featureGroup();
    events.forEach(ev => {
        if (!ev.geoPoint) return;
        const opts = severityMarkerOptions(ev.severity);
        const marker = L.circleMarker([ev.geoPoint.lat, ev.geoPoint.lng], opts);
        marker.bindTooltip(ev.title, { sticky: true });
        marker.on("click", () => _ctx.emit("map:regionClick", { eventId: ev.id }));
        group.addLayer(marker);
    });
    _markersLayer = group.addTo(_map);
}

/** Highlight focused polygon, dim others, fly to bounds. */
export function syncFocus(focusedEventId, events) {
    const severityMap = _buildSeverityByRegion(events);

    if (!focusedEventId) {
        _regionLayerMap.forEach((layer, regionId) => {
            const sev = severityMap[regionId]?.severity ?? "clear";
            layer.setStyle(severityPolygonStyle(sev, false));
        });
        runArbitration();
        return;
    }

    const ev = events.find(e => e.id === focusedEventId);
    if (!ev) return;

    // Fly to region
    const targetLayer = ev.regionId ? _regionLayerMap.get(ev.regionId) : null;
    if (targetLayer?.getBounds) {
        _map.fitBounds(targetLayer.getBounds(), { padding: [30, 30] });
    } else if (ev.geoPoint) {
        _map.setView([ev.geoPoint.lat, ev.geoPoint.lng], Math.max(_map.getZoom(), 13));
    }

    // Style update
    _regionLayerMap.forEach((layer, regionId) => {
        const sev = severityMap[regionId]?.severity ?? "clear";
        const focused = ev.regionId && regionId === ev.regionId;
        layer.setStyle(severityPolygonStyle(sev, focused));
    });

    runArbitration();
}

/** Apply district-view / live-mode class to #map + manage env overlays. */
export function syncModeClass(mode, isHistorical, connectionStatus, envEnabled) {
    const mapEl = document.getElementById("map");
    mapEl.classList.toggle("district-view", mode === "district");
    mapEl.classList.toggle("live-mode", mode === "live");

    const envActive = mode === "live" && !isHistorical && connectionStatus === "live" && envEnabled;
    mapEl.classList.toggle("env-active", envActive);
}

/** Update map layers to reflect a historical snapshot up to bucketIndex. */
export function applyHistoricalSnapshot(bucketIndex, timeBuckets, events) {
    if (!_regionsLayer) return;
    const cutoffTs = timeBuckets[bucketIndex]?.endTs;
    if (!cutoffTs) return;

    const cutoff = new Date(cutoffTs);
    const historicalEvts = events.filter(e => new Date(e.timestamp) <= cutoff);
    const severityMap = _buildSeverityByRegion(historicalEvts);

    _regionLayerMap.forEach((layer, regionId) => {
        const sev = severityMap[regionId]?.severity ?? "clear";
        layer.setStyle(severityPolygonStyle(sev, false));
        if (layer._path) _applySevClass(layer._path, sev);
    });

    runArbitration();
}

/** Arbitration engine — governs all polygon animation play-state. */
export function runArbitration() {
    if (_ctx.state.isPanning || !_map.getBounds) return;

    const t0 = performance.now();
    const events = _ctx.state.events ?? [];
    const severityMap = _buildSeverityByRegion(events);
    const isLive = _ctx.state.mode === "live" && !_ctx.state.isHistorical;
    const mapBounds = _map.getBounds();

    // Collect visible regions
    const SEV_ORDER = { critical: 4, elevated: 3, informational: 2, clear: 1 };
    const visible = [];
    _regionLayerMap.forEach((layer, regionId) => {
        const center = layer.getBounds?.().getCenter();
        if (!center || !mapBounds.contains(center)) return;
        const sev = severityMap[regionId] ?? { severity: "clear", severityScore: 0, timestamp: "0" };
        visible.push({ regionId, layer, ...sev });
    });

    // Deterministic sort: score desc → timestamp desc → regionId lexical asc
    visible.sort((a, b) => {
        const sd = (SEV_ORDER[b.severity] ?? 0) - (SEV_ORDER[a.severity] ?? 0);
        if (sd !== 0) return sd;
        const sc = b.severityScore - a.severityScore;
        if (sc !== 0) return sc;
        const td = new Date(b.timestamp) - new Date(a.timestamp);
        if (td !== 0) return td;
        return a.regionId.localeCompare(b.regionId);
    });

    const elapsed = performance.now() - t0;
    _updatePerfCounter(elapsed);
    const maxTier = _effectiveTierCeiling(elapsed);

    visible.forEach(({ layer, severity }, index) => {
        if (!layer._path) return;
        let animate = false;
        if (isLive) {
            animate = (index === 0 && maxTier >= 1) || (index <= 2 && maxTier >= 2);
        } else {
            animate = index === 0 && severity === "critical";
        }
        layer._path.style.animationPlayState = animate ? "running" : "paused";
    });
}

// ═══════════════════════════════════════════════════════════════════
// PRIVATE helpers
// ═══════════════════════════════════════════════════════════════════

function _buildSeverityByRegion(events) {
    const SEV_ORDER = { critical: 4, elevated: 3, informational: 2, clear: 1 };
    const result = {};
    events.forEach(ev => {
        if (!ev.regionId) return;
        const existing = result[ev.regionId];
        if (!existing
            || SEV_ORDER[ev.severity] > SEV_ORDER[existing.severity]
            || (SEV_ORDER[ev.severity] === SEV_ORDER[existing.severity] && ev.severityScore > existing.severityScore)) {
            result[ev.regionId] = { severity: ev.severity, severityScore: ev.severityScore, timestamp: ev.timestamp };
        }
    });
    return result;
}

function _topEventForRegion(regionId, events) {
    const SEV_ORDER = { critical: 4, elevated: 3, informational: 2, clear: 1 };
    return events
        .filter(e => e.regionId === regionId)
        .sort((a, b) => (SEV_ORDER[b.severity] ?? 0) - (SEV_ORDER[a.severity] ?? 0) || b.severityScore - a.severityScore)
    [0] ?? null;
}

function _idFromLayer(layer) {
    for (const [id, l] of _regionLayerMap.entries()) {
        if (l === layer) return id;
    }
    return null;
}

function _applySevClass(path, sev) {
    path.classList.remove("sev-critical-path", "sev-elevated-path", "sev-info-path", "sev-clear-path");
    path.classList.add(`sev-${sev === "informational" ? "info" : sev}-path`);
}

function _suspendAnimations() {
    _regionLayerMap.forEach(layer => {
        if (layer._path) layer._path.style.animationPlayState = "paused";
    });
}

function _updatePerfCounter(ms) {
    if (ms > 20) {
        _ctx.state.consecutiveSlowFrames = (_ctx.state.consecutiveSlowFrames ?? 0) + 1;
    } else {
        _ctx.state.consecutiveSlowFrames = 0;
    }
    if (_ctx.state.consecutiveSlowFrames >= 3) {
        console.warn("[V4] Arbitration slow ×3 — disabling env overlays.");
        _ctx.state.envOverlaysEnabled = false;
        _ctx.emit("perf:envDisabled", {});
    }
}

function _effectiveTierCeiling(ms) {
    if (ms > 20 || _ctx.state.isHistorical) return 1;
    if (ms > 16) return 1;
    return 2;
}
