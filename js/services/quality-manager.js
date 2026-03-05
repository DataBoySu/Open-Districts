const FPS_WINDOW = 20;

export function createQualityManager() {
    const frameTimes = [];
    let tier = "high";

    return {
        pushFrameMs(ms) {
            frameTimes.push(ms);
            if (frameTimes.length > FPS_WINDOW) frameTimes.shift();
            const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
            if (avg > 28) tier = "low";
            else if (avg > 20) tier = "medium";
            else tier = "high";
            return tier;
        },
        currentTier() {
            return tier;
        },
        applyIntensityScale(effect) {
            const scale = tier === "high" ? 1 : (tier === "medium" ? 0.75 : 0.5);
            return { ...effect, intensity: Math.max(0, Math.min(1, (effect.intensity ?? 0.5) * scale)) };
        },
    };
}

