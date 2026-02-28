// ─── OPENDISTRICTS V4 — v4-app.js ─────────────────────────────────────────────
// Entry point. Orchestrator only — no business logic here.
// This file imports DataService exclusively. Zero imports from /data/ directly.
// AppState mutations go through controlled setters only.
// References: docs/V4-transition.md, docs/V4-transition-schema.md, docs/V4-edge_cases.md
// ─────────────────────────────────────────────────────────────────────────────

import { DataService } from "./services/data-service.js";
import { formatCardTime, bucketToRibbonColour } from "./services/time-processor.js";
import { boundingBoxToLeaflet, severityMarkerOptions, severityPolygonStyle, districtBoundaryStyle } from "./services/geo-service.js";

// ═══════════════════════════════════════════════════════════════════
// 1. APP STATE — single source of truth
//    All mutations go through the setter functions below.
// ═══════════════════════════════════════════════════════════════════

const AppState = {
    locale: "en",         // active BCP 47 locale
    translations: {},           // flat string map for current locale
    mode: "district",   // "district" | "live"
    connectionStatus: "live",       // "live" | "reconnecting" | "offline"
    isHistorical: false,        // true when playhead is behind live edge
    currentStateId: "OD",
    currentDistrictId: "khordha",
    currentDistrict: null,         // District object from DataService
    events: [],           // Event[] for current district
    timeBuckets: [],           // TimeBucket[] for the density ribbon
    focusedEventId: null,         // id of the .focused timeline card
    manuallyCollapsed: false,        // whether user manually closed the timeline
    autoHideTimer: null,
    isPanning: false,        // true during Leaflet pan — suspends arbitration
    isAutoPlaying: false,
    autoPlayTimer: null,
    autoPlayBucketIndex: 0,
    consecutiveSlowFrames: 0,       // performance degradation counter (edge_cases §6)
    envOverlaysEnabled: true,       // can be disabled by perf guard
};

// ── Controlled state mutators ─────────────────────────────────────

function setMode(newMode) {
    if (AppState.mode === newMode) return;
    AppState.mode = newMode;
    renderModeToggle();
    syncMapModeClass();
    runAnimationArbitration();
}

function setFocusedEvent(eventId) {
    if (AppState.focusedEventId === eventId) return;
    AppState.focusedEventId = eventId;
    renderFocusState();
    syncMapFocus();
}

function setHistoricalMode(isHistorical) {
    if (AppState.isHistorical === isHistorical) return;
    AppState.isHistorical = isHistorical;
    if (isHistorical) {
        DataService.unsubscribeLiveUpdates(AppState.currentDistrictId);
        setEnvOverlays(false);
    } else {
        DataService.subscribeLiveUpdates(AppState.currentDistrictId, onLiveUpdate);
        if (AppState.mode === "live") setEnvOverlays(true);
    }
    renderSyncDot();
    renderTimeAxisBadge();
    runAnimationArbitration();
}

function setEnvOverlays(enabled) {
    AppState.envOverlaysEnabled = enabled;
    const mapEl = document.getElementById("map");
    mapEl.classList.toggle("env-active", enabled && AppState.mode === "live" && !AppState.isHistorical);
}

// ═══════════════════════════════════════════════════════════════════
// 2. LEAFLET MAP — created ONCE
// ═══════════════════════════════════════════════════════════════════

let map, boundaryLayer, regionsLayer, markersLayer, unsubscribeLive;

// Leaflet layer references keyed by regionId (for focus/setStyle)
const regionLayerMap = new Map(); // regionId → L.GeoJSON feature layer

