import { EFFECT_TEMPLATE_REGISTRY } from "./effect-templates.js";

const VALID_EFFECT_TYPES = new Set([
    "RAIN_3D",
    "THUNDERSTORM",
    "DISEASE_SMOG",
    "SKULL_SIGNS",
    "ROAD_BUILD",
    "TEMP_RISE",
    "TEMP_DROP",
    "GAS_PLUME_3D",
]);

function inferTemplateKey(event) {
    if (event.effectTemplateKey) return event.effectTemplateKey;
    if (event.renderAs === "diffusion" || event.category === "emergency") return "gas_leak";
    if (event.renderAs === "corridor" || event.category === "mobility" || event.category === "infrastructure") return "road_closure";
    if (event.category === "health" || event.renderAs === "hotspot" || event.renderAs === "multi_marker") return "disease_cluster";
    return "accident_default";
}

function normalizeEffect(event, fx, index) {
    if (!fx || !VALID_EFFECT_TYPES.has(fx.type)) return null;
    return {
        id: fx.id || `fx_${event.id}_${index}`,
        type: fx.type,
        enabled: fx.enabled !== false,
        geometrySource: fx.geometrySource || "geoPoint",
        anchorRegionId: fx.anchorRegionId ?? event.regionId ?? null,
        intensity: typeof fx.intensity === "number" ? fx.intensity : 0.5,
        zOrder: typeof fx.zOrder === "number" ? fx.zOrder : 0,
        params: fx.params || {},
        lifecycle: fx.lifecycle || null,
    };
}

export function resolveAdvancedEffectsForEvent(event) {
    const templateKey = inferTemplateKey(event);
    const template = EFFECT_TEMPLATE_REGISTRY[templateKey] || EFFECT_TEMPLATE_REGISTRY.accident_default;
    const source = Array.isArray(event.advancedEffects) && event.advancedEffects.length
        ? event.advancedEffects
        : template.advancedEffects;
    const resolved = source
        .map((fx, index) => normalizeEffect(event, fx, index))
        .filter(Boolean)
        .filter((fx) => _hasGeometryForSource(event, fx.geometrySource));

    return {
        templateKey,
        advancedProfile: event.advancedProfile || template.advancedProfile || "auto",
        effects: resolved,
    };
}

function _hasGeometryForSource(event, source) {
    if (source === "geoPoint") return !!event.geoPoint;
    if (source === "regionPolygon") return !!event.regionId || (Array.isArray(event.regionIds) && event.regionIds.length > 0);
    if (source === "pathCoords") return !!event.meta?.pathCoords?.length;
    if (source === "heatPoints") return !!event.meta?.heatPoints?.length;
    if (source === "multiPoints") return !!event.meta?.multiPoints?.length;
    return false;
}

