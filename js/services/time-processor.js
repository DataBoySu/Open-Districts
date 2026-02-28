// ─── TIME PROCESSOR — OpenDistricts V4 ────────────────────────────────────────
// Schema source: docs/V4-transition-schema.md — Question 2
// This module is the ONLY place temporal aggregation logic lives.
// v4-app.js calls DataService.getTimeSeries(), which calls this module.
// When V5 swaps to a backend pre-aggregated bucket endpoint, this module
// becomes a pass-through normaliser. The calling code never changes.

// ── RESOLUTION DETECTION ──────────────────────────────────────────────────────

/**
 * Auto-detect the appropriate time resolution from an event array.
 * Checks the minimum gap between consecutive event timestamps.
 *
 * @param {Array} events  Array of Event objects (schema: docs/V4-transition-schema.md)
 * @returns {"hour"|"day"|"month"}
 */
export function detectResolution(events) {
    if (!events || events.length === 0) return "day";
    if (events.length === 1) return "day";

    const timestamps = events
        .map(e => new Date(e.timestamp).getTime())
        .sort((a, b) => a - b);

    const diffs = [];
    for (let i = 1; i < timestamps.length; i++) {
        diffs.push(timestamps[i] - timestamps[i - 1]);
    }

    const minDiff = Math.min(...diffs);

    if (minDiff < 3_600_000) return "hour";   // gaps < 1 hour → hourly
    if (minDiff < 86_400_000) return "day";    // gaps < 1 day  → daily
    return "month";
}

// ── BUCKET COMPUTATION ────────────────────────────────────────────────────────

/**
 * Bin events into time buckets for density ribbon rendering.
 *
 * @param {Array}  events      Array of Event objects
 * @param {"hour"|"day"|"month"} resolution
 * @returns {TimeBucket[]}
 *
 * TimeBucket shape (matches the backend contract for V5):
 * {
 *   startTs:      string (ISO UTC),
 *   endTs:        string (ISO UTC),
 *   eventCount:   number,
 *   maxSeverity:  "critical"|"elevated"|"informational"|"clear",
 *   severityScore: number (average of events in bucket, 0-100),
 *   hasData:      boolean
 * }
 */
export function computeTimeSeries(events, resolution) {
    if (!events || events.length === 0) return [];

    const SEVERITY_ORDER = { critical: 4, elevated: 3, informational: 2, clear: 1 };

    // Determine the full date range from the event set
    const timestamps = events.map(e => new Date(e.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    // Build bucket start times covering the full range
    const bucketStarts = _generateBucketStarts(minTime, maxTime, resolution);

    // Assign events to buckets
    const buckets = bucketStarts.map((startMs, i) => {
        const endMs = bucketStarts[i + 1] ?? _nextBucketStart(startMs, resolution);
        const bucketEvents = events.filter(e => {
            const t = new Date(e.timestamp).getTime();
            return t >= startMs && t < endMs;
        });

        if (bucketEvents.length === 0) {
            return {
                startTs: new Date(startMs).toISOString(),
                endTs: new Date(endMs).toISOString(),
                eventCount: 0,
                maxSeverity: "clear",
                severityScore: 0,
                hasData: false
            };
        }

        // Find highest severity in bucket
        const maxSevEvent = bucketEvents.reduce((best, e) =>
            (SEVERITY_ORDER[e.severity] ?? 0) > (SEVERITY_ORDER[best.severity] ?? 0) ? e : best
        );

        // Average severity score
        const avgScore = Math.round(
            bucketEvents.reduce((sum, e) => sum + (e.severityScore ?? 0), 0) / bucketEvents.length
        );

        return {
            startTs: new Date(startMs).toISOString(),
            endTs: new Date(endMs).toISOString(),
            eventCount: bucketEvents.length,
            maxSeverity: maxSevEvent.severity,
            severityScore: avgScore,
            hasData: true
        };
    });

    return buckets;
}

// ── DENSITY RIBBON COLOUR ─────────────────────────────────────────────────────

/**
 * Map a TimeBucket to its density ribbon RGBA colour string.
 * Encodes Section 07 density ribbon colour specification exactly.
 *
 * @param {Object} bucket  TimeBucket
 * @returns {string}  CSS rgba() string
 */
export function bucketToRibbonColour(bucket) {
    if (!bucket.hasData) return "rgba(255,255,255,0.06)";

    // Base opacity per severity class
    const BASE = {
        critical: { r: 207, g: 34, b: 46, baseOpacity: 0.45 },
        elevated: { r: 154, g: 103, b: 0, baseOpacity: 0.35 },
        informational: { r: 31, g: 111, b: 235, baseOpacity: 0.25 },
        clear: { r: 255, g: 255, b: 255, baseOpacity: 0.06 }
    };

    const c = BASE[bucket.maxSeverity] ?? BASE.clear;

    // Density tier bonus: +0.15 per tier above baseline (tiers: 1-2, 3-5, 6+)
    let densityBonus = 0;
    if (bucket.eventCount >= 6) densityBonus = 0.30;
    else if (bucket.eventCount >= 3) densityBonus = 0.15;

    const opacity = Math.min(0.85, c.baseOpacity + densityBonus);
    return `rgba(${c.r},${c.g},${c.b},${opacity.toFixed(2)})`;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function _generateBucketStarts(minMs, maxMs, resolution) {
    const starts = [];
    let current = _floorToUnit(minMs, resolution);
    while (current <= maxMs) {
        starts.push(current);
        current = _nextBucketStart(current, resolution);
    }
    return starts;
}

function _floorToUnit(ms, resolution) {
    const d = new Date(ms);
    if (resolution === "month") {
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    }
    if (resolution === "day") {
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    // hour
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours());
}

function _nextBucketStart(ms, resolution) {
    const d = new Date(ms);
    if (resolution === "month") {
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    }
    if (resolution === "day") {
        return ms + 86_400_000;
    }
    return ms + 3_600_000;
}

/**
 * Format a timestamp for display in timeline cards.
 * Returns "Today · HH:MM" or "Day · HH:MM" (e.g. "Mon · 06:30")
 *
 * @param {string} isoTimestamp  ISO 8601 UTC string
 * @param {string} [nowIso]      Override "now" for testing
 * @returns {string}
 */
export function formatCardTime(isoTimestamp, nowIso) {
    const ts = new Date(isoTimestamp);
    const now = nowIso ? new Date(nowIso) : new Date();

    const isToday =
        ts.getUTCFullYear() === now.getUTCFullYear() &&
        ts.getUTCMonth() === now.getUTCMonth() &&
        ts.getUTCDate() === now.getUTCDate();

    const hh = String(ts.getUTCHours()).padStart(2, "0");
    const mm = String(ts.getUTCMinutes()).padStart(2, "0");
    const timeStr = `${hh}:${mm}`;

    if (isToday) return `Today · ${timeStr}`;

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${days[ts.getUTCDay()]} · ${timeStr}`;
}
