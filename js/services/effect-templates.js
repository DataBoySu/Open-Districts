export const EFFECT_TEMPLATE_REGISTRY = {
    accident_default: {
        advancedProfile: "auto",
        advancedEffects: [],
    },
    disease_cluster: {
        advancedProfile: "desktop",
        advancedEffects: [
            { type: "DISEASE_SMOG", geometrySource: "heatPoints", intensity: 0.7, zOrder: 25 },
            { type: "SKULL_SIGNS", geometrySource: "multiPoints", intensity: 0.5, zOrder: 30 },
        ],
    },
    gas_leak: {
        advancedProfile: "desktop",
        advancedEffects: [
            { type: "GAS_PLUME_3D", geometrySource: "geoPoint", intensity: 0.8, zOrder: 40 },
        ],
    },
    road_closure: {
        advancedProfile: "auto",
        advancedEffects: [
            { type: "ROAD_BUILD", geometrySource: "pathCoords", intensity: 0.5, zOrder: 15 },
        ],
    },
    temperature_rise: {
        advancedProfile: "desktop",
        advancedEffects: [
            { type: "TEMP_RISE", geometrySource: "heatPoints", intensity: 0.7, zOrder: 20 },
        ],
    },
    temperature_drop: {
        advancedProfile: "desktop",
        advancedEffects: [
            { type: "TEMP_DROP", geometrySource: "heatPoints", intensity: 0.7, zOrder: 20 },
        ],
    },
};

