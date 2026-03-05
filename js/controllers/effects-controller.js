import { resolveAdvancedEffectsForEvent } from "../services/effect-resolver.js";
import { createQualityManager } from "../services/quality-manager.js";
import { detectAdvancedEffectsSupport } from "../services/webgl-capability.js";

let _ctx;
let _map;
let _quality;
let _overlayHost;
let _active = false;
let _rafId = null;

export function init(ctx) {
    _ctx = ctx;
    _quality = createQualityManager();
}

export function setMap(mapInstance) {
    _map = mapInstance;
}

export function syncMode({ mode, isHistorical, connectionStatus, envEnabled }) {
    const shouldRun = mode === "live" && !isHistorical && connectionStatus === "live" && envEnabled;
    if (!shouldRun) {
        _unmount();
        return;
    }
    if (!detectAdvancedEffectsSupport()) {
        _unmount();
        return;
    }
    _mountIfNeeded();
    _render(_ctx.state.events || []);
}

export function renderForEvents(events) {
    if (!_active) return;
    _render(events || []);
}

export function suspendForHistorical() {
    _unmount();
}

function _mountIfNeeded() {
    if (_active || !_map) return;
    const container = _map.getContainer?.();
    if (!container) return;

    _overlayHost = document.createElement("div");
    _overlayHost.className = "advanced-effects-host";
    _overlayHost.style.position = "absolute";
    _overlayHost.style.inset = "0";
    _overlayHost.style.pointerEvents = "none";
    _overlayHost.style.zIndex = "470";
    container.appendChild(_overlayHost);
    _active = true;
}

function _unmount() {
    if (_rafId) cancelAnimationFrame(_rafId);
    _rafId = null;
    if (_overlayHost?.parentNode) _overlayHost.parentNode.removeChild(_overlayHost);
    _overlayHost = null;
    _active = false;
}

function _render(events) {
    if (!_overlayHost) return;
    const t0 = performance.now();
    const layers = [];

    events.forEach((event) => {
        const resolved = resolveAdvancedEffectsForEvent(event);
        resolved.effects.forEach((fx) => {
            if (!fx.enabled) return;
            layers.push(_quality.applyIntensityScale({ ...fx, eventId: event.id }));
        });
    });

    // Prototype bridge: if deck.gl is present, apps can map these descriptors to real deck layers.
    _overlayHost.dataset.layers = String(layers.length);
    _overlayHost.dataset.preview = layers.slice(0, 4).map((l) => `${l.type}:${l.eventId}`).join("|");

    const frameMs = performance.now() - t0;
    _quality.pushFrameMs(frameMs);

    if (_ctx?.state) {
        _ctx.state.advancedEffectsStatus = {
            active: true,
            layers: layers.length,
            quality: _quality.currentTier(),
        };
    }
}