function initMap() {
    map = L.map("map", {
        zoomControl: false, // custom +/- controls
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
    }).addTo(map);

    // Custom zoom buttons
    document.getElementById("zoom-in").addEventListener("click", () => map.zoomIn());
    document.getElementById("zoom-out").addEventListener("click", () => map.zoomOut());

    // Auto-hide inertia logic (Section 02 — exact implementation)
    map.on("movestart", () => {
        AppState.isPanning = true;
        if (!AppState.manuallyCollapsed) {
            document.getElementById("timeline-panel").classList.add("hidden");
        }
        clearTimeout(AppState.autoHideTimer);
        // edge_cases §8: suspend arbitration during pan
        suspendAnimations();
    });

    map.on("moveend", () => {
        clearTimeout(AppState.autoHideTimer);
        if (!AppState.manuallyCollapsed) {
            AppState.autoHideTimer = setTimeout(() => {
                document.getElementById("timeline-panel").classList.remove("hidden");
                AppState.isPanning = false;
                runAnimationArbitration(); // edge_cases §5
            }, 500); // 500ms debounce
        } else {
            AppState.isPanning = false;
            // Arbitration after 300ms (edge_cases §8)
            setTimeout(runAnimationArbitration, 300);
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
// 3. DISTRICT BOOT / RELOAD
//    Called at startup and when the user picks a new district.
// ═══════════════════════════════════════════════════════════════════

async function loadDistrict(districtId, stateId) {
    // Tear down live subscription from previous district
    if (unsubscribeLive) unsubscribeLive();
    DataService.unsubscribeLiveUpdates(AppState.currentDistrictId);
    stopAutoPlay();

    AppState.currentDistrictId = districtId;
    AppState.currentStateId = stateId ?? AppState.currentStateId;
    AppState.focusedEventId = null;
    AppState.isHistorical = false;

    // Fetch everything in parallel
    const [district, events, timeBuckets, translation] = await Promise.all([
        DataService.getDistrictById(districtId),
        DataService.getEventsForDistrict(districtId),
        DataService.getTimeSeries(districtId),
        DataService.getTranslation(AppState.locale),
    ]);

    AppState.currentDistrict = district;
    AppState.events = events;
    AppState.timeBuckets = timeBuckets;
    AppState.translations = translation.strings;

    // Update UI
    renderTopBarDistrict(district);
    renderTimeline(events);
    renderTimeAxis(timeBuckets);
    renderSyncDot();
    syncMapModeClass();

    // Load geography
    await loadDistrictGeo(district);

    // Subscribe to live updates
    unsubscribeLive = DataService.subscribeLiveUpdates(districtId, onLiveUpdate);
    runAnimationArbitration();
}

// ═══════════════════════════════════════════════════════════════════
// 4. GEO RENDERING — Leaflet layers
// ═══════════════════════════════════════════════════════════════════

async function loadDistrictGeo(district) {
    // Clear existing layers
    if (boundaryLayer) map.removeLayer(boundaryLayer);
    if (regionsLayer) map.removeLayer(regionsLayer);
    if (markersLayer) map.removeLayer(markersLayer);
    regionLayerMap.clear();

    // Fit map to district bounds
    const leafletBounds = boundingBoxToLeaflet(district.boundingBox);
    map.fitBounds(leafletBounds, { padding: [20, 20] });

    // Load GeoJSON
    const geoData = await DataService.getGeoJSON(district.geoJsonUrl);

    // Build severity map per regionId from current events
    const severityByRegion = buildSeverityByRegion(AppState.events);

    // District boundary ring (no fill, thin border)
    boundaryLayer = L.geoJSON(geoData, {
        style: districtBoundaryStyle(),
        interactive: false,
    }).addTo(map);

    // Sub-district regions with severity classes
    regionsLayer = L.geoJSON(geoData, {
        style: (feature) => {
            const regionId = feature.properties.id ?? feature.id;
            const severity = severityByRegion[regionId]?.severity ?? "clear";
            return severityPolygonStyle(severity, false);
        },
        onEachFeature: (feature, layer) => {
            const regionId = feature.properties.id ?? feature.id;
            regionLayerMap.set(regionId, layer);

            // Assign severity class for CSS animation targeting
            const severity = severityByRegion[regionId]?.severity ?? "clear";
            if (layer._path) applyPolygonSeverityClass(layer._path, severity);

            // Map tap → timeline focus (Section 11)
            layer.on("click", () => {
                const ev = getTopEventForRegion(regionId);
                if (ev) setFocusedEvent(ev.id);
            });
        },
    }).addTo(map);

    // After Leaflet renders, apply SVG classes (paths exist now)
    setTimeout(() => {
        regionsLayer.eachLayer(layer => {
            if (!layer._path) return;
            const regionId = getRegionIdFromLayer(layer);
            const severity = severityByRegion[regionId]?.severity ?? "clear";
            applyPolygonSeverityClass(layer._path, severity);
        });
        runAnimationArbitration();
    }, 100);

    // Point markers (visible at zoom ≥ 10)
    const markerGroup = L.featureGroup();
    AppState.events.forEach(ev => {
        if (!ev.geoPoint) return;
        const opts = severityMarkerOptions(ev.severity);
        const marker = L.circleMarker([ev.geoPoint.lat, ev.geoPoint.lng], opts);
        marker.bindTooltip(ev.title, { sticky: true, className: "v4-tooltip" });
        marker.on("click", () => setFocusedEvent(ev.id));
        markerGroup.addLayer(marker);
    });
    markersLayer = markerGroup.addTo(map);
}

// ── Severity helpers ──────────────────────────────────────────────

/** max severity event per regionId → { severity, severityScore } */
function buildSeverityByRegion(events) {
    const SEV_ORDER = { critical: 4, elevated: 3, informational: 2, clear: 1 };
    const map = {};
    events.forEach(ev => {
        if (!ev.regionId) return;
        const existing = map[ev.regionId];
        if (!existing || SEV_ORDER[ev.severity] > SEV_ORDER[existing.severity] ||
            (SEV_ORDER[ev.severity] === SEV_ORDER[existing.severity] && ev.severityScore > existing.severityScore)) {
            map[ev.regionId] = { severity: ev.severity, severityScore: ev.severityScore, timestamp: ev.timestamp };
        }
    });
    return map;
}

function getTopEventForRegion(regionId) {
    const SEV_ORDER = { critical: 4, elevated: 3, informational: 2, clear: 1 };
    return AppState.events
        .filter(e => e.regionId === regionId)
        .sort((a, b) => (SEV_ORDER[b.severity] ?? 0) - (SEV_ORDER[a.severity] ?? 0) || b.severityScore - a.severityScore)
    [0] ?? null;
}

function getRegionIdFromLayer(layer) {
    for (const [id, l] of regionLayerMap.entries()) {
        if (l === layer) return id;
    }
    return null;
}

function applyPolygonSeverityClass(path, severity) {
    path.classList.remove("sev-critical-path", "sev-elevated-path", "sev-info-path", "sev-clear-path");
    path.classList.add(`sev-${severity === "informational" ? "info" : severity}-path`);
}

// ═══════════════════════════════════════════════════════════════════
// 5. ANIMATION ARBITRATION (edge_cases §2, §6, §8)
//    Single function that governs ALL polygon animation.
//    Runs on: moveend, timeCursor change, data update, mode switch,
//             connectionStatus change (edge_cases §5).
// ═══════════════════════════════════════════════════════════════════

function runAnimationArbitration() {
    if (AppState.isPanning) return; // edge_cases §8: suspended during pan

    const t0 = performance.now();

    const severityByRegion = buildSeverityByRegion(AppState.events);
    const isLive = AppState.mode === "live" && !AppState.isHistorical;

    // Collect all visible region layers
    const mapBounds = map.getBounds ? map.getBounds() : null;
    const visibleRegions = [];
    regionLayerMap.forEach((layer, regionId) => {
        const center = layer.getBounds ? layer.getBounds().getCenter() : null;
        if (!mapBounds || !center || mapBounds.contains(center)) {
            const sev = severityByRegion[regionId] ?? { severity: "clear", severityScore: 0, timestamp: "0" };
            visibleRegions.push({ regionId, layer, ...sev });
        }
    });

    // Deterministic sort (edge_cases §2.2):
    // severityScore desc → timestamp desc → regionId lexical asc
    const SEV_ORDER = { critical: 4, elevated: 3, informational: 2, clear: 1 };
    visibleRegions.sort((a, b) => {
        const sevDiff = (SEV_ORDER[b.severity] ?? 0) - (SEV_ORDER[a.severity] ?? 0);
        if (sevDiff !== 0) return sevDiff;
        const scoreDiff = b.severityScore - a.severityScore;
        if (scoreDiff !== 0) return scoreDiff;
        const tsDiff = new Date(b.timestamp) - new Date(a.timestamp);
        if (tsDiff !== 0) return tsDiff;
        return a.regionId.localeCompare(b.regionId); // tie-breaker: lexical
    });

    // Performance check elapsed time
    const elapsed = performance.now() - t0;
    updatePerfCounter(elapsed);

    // Determine effective tier ceiling based on perf degradation (edge_cases §6)
    const maxTier = getEffectiveTierCeiling(elapsed);

    // Apply animation-play-state to each region
    visibleRegions.forEach((region, index) => {
        if (!region.layer._path) return;
        const path = region.layer._path;
        let shouldAnimate = false;

        if (isLive) {
            // Live mode: Tier 1 (index 0) + Tier 2 (index 1-2) — max 3 total
            if (index === 0 && maxTier >= 1) shouldAnimate = true;
            else if (index <= 2 && maxTier >= 2) shouldAnimate = true;
        } else {
            // District mode or historical: only Tier 1 (critical) animates
            if (index === 0 && region.severity === "critical") shouldAnimate = true;
        }

        path.style.animationPlayState = shouldAnimate ? "running" : "paused";
    });
}

/** Update consecutive slow frame counter. Returns tier ceiling. */
function updatePerfCounter(elapsedMs) {
    if (elapsedMs > 20) {
        AppState.consecutiveSlowFrames++;
    } else {
        AppState.consecutiveSlowFrames = 0;
    }

    if (AppState.consecutiveSlowFrames >= 3) {
        console.warn("[V4] Animation arbitration consistently slow. Disabling env overlays.");
        setEnvOverlays(false);
    }
}

/** Returns max tier allowed based on perf state (edge_cases §6) */
function getEffectiveTierCeiling(elapsedMs) {
    if (elapsedMs > 20 || AppState.isHistorical) return 1; // collapse to District model
    if (elapsedMs > 16) return 1; // disable Tier 2
    return 2; // full Live Mode tiers
}

function suspendAnimations() {
    regionLayerMap.forEach(layer => {
        if (layer._path) layer._path.style.animationPlayState = "paused";
    });
}

// ═══════════════════════════════════════════════════════════════════
// 6. MAP ↔ TIMELINE SYNC
// ═══════════════════════════════════════════════════════════════════

function syncMapFocus() {
    const eventId = AppState.focusedEventId;

    if (!eventId) {
        // Clear: reset all polygons to no-focus style
        const severityByRegion = buildSeverityByRegion(AppState.events);
        regionLayerMap.forEach((layer, regionId) => {
            const sev = severityByRegion[regionId]?.severity ?? "clear";
            layer.setStyle(severityPolygonStyle(sev, false));
        });
        runAnimationArbitration();
        return;
    }

    const ev = AppState.events.find(e => e.id === eventId);
    if (!ev || !ev.regionId) return;

    // Zoom to polygon (Timeline card tap → fitBounds, Section 11)
    const targetLayer = regionLayerMap.get(ev.regionId);
    if (targetLayer?.getBounds) {
        map.fitBounds(targetLayer.getBounds(), { padding: [20, 20] });
    } else if (ev.geoPoint) {
        map.setView([ev.geoPoint.lat, ev.geoPoint.lng], Math.max(map.getZoom(), 13));
    }

    // Intensify focused polygon, reset others
    const severityByRegion = buildSeverityByRegion(AppState.events);
    regionLayerMap.forEach((layer, regionId) => {
        const sev = severityByRegion[regionId]?.severity ?? "clear";
        const focused = regionId === ev.regionId;
        layer.setStyle(severityPolygonStyle(sev, focused));
    });

    runAnimationArbitration();
}

function syncMapModeClass() {
    const mapEl = document.getElementById("map");
    mapEl.classList.toggle("district-view", AppState.mode === "district");
    mapEl.classList.toggle("live-mode", AppState.mode === "live");
    setEnvOverlays(AppState.mode === "live" && !AppState.isHistorical);
}

// ═══════════════════════════════════════════════════════════════════
// 7. RENDERING — top bar, timeline, AI panel, time axis
// ═══════════════════════════════════════════════════════════════════

function t(key, vars = {}) {
    let str = AppState.translations[key] ?? key;
    Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v); });
    return str;
}

// ── Top bar ───────────────────────────────────────────────────────

function renderTopBarDistrict(district) {
    document.getElementById("tb-district-name").textContent = district.name;
    document.getElementById("tl-header-district").textContent = district.name;
}

async function renderLanguageSelector() {
    const locales = await DataService.getAvailableLocales();
    const container = document.getElementById("tb-lang");
    container.innerHTML = "";

    const show = locales.slice(0, 3);
    show.forEach(locale => {
        const btn = document.createElement("button");
        btn.className = "lang-pill" + (locale === AppState.locale ? " active" : "");
        btn.textContent = locale.toUpperCase();
        btn.setAttribute("aria-pressed", locale === AppState.locale);
        btn.addEventListener("click", () => switchLocale(locale));
        container.appendChild(btn);
    });
}

function renderModeToggle() {
    document.getElementById("mode-district").classList.toggle("active", AppState.mode === "district");
    document.getElementById("mode-live").classList.toggle("active", AppState.mode === "live");
}

function renderSyncDot() {
    const dot = document.getElementById("sync-dot");
    const label = document.getElementById("sync-label");
    const isHist = AppState.isHistorical;
    dot.classList.toggle("historical", isHist);
    label.classList.toggle("historical", isHist);
    label.textContent = isHist ? "HISTORICAL" : "LIVE";
}

// ── Timeline panel ────────────────────────────────────────────────

function renderTimeline(events) {
    const spine = document.getElementById("tl-spine");
    spine.innerHTML = "";

    // newest at bottom (oldest first in DOM = top)
    [...events].forEach(ev => {
        const card = buildTimelineCard(ev);
        spine.appendChild(card);
    });
}

function buildTimelineCard(ev) {
    const sevClass = ev.severity === "informational" ? "sev-info" : `sev-${ev.severity}`;
    const timeStr = formatCardTime(ev.timestamp);
    const regionLabel = getRegionDisplayName(ev.regionId);
    const catLabel = t(`category.${ev.category}`);

    const card = document.createElement("article");
    card.className = `tl-card ${sevClass}`;
    card.setAttribute("data-event-id", ev.id);
    card.setAttribute("role", "listitem");
    card.setAttribute("aria-label", ev.title);

    card.innerHTML = `
    <div class="tl-card-inner">
      <div class="tl-card-head">
        <div class="tl-thumb" aria-hidden="true">
          ${buildThumbSVG(ev.regionId)}
        </div>
        <div class="tl-meta">
          <div class="tl-loc-name">${regionLabel}</div>
          <div class="tl-time">${timeStr}</div>
        </div>
      </div>
      <div class="tl-summary">${ev.summary}</div>
      <div class="tl-details">
        ${buildDetailRows(ev)}
        <div class="tl-source-tag">
          <div class="tl-source-dot" aria-hidden="true"></div>
          ${ev.verified ? `Verified &middot; ${ev.source}` : `Unverified &middot; ${ev.source}`}
        </div>
      </div>
    </div>`;

    card.addEventListener("click", () => {
        if (AppState.focusedEventId === ev.id) {
            setFocusedEvent(null); // tap focused card → unfocus
        } else {
            setFocusedEvent(ev.id);
        }
    });

    return card;
}

function buildDetailRows(ev) {
    const rows = [];
    if (ev.meta?.caseCount !== undefined) {
        rows.push(["CASES", ev.meta.caseCount]);
    }
    if (ev.meta?.phcName) {
        rows.push(["FACILITY", ev.meta.phcName]);
    }
    if (ev.meta?.affectedPopulation) {
        rows.push(["AFFECTED", ev.meta.affectedPopulation.toLocaleString()]);
    }
    if (ev.meta?.highway) {
        rows.push(["HIGHWAY", ev.meta.highway]);
    }
    if (ev.meta?.zone) {
        rows.push(["ZONE", ev.meta.zone]);
    }
    if (ev.meta?.actionsTaken?.length) {
        rows.push(["ACTION", ev.meta.actionsTaken[0]]);
    }

    return rows.map(([label, value]) => `
    <div class="tl-detail-row">
      <div class="tl-detail-label">${label}</div>
      <div class="tl-detail-value">${value}</div>
    </div>`).join("");
}

function buildThumbSVG(regionId) {
    // Placeholder geometric thumbnail — a simplified polygon silhouette.
    // In production, this would be a pre-generated simplified SVG per regionId.
    const hash = regionId ? regionId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) : 42;
    const pts = [];
    const cx = 14, cy = 12;
    const sides = 5 + (hash % 3);
    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const r = 8 + (hash * (i + 1) % 4);
        pts.push(`${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`);
    }
    return `<svg viewBox="0 0 28 24" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${pts.join(" ")}" fill="var(--bg)" stroke="var(--rule)" stroke-width="1.2"/>
  </svg>`;
}

