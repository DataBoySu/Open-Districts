// ─── TIME CONTROLLER - v4-app.js extraction ───────────────────────────────────
// Owns: time axis ruler + ribbon render, playhead drag, autoplay, historical mode.
// Receives: { state, ds, emit } context.
// Exports: init(ctx) → { renderTimeAxis, stopAutoPlay }
// ─────────────────────────────────────────────────────────────────────────────

import { bucketToRibbonColour } from "../services/time-processor.js";

let _ctx;

const _axis = {
    playheadFrac: 1.0,
    isDragging: false,
    isFF: false,
    buckets: [], // Added to support dynamic labels
};

const _idlePulse = {
    armTimer: null,
    pulseTimer: null,
};

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════

export function init(ctx) {
    _ctx = ctx;
    _initDrag();
    _initButtons();
    _armIdlePulse();
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC
// ═══════════════════════════════════════════════════════════════════

/** Build ruler + ribbon from TimeBucket array. */
export function renderTimeAxis(buckets) {
    const ruler = document.getElementById("ta-ruler");
    const ribbon = document.getElementById("ta-ribbon");
    if (!ruler || !ribbon) return;

    ruler.innerHTML = "";
    ribbon.innerHTML = "";

    if (!buckets || buckets.length === 0) return;

    _axis.buckets = buckets; // Store for playhead rendering
    const total = buckets.length;
    let lastDateStr = "";

    buckets.forEach((bucket, i) => {
        // Ribbon segment
        const seg = document.createElement("div");
        seg.className = "ribbon-seg";
        seg.style.width = `${100 / total}%`;
        seg.style.backgroundColor = bucketToRibbonColour(bucket);
        seg.title = bucket.startTs?.slice(0, 10) ?? "";
        ribbon.appendChild(seg);

        // Ruler tick
        const isMajor = i === 0 || i % Math.max(1, Math.floor(total / 7)) === 0;
        const tick = document.createElement("div");
        tick.className = isMajor ? "ta-tick-major" : "ta-tick-minor";
        tick.style.left = `${(i / total) * 100}%`;
        ruler.appendChild(tick);

        if (isMajor && bucket.startTs) {
            const d = new Date(bucket.startTs);
            const currentDateStr = `${d.getUTCDate()}-${d.getUTCMonth()}`;
            const isSameDate = (currentDateStr === lastDateStr);
            lastDateStr = currentDateStr;

            const label = document.createElement("div");
            label.className = "ta-tick-label";
            if (i === 0) {
                label.style.left = "0%";
                label.style.transform = "translateX(4px)";
                label.style.alignItems = "flex-start";
            } else if (i >= total - Math.max(1, Math.floor(total / 7))) {
                label.style.left = "100%";
                label.style.transform = "translateX(calc(-100% - 4px))";
                label.style.alignItems = "flex-end";
            } else {
                label.style.left = `${(i / total) * 100}%`;
            }
            label.innerHTML = _rulerLabel(bucket, isSameDate);
            ruler.appendChild(label);
        }
    });

    // Historical post-playhead overlay div (Phase 2 fix: no pseudo-element)
    let overlay = document.getElementById("ta-ribbon-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "ta-ribbon-overlay";
        ribbon.style.position = "relative";
        ribbon.appendChild(overlay);
    }

    _renderPlayhead();
}

export function stopAutoPlay() { _stopAutoPlay(); }
export function resumeAutoPlay(intervalMs = 250) { _startAutoPlay(intervalMs); }

/**
 * Restore the scrubber to a given fraction without triggering a scrub event.
 * Used when district changes but timelineRange is preserved - we need the
 * playhead to visually match the active temporal snapshot.
 * @param {number} frac  0–1
 */
export function setScrubberFrac(frac) {
    _axis.playheadFrac = Math.max(0, Math.min(1, frac ?? 1));
    _renderPlayhead();
}

// ═══════════════════════════════════════════════════════════════════
// PRIVATE
// ═══════════════════════════════════════════════════════════════════

function _renderPlayhead() {
    const ph = document.getElementById("ta-playhead");
    if (!ph) return;
    const frac = Math.max(0, Math.min(1, _axis.playheadFrac));
    const mainEl = document.getElementById("ta-main");
    if (mainEl) {
        ph.style.left = `${_leftPxFromFrac(mainEl, frac)}px`;
    } else {
        ph.style.left = `${frac * 100}%`;
    }

    // Post-playhead darkening overlay (explicit div - reliable across all browsers)
    const overlay = document.getElementById("ta-ribbon-overlay");
    if (overlay) {
        const pct = (1 - frac) * 100;
        overlay.style.cssText = `
      position: absolute;
      top: 0; right: 0; bottom: 0;
      width: ${pct}%;
      background: rgba(0,0,0,0.48);
      pointer-events: none;
      transition: width 120ms linear;
    `;
    }

    // Notify orchestrator of historical state change
    // v4-app handles the badge labeling now
    const isNowHistorical = frac < 0.99;
    if (isNowHistorical !== _ctx.state.isHistorical) {
        _ctx.emit("time:historicalChanged", { isHistorical: isNowHistorical });
    }
}

// ── SVG Icons ──────────────────────────────────────────────────────
const ICON_PLAY = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M5 3l14 9-14 9V3z"/></svg>`;
const ICON_PAUSE = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>`;

// ── Drag ──────────────────────────────────────────────────────────
function _initDrag() {
    const handle = document.getElementById("ta-playhead-handle");
    const mainEl = document.getElementById("ta-main");
    const ribbon = document.getElementById("ta-ribbon");

    // Mouse drag
    handle.addEventListener("mousedown", e => {
        _axis.isDragging = true;
        _registerInteraction();
        _stopAutoPlay();
        e.preventDefault();
    });

    document.addEventListener("mousemove", e => {
        if (!_axis.isDragging) return;
        _axis.playheadFrac = _fracFromClientX(e.clientX, mainEl);
        _renderPlayhead();
        _ctx.emit("time:scrub", { frac: _axis.playheadFrac });
    });

    document.addEventListener("mouseup", () => {
        if (_axis.isDragging) {
            _axis.isDragging = false;
            _registerInteraction();
        }
    });

    // Click anywhere on ribbon to jump
    ribbon.addEventListener("click", e => {
        _registerInteraction();
        _axis.playheadFrac = _fracFromClientX(e.clientX, mainEl);
        _renderPlayhead();
        _stopAutoPlay();
        _ctx.emit("time:scrub", { frac: _axis.playheadFrac });
    });

    // Touch (Pi touchscreen)
    handle.addEventListener("touchstart", e => {
        _axis.isDragging = true;
        _registerInteraction();
        _stopAutoPlay();
        e.preventDefault();
    }, { passive: false });

    document.addEventListener("touchmove", e => {
        if (!_axis.isDragging) return;
        _axis.playheadFrac = _fracFromClientX(e.touches[0].clientX, mainEl);
        _renderPlayhead();
        _ctx.emit("time:scrub", { frac: _axis.playheadFrac });
    });

    document.addEventListener("touchend", () => {
        if (_axis.isDragging) {
            _axis.isDragging = false;
            _registerInteraction();
        }
    });

    // Interacting anywhere in the time axis should defer idle pulse.
    mainEl.addEventListener("pointerdown", _registerInteraction);
}

// ── Buttons ───────────────────────────────────────────────────────
function _initButtons() {
    document.getElementById("ta-play").addEventListener("click", () => {
        _registerInteraction();
        if (_ctx.state.isAutoPlaying) { _stopAutoPlay(); } else { _startAutoPlay(250); }
    });

    document.getElementById("ta-ff").addEventListener("click", () => {
        _registerInteraction();
        if (_ctx.state.isAutoPlaying && _axis.isFF) { _stopAutoPlay(); } else { _startAutoPlay(100); }
    });

    // Stop button - reset to LIVE
    document.getElementById("ta-stop").addEventListener("click", () => {
        _registerInteraction();
        _stopAutoPlay();
        _axis.playheadFrac = 1.0;
        _renderPlayhead();
        _ctx.emit("time:scrub", { frac: 1.0 });
    });

    // Stop autoplay on map or ribbon touch
    document.getElementById("map").addEventListener("pointerdown", _stopAutoPlay);
}

// ── Autoplay ──────────────────────────────────────────────────────
function _startAutoPlay(intervalMs) {
    _stopAutoPlay();
    _setIdlePulse(false);
    _clearIdlePulseTimers();
    _ctx.state.isAutoPlaying = true;
    _axis.isFF = intervalMs < 500;

    const playBtn = document.getElementById("ta-play");
    playBtn.classList.add("playing");
    playBtn.innerHTML = ICON_PAUSE; // Switch to Pause symbol

    if (_axis.isFF) document.getElementById("ta-ff").classList.add("playing");

    const total = _ctx.state.timeBuckets?.length ?? 0;
    if (total === 0) return;

    _ctx.state.autoPlayBucketIndex = Math.floor(_axis.playheadFrac * total);

    _ctx.state.autoPlayTimer = setInterval(() => {
        const t0 = performance.now();
        _ctx.state.autoPlayBucketIndex++;

        if (_ctx.state.autoPlayBucketIndex >= total) {
            _stopAutoPlay();
            _axis.playheadFrac = 1.0;
            _renderPlayhead();
            _ctx.emit("time:scrub", { frac: 1.0 });
            return;
        }

        _axis.playheadFrac = _ctx.state.autoPlayBucketIndex / total;
        _renderPlayhead();
        _ctx.emit("time:bucketStep", { bucketIndex: _ctx.state.autoPlayBucketIndex });

        const elapsed = performance.now() - t0;
        if (elapsed > 16) {
            console.debug(`[V4/time] Autoplay step ${_ctx.state.autoPlayBucketIndex}: ${elapsed.toFixed(1)}ms`);
        }
    }, intervalMs);
}

function _stopAutoPlay() {
    clearInterval(_ctx.state.autoPlayTimer);
    _ctx.state.isAutoPlaying = false;
    _axis.isFF = false;

    const playBtn = document.getElementById("ta-play");
    if (playBtn) {
        playBtn.classList.remove("playing");
        playBtn.innerHTML = ICON_PLAY; // Revert to Play symbol
    }

    document.getElementById("ta-ff")?.classList.remove("playing");
    _armIdlePulse();
}

// ── Utilities ─────────────────────────────────────────────────────
function _rulerLabel(bucket, isSameDate) {
    const d = new Date(bucket.startTs);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateStr = `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;

    const dateHtml = isSameDate
        ? `<div class="ta-date" style="visibility: hidden;">${dateStr}</div>`
        : `<div class="ta-date">${dateStr}</div>`;

    // Show time underneath date if resolution suggests multiple sub-daily buckets
    if (bucket.resolution === "hour" || bucket.resolution === "half-hour") {
        const timeStr = d.toISOString().slice(11, 16); // Extract HH:MM
        return `${dateHtml}<div class="ta-time">${timeStr}</div>`;
    }
    return dateHtml;
}

