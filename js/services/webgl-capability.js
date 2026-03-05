export function detectAdvancedEffectsSupport() {
    try {
        const hasDeck = typeof window !== "undefined" && !!window.deck;
        const canvas = document.createElement("canvas");
        const hasWebGL = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
        return hasDeck && hasWebGL;
    } catch (_) {
        return false;
    }
}

