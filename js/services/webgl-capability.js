export function detectAdvancedEffectsSupport() {
    try {
        const canvas = document.createElement("canvas");
        const hasWebGL = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
        const has2D = !!canvas.getContext("2d");
        return hasWebGL || has2D;
    } catch (_) {
        return false;
    }
}