function _setIdlePulse(on) {
    const handle = document.getElementById("ta-playhead-handle");
    if (!handle) return;
    handle.classList.toggle("idle-pulse", on);
}

function _clearIdlePulseTimers() {
    clearTimeout(_idlePulse.armTimer);
    clearTimeout(_idlePulse.pulseTimer);
    _idlePulse.armTimer = null;
    _idlePulse.pulseTimer = null;
}

function _registerInteraction() {
    _setIdlePulse(false);
    _armIdlePulse();
}

function _armIdlePulse() {
    _clearIdlePulseTimers();
    if (_ctx?.state?.isAutoPlaying || _axis.isDragging) return;

    // Reserved cue: pulse once only after user inactivity.
    _idlePulse.armTimer = setTimeout(() => {
        if (_ctx?.state?.isAutoPlaying || _axis.isDragging) return;
        _setIdlePulse(true);
        _idlePulse.pulseTimer = setTimeout(() => {
            _setIdlePulse(false);
            _armIdlePulse();
        }, 1100);
    }, 9000);
}

function _getPlayheadInsetPx(mainEl) {
    const handle = document.getElementById("ta-playhead-handle");
    const handleHalf = handle ? handle.offsetWidth / 2 : 18;
    return Math.max(12, handleHalf + 2);
}

function _leftPxFromFrac(mainEl, frac) {
    const width = mainEl.clientWidth || 0;
    const inset = _getPlayheadInsetPx(mainEl);
    const travel = Math.max(1, width - (inset * 2));
    return inset + (Math.max(0, Math.min(1, frac)) * travel);
}

function _fracFromClientX(clientX, mainEl) {
    const rect = mainEl.getBoundingClientRect();
    const inset = _getPlayheadInsetPx(mainEl);
    const minX = rect.left + inset;
    const maxX = rect.right - inset;
    const clampedX = Math.max(minX, Math.min(maxX, clientX));
    return (clampedX - minX) / Math.max(1, (maxX - minX));
}