function getRegionDisplayName(regionId) {
    if (!regionId) return AppState.currentDistrict?.name ?? "–";
    // Check regions cache
    const region = _regionCache[regionId];
    return region?.name ?? regionId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const _regionCache = {};

async function prefetchRegions() {
    const regions = await DataService.getRegionsForDistrict(AppState.currentDistrictId);
    regions.forEach(r => { _regionCache[r.id] = r; });
}

// ── Focus state rendering ─────────────────────────────────────────

function renderFocusState() {
    const focusedId = AppState.focusedEventId;
    const cards = document.querySelectorAll(".tl-card");

    if (!focusedId) {
        cards.forEach(c => { c.classList.remove("focused", "dimmed"); });
        // Tap blank = map returns to district view
        if (map.getBounds) {
            const bb = AppState.currentDistrict?.boundingBox;
            if (bb) map.fitBounds(boundingBoxToLeaflet(bb), { padding: [20, 20] });
        }
        return;
    }

    cards.forEach(card => {
        const cardEventId = card.getAttribute("data-event-id");
        if (cardEventId === focusedId) {
            card.classList.add("focused");
            card.classList.remove("dimmed");
            card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
            card.classList.add("dimmed");
            card.classList.remove("focused");
        }
    });
}

// ── Timeline blank-area tap → clear focus ─────────────────────────

function initTimelinePanelTap() {
    document.getElementById("tl-scroll").addEventListener("click", (e) => {
        if (!e.target.closest(".tl-card")) {
            setFocusedEvent(null);
        }
    });
}

// ─── Collapse panel ───────────────────────────────────────────────

function initTimelineCollapse() {
    const tlPanel = document.getElementById("timeline-panel");
    const collapseBtn = document.getElementById("tl-collapse-btn");
    const sliver = document.getElementById("tl-sliver");

    const toggle = () => {
        AppState.manuallyCollapsed = !AppState.manuallyCollapsed;
        tlPanel.classList.toggle("hidden", AppState.manuallyCollapsed);
        collapseBtn.setAttribute("aria-expanded", !AppState.manuallyCollapsed);
    };

    collapseBtn.addEventListener("click", toggle);
    sliver.addEventListener("click", toggle);
    sliver.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") toggle(); });
}

// ═══════════════════════════════════════════════════════════════════
// 8. AI PANEL
// ═══════════════════════════════════════════════════════════════════

function openAIPanel() {
    const panel = document.getElementById("ai-panel");
    const contextBar = document.getElementById("ai-context-bar");
    const contextText = document.getElementById("ai-context-text");
    const generalIntents = document.getElementById("ai-intents-general");
    const eventIntents = document.getElementById("ai-intents-event");

    // One-time context snapshot at moment of button press (Section 09)
    const focusedEvent = AppState.events.find(e => e.id === AppState.focusedEventId);

    if (focusedEvent) {
        // Event-bound context
        contextBar.className = "event-bound";
        const timeStr = formatCardTime(focusedEvent.timestamp);
        contextText.textContent = `${focusedEvent.category.toUpperCase()} · ${getRegionDisplayName(focusedEvent.regionId)} · ${timeStr}`;
        generalIntents.classList.add("hidden");
        eventIntents.classList.remove("hidden");
    } else {
        // General district context
        contextBar.className = "general";
        contextText.textContent = `DISTRICT · ${AppState.currentDistrict?.name ?? "–"} · GENERAL`;
        generalIntents.classList.remove("hidden");
        eventIntents.classList.add("hidden");
    }

    // Hide any previous result
    document.getElementById("ai-result").classList.add("hidden");

    panel.classList.add("open");
}

function closeAIPanel() {
    document.getElementById("ai-panel").classList.remove("open");
}

function initAIPanel() {
    document.getElementById("tb-ai-btn").addEventListener("click", openAIPanel);
    document.getElementById("ai-close-btn").addEventListener("click", closeAIPanel);

    // Collapse sliver
    document.getElementById("ai-sliver").addEventListener("click", () => {
        document.getElementById("ai-panel").classList.remove("open");
    });
    document.getElementById("ai-sliver").addEventListener("keydown", e => {
        if (e.key === "Enter") closeAIPanel();
    });

    // Intent card taps → mock AI result
    document.querySelectorAll(".intent-card").forEach(card => {
        card.addEventListener("click", () => {
            const intent = card.getAttribute("data-intent");
            showMockAIResult(intent);
        });
    });
}

function showMockAIResult(intent) {
    const MOCK_RESULTS = {
        "disease-history": {
            source: "ICMR historical data · Khordha, 2022–2025",
            body: `Khordha district has reported seasonal fever clusters in Feb–April for 3 consecutive years. Balianta Block has the highest incidence rate at 4.2 per 1,000 population. Waterborne illness peaks align with post-harvest ground water depletion in the region.`
        },
        "nearest-facility": {
            source: "Odisha Health GIS · Last updated 26-Feb-2025",
            body: `3 PHCs within 10km currently operational. Nearest: Balianta PHC (2.3km, 24×7 emergency). Tangi CHC (7.1km, 30 beds available). Khordha District Hospital (9.4km, specialist care).`
        },
        "water-status": {
            source: "Odisha Jal Mission · Real-time status",
            body: `14 of 17 borewells operational in Khordha block. Borewell #7 Tangi is non-operational (repair in progress). Tanker supply to 1,200 residents arranged. No supply disruption for remaining blocks.`
        },
        "safe-travel": {
            source: "NHAI / Odisha PWD · Current advisories",
            body: `NH-16 diversion in effect near Bhubaneswar junction. SH-12 is all-clear. No ambulance or emergency vehicle restriction currently active. Road condition: Good on primary roads, Fair on Bolagarh block rural links.`
        },
        "spreading": {
            source: "State Surveillance Unit · 7-day trend",
            body: `Current event: Fever cluster at Balianta Block. 7-day trajectory shows peak on Day 3 (23 cases), plateau at Days 5–7 (18 cases), early decline trend visible. No spread to adjacent blocks detected. PHC contact tracing ongoing.`
        },
        "historical-compare": {
            source: "ICMR / State Health · 2022–2024 archive",
            body: `Same event type (seasonal fever cluster) reported in Balianta Block in Feb 2023 (31 cases) and Feb 2024 (19 cases). Current outbreak (23 cases) is within historical range. Mobile team response time improved from 18h (2023) to 6h (2025).`
        },
    };

    const result = MOCK_RESULTS[intent] ?? {
        source: "OpenDistricts knowledge base",
        body: "Data for this query is not available in the current district context."
    };

    document.getElementById("ai-result-source-text").textContent = result.source;
    document.getElementById("ai-result-body").textContent = result.body;
    document.getElementById("ai-result").classList.remove("hidden");
}

// ═══════════════════════════════════════════════════════════════════
// 9. TIME AXIS
// ═══════════════════════════════════════════════════════════════════

let timeAxisState = {
    totalWidth: 0,
    playheadFrac: 1.0,    // 0.0 (oldest) → 1.0 (live/newest)
    isDragging: false,
    isPlaying: false,
    isFF: false,
};

function renderTimeAxis(buckets) {
    const ruler = document.getElementById("ta-ruler");
    const ribbon = document.getElementById("ta-ribbon");
    ruler.innerHTML = "";
    ribbon.innerHTML = "";

    if (!buckets || buckets.length === 0) return;

    const total = buckets.length;
    const segW = 100 / total;

    buckets.forEach((bucket, i) => {
        // Ribbon segment
        const seg = document.createElement("div");
        seg.className = "ribbon-seg";
        seg.style.width = `${segW}%`;
        seg.style.backgroundColor = bucketToRibbonColour(bucket);
        seg.setAttribute("data-bucket-index", i);
        seg.setAttribute("title", bucket.startTs?.slice(0, 10) ?? "");
        ribbon.appendChild(seg);

        // Ruler tick — major at start of each month/day boundary
        const tick = document.createElement("div");
        const isMajor = i === 0 || (i % Math.max(1, Math.floor(total / 7)) === 0);
        tick.className = isMajor ? "ta-tick-major" : "ta-tick-minor";
        tick.style.left = `${(i / total) * 100}%`;
        ruler.appendChild(tick);

        if (isMajor && bucket.startTs) {
            const label = document.createElement("div");
            label.className = "ta-tick-label";
            label.style.left = `${(i / total) * 100}%`;
            label.textContent = formatRulerLabel(bucket.startTs);
            ruler.appendChild(label);
        }
    });

    renderPlayhead();
}

function formatRulerLabel(isoTs) {
    const d = new Date(isoTs);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

function renderPlayhead() {
    const ph = document.getElementById("ta-playhead");
    if (!ph) return;
    const frac = Math.max(0, Math.min(1, timeAxisState.playheadFrac));
    ph.style.left = `${frac * 100}%`;

    // Post-playhead darkening on density ribbon
    const ribbon = document.getElementById("ta-ribbon");
    if (ribbon) {
        const afterWidth = (1 - frac) * 100;
        ribbon.style.setProperty("--after-width", `${afterWidth}%`);
    }

    // Historical mode check
    const wasHistorical = AppState.isHistorical;
    const isNowHistorical = frac < 0.99;
    if (isNowHistorical !== wasHistorical) {
        setHistoricalMode(isNowHistorical);
    }
}

function renderTimeAxisBadge() {
    const badge = document.getElementById("ta-live-badge");
    badge.classList.toggle("historical", AppState.isHistorical);
    document.getElementById("ta-live-label").textContent = AppState.isHistorical ? "HISTORICAL" : "LIVE";
}

function initTimeAxisControls() {
    // Playhead drag
    const playheadEl = document.getElementById("ta-playhead");
    const handle = document.getElementById("ta-playhead-handle");
    const mainEl = document.getElementById("ta-main");

    let startX = 0;
    let startFrac = 0;

    handle.addEventListener("mousedown", e => {
        timeAxisState.isDragging = true;
        startX = e.clientX;
        startFrac = timeAxisState.playheadFrac;
        stopAutoPlay();
        e.preventDefault();
    });

    document.addEventListener("mousemove", e => {
        if (!timeAxisState.isDragging) return;
        const mainRect = mainEl.getBoundingClientRect();
        const dx = e.clientX - mainRect.left;
        timeAxisState.playheadFrac = Math.max(0, Math.min(1, dx / mainRect.width));
        renderPlayhead();
    });

    document.addEventListener("mouseup", () => {
        if (timeAxisState.isDragging) {
            timeAxisState.isDragging = false;
        }
    });

    // Click on ribbon → jump to that position
    document.getElementById("ta-ribbon").addEventListener("click", e => {
        const rect = e.currentTarget.getBoundingClientRect();
        timeAxisState.playheadFrac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        renderPlayhead();
        stopAutoPlay();
    });

    // Touch support for Pi touchscreen
    handle.addEventListener("touchstart", e => {
        timeAxisState.isDragging = true;
        startX = e.touches[0].clientX;
        stopAutoPlay();
        e.preventDefault();
    }, { passive: false });

    document.addEventListener("touchmove", e => {
        if (!timeAxisState.isDragging) return;
        const mainRect = mainEl.getBoundingClientRect();
        const dx = e.touches[0].clientX - mainRect.left;
        timeAxisState.playheadFrac = Math.max(0, Math.min(1, dx / mainRect.width));
        renderPlayhead();
    });

    document.addEventListener("touchend", () => { timeAxisState.isDragging = false; });

    // Play / Fast-forward buttons
    document.getElementById("ta-play").addEventListener("click", () => {
        if (AppState.isAutoPlaying) {
            stopAutoPlay();
        } else {
            startAutoPlay(700);
        }
    });

    document.getElementById("ta-ff").addEventListener("click", () => {
        if (AppState.isAutoPlaying && timeAxisState.isFF) {
            stopAutoPlay();
        } else {
            startAutoPlay(350);
        }
    });

    // Stop autoplay on map or timeline touch (Section 07)
    document.getElementById("map").addEventListener("pointerdown", stopAutoPlay);
    document.getElementById("ta-ribbon").addEventListener("pointerdown", stopAutoPlay);
}

// ── Auto-play ─────────────────────────────────────────────────────

function startAutoPlay(intervalMs) {
    stopAutoPlay();
    AppState.isAutoPlaying = true;
    timeAxisState.isFF = intervalMs < 500;

    const playBtn = document.getElementById("ta-play");
    const ffBtn = document.getElementById("ta-ff");
    playBtn.classList.add("playing");
    if (timeAxisState.isFF) ffBtn.classList.add("playing");

    const totalBuckets = AppState.timeBuckets.length;
    if (totalBuckets === 0) return;

    // Find starting bucket from playhead position
    AppState.autoPlayBucketIndex = Math.floor(timeAxisState.playheadFrac * totalBuckets);

    AppState.autoPlayTimer = setInterval(() => {
        const t0 = performance.now();

        AppState.autoPlayBucketIndex++;

        // End of data → stop
        if (AppState.autoPlayBucketIndex >= totalBuckets) {
            stopAutoPlay();
            timeAxisState.playheadFrac = 1.0;
            renderPlayhead();
            return;
        }

        timeAxisState.playheadFrac = AppState.autoPlayBucketIndex / totalBuckets;
        renderPlayhead();

        // Severity class update on map (no full Leaflet redraw)
        applyHistoricalSnapshot(AppState.autoPlayBucketIndex);

        const elapsed = performance.now() - t0;
        // edge_cases §6: >16ms → skip frame (interval already advancing; just log)
        if (elapsed > 16) {
            console.debug(`[V4] Autoplay step ${AppState.autoPlayBucketIndex}: ${elapsed.toFixed(1)}ms (>16ms threshold)`);
        }
    }, intervalMs);
}

function stopAutoPlay() {
    clearInterval(AppState.autoPlayTimer);
    AppState.isAutoPlaying = false;
    timeAxisState.isFF = false;
    document.getElementById("ta-play").classList.remove("playing");
    document.getElementById("ta-ff").classList.remove("playing");
}

/**
 * Update map severity classes to reflect events up to the given bucket index.
 * Uses L.GeoJSON setStyle() per feature — no full Leaflet redraw.
 */
function applyHistoricalSnapshot(bucketIndex) {
    if (!regionsLayer) return;
    const cutoffTs = AppState.timeBuckets[bucketIndex]?.endTs;
    if (!cutoffTs) return;

    const cutoff = new Date(cutoffTs);
    const historicalEvents = AppState.events.filter(e => new Date(e.timestamp) <= cutoff);
    const severityByRegion = buildSeverityByRegion(historicalEvents);

    regionLayerMap.forEach((layer, regionId) => {
        const sev = severityByRegion[regionId]?.severity ?? "clear";
        layer.setStyle(severityPolygonStyle(sev, false));
        if (layer._path) applyPolygonSeverityClass(layer._path, sev);
    });

    runAnimationArbitration();
}

// ═══════════════════════════════════════════════════════════════════
// 10. HIERARCHY SELECTOR
// ═══════════════════════════════════════════════════════════════════

let _allStates = [];
let _tierTwoState = null; // currently selected state in Tier 2

async function openHierarchySelector() {
    const overlay = document.getElementById("hierarchy-selector");
    overlay.classList.remove("hidden", "fading");

    // Ensure Tier 1 is showing
    document.getElementById("hs-tier1").style.display = "";
    document.getElementById("hs-tier2").classList.add("hidden");
    document.getElementById("hs-search").value = "";

    if (_allStates.length === 0) {
        _allStates = await DataService.getAllStates();
    }

    renderStateGrid(_allStates);
}

function closeHierarchySelector() {
    const overlay = document.getElementById("hierarchy-selector");
    overlay.classList.add("fading");
    setTimeout(() => overlay.classList.add("hidden"), 160);
}

function renderStateGrid(states) {
    const grid = document.getElementById("hs-state-grid");
    grid.innerHTML = "";

    states.forEach(state => {
        const cell = document.createElement("div");
        cell.className = "state-cell" + (state.id === AppState.currentStateId ? " active" : "");
        cell.setAttribute("role", "listitem");
        cell.setAttribute("tabindex", "0");
        cell.innerHTML = `
      <div class="state-name">${state.name}</div>
      ${state.activeAlertCount > 0
                ? `<div class="state-alert-badge"><div class="state-alert-dot"></div>${state.activeAlertCount} alerts</div>`
                : ""}`;
        cell.addEventListener("click", () => loadTierTwo(state));
        cell.addEventListener("keydown", e => { if (e.key === "Enter") loadTierTwo(state); });
        grid.appendChild(cell);
    });
}

async function loadTierTwo(state) {
    _tierTwoState = state;
    document.getElementById("hs-tier1").style.display = "none";
    const tier2 = document.getElementById("hs-tier2");
    tier2.classList.remove("hidden");
    document.getElementById("hs-t2-state-name").textContent = state.name;

    const districts = await DataService.getDistrictsForState(state.id);
    renderDistrictListMirror(districts);
    renderDistrictSVGMap(districts);
}

function renderDistrictListMirror(districts) {
    const list = document.getElementById("hs-district-list");
    list.innerHTML = "";
    districts.forEach(district => {
        const row = document.createElement("div");
        row.className = "dist-list-row" + (district.id === AppState.currentDistrictId ? " active" : "");
        row.setAttribute("role", "listitem");
        row.setAttribute("tabindex", "0");
        row.innerHTML = `
      <span class="dist-list-name">${district.name}</span>
      ${district.activeAlertCount > 0
                ? `<span class="dist-list-alert">${district.activeAlertCount}</span>`
                : ""}`;
        row.addEventListener("click", () => selectDistrict(district));
        row.addEventListener("keydown", e => { if (e.key === "Enter") selectDistrict(district); });
        list.appendChild(row);
    });
}

function renderDistrictSVGMap(districts) {
    const svg = document.getElementById("hs-district-svg");
    svg.innerHTML = "";

    // Simple grid-style SVG map — positions districts in a rough grid
    // (Real implementation would use simplified GeoJSON projected to SVG)
    const W = 400, H = 380;
    const cols = Math.ceil(Math.sqrt(districts.length));
    const cellW = W / cols;
    const cellH = H / Math.ceil(districts.length / cols);

    districts.forEach((district, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cellW + cellW * 0.1;
        const y = row * cellH + cellH * 0.1;
        const w = cellW * 0.8;
        const h = cellH * 0.8;

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", w);
        rect.setAttribute("height", h);
        rect.setAttribute("rx", "2");
        rect.classList.add("dist-poly");
        if (district.id === AppState.currentDistrictId) rect.classList.add("active");
        rect.addEventListener("click", () => selectDistrict(district));

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", x + w / 2);
        label.setAttribute("y", y + h / 2 + 4);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-size", "10");
        label.setAttribute("fill", "rgba(255,255,255,0.7)");
        label.setAttribute("font-family", "DM Mono, monospace");
        label.textContent = district.name;

        svg.appendChild(rect);
        svg.appendChild(label);

        // Alert dot
        if (district.activeAlertCount > 0) {
            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", x + w - 6);
            dot.setAttribute("cy", y + 6);
            dot.setAttribute("r", "4");
            dot.classList.add("dist-alert-dot");
            svg.appendChild(dot);
        }
    });
}

async function selectDistrict(district) {
    // Close AI panel on district change (Section 09)
    closeAIPanel();

    closeHierarchySelector();
    await loadDistrict(district.id, district.stateId);
}

function initHierarchySelector() {
    document.getElementById("tb-change-area").addEventListener("click", openHierarchySelector);
    document.getElementById("hs-close").addEventListener("click", closeHierarchySelector);
    document.getElementById("hs-t2-close").addEventListener("click", closeHierarchySelector);
    document.getElementById("hs-back").addEventListener("click", () => {
        document.getElementById("hs-tier2").classList.add("hidden");
        document.getElementById("hs-tier1").style.display = "";
    });

    // Search filter
    document.getElementById("hs-search").addEventListener("input", e => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll(".state-cell").forEach(cell => {
            const name = cell.querySelector(".state-name").textContent.toLowerCase();
            cell.classList.toggle("hidden", !name.includes(q));
        });
    });

    // Close on overlay background click
    document.getElementById("hierarchy-selector").addEventListener("click", e => {
        if (e.target === e.currentTarget) closeHierarchySelector();
    });
}

// ═══════════════════════════════════════════════════════════════════
// 11. MODE TOGGLE
// ═══════════════════════════════════════════════════════════════════

function initModeToggle() {
    document.getElementById("mode-district").addEventListener("click", () => setMode("district"));
    document.getElementById("mode-live").addEventListener("click", () => setMode("live"));
}

// ═══════════════════════════════════════════════════════════════════
// 12. LOCALE / LANGUAGE
// ═══════════════════════════════════════════════════════════════════

async function switchLocale(locale) {
    AppState.locale = locale;
    const translation = await DataService.getTranslation(locale);
    AppState.translations = translation.strings;
    renderLanguageSelector();
    // Re-render timeline with updated strings (timestamps are locale-neutral)
    renderTimeline(AppState.events);
    renderFocusState();
}

// ═══════════════════════════════════════════════════════════════════
// 13. LIVE UPDATE HANDLER
// ═══════════════════════════════════════════════════════════════════

function onLiveUpdate({ type, event }) {
    if (type === "event.new") {
        AppState.events.push(event);
        AppState.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        renderTimeline(AppState.events);
        if (AppState.focusedEventId) renderFocusState();
    } else if (type === "event.updated") {
        const idx = AppState.events.findIndex(e => e.id === event.id);
        if (idx !== -1) AppState.events[idx] = event;
        renderTimeline(AppState.events);
    } else if (type === "event.expired") {
        AppState.events = AppState.events.filter(e => e.id !== event.id);
        if (AppState.focusedEventId === event.id) setFocusedEvent(null);
        renderTimeline(AppState.events);
    }
    // Refresh arbitration after any data update (edge_cases §5)
    runAnimationArbitration();
}

// ═══════════════════════════════════════════════════════════════════
// 14. BOOT SEQUENCE
// ═══════════════════════════════════════════════════════════════════

async function boot() {
    initMap();
    initTimelineCollapse();
    initTimelinePanelTap();
    initAIPanel();
    initHierarchySelector();
    initModeToggle();
    initTimeAxisControls();

    // Load initial district (Khordha, OD)
    await prefetchRegions();
    await loadDistrict("khordha", "OD");

    // Render language selector after translations loaded
    await renderLanguageSelector();

    console.log("[V4] Boot complete.");
}

boot();
