Scope: Rendering layer only. No schema mutation.

1. Activation Model

Live Mode is toggled via top bar mode switch.

No confirmation dialog.

No warning UI.

No demo intensity tier.

Mode switch triggers:

Re-run animation arbitration

Enable environmental overlays

Increase polygon animation amplitude

Live Mode does not modify:

Event schema

TimeBucket schema

DataService behavior

Store structure

2. Animation Governance — Live Mode
2.1 Maximum Active Animations

At any time:

Max 1 Tier 1 polygon

Max 2 Tier 2 polygons

All others static

Total animated regions ≤ 3.

This cap is absolute.

2.2 Tier Assignment Rules

Sort visible regions by:

severityScore (descending)

timestamp (descending)

regionId (lexical ascending)

This guarantees deterministic selection.

2.3 Tier Behaviors
Tier 1 (Primary Region — 1 max)

Border breathe: 2.2s cycle

Opacity oscillation: 35% → 75%

Glow radius pulse

Slight stroke-width oscillation allowed

No scale transform of polygon geometry

Tier 2 (Secondary Regions — 2 max)

Border opacity drift: 30% → 50%

3.5s cycle

No glow

No stroke width change

No geometry transform

Tier 3 (All others)

Static fill

Static border

No animation

3. Environmental Motion Layers

Enabled only when:

AppState.mode === "live"
AND
AppState.connectionStatus === "live"

Disabled immediately on:

Historical scrub

Mode switch back to district

3.1 Rain Overlay

CSS repeating-linear-gradient

background-position animation only

0.8s cycle

pointer-events: none

No opacity flashing

3.2 Haze Overlay

Radial gradient

5s opacity drift

Max opacity 0.18

No luminance flashing

3.3 Overlay Constraints

Environmental overlays:

Must never exceed polygon z-index

Must never trigger layout reflow

Must use transform or opacity only

Must not stack more than 2 layers

4. Time Axis in Live Mode

Density ribbon allowed subtle shimmer

Playhead allowed slightly stronger glow

Sync dot pulse unchanged

No flashing > 3 Hz

No color cycling

5. Arbitration Execution Triggers

Arbitration must run on:

map moveend

timeCursor change

data update

mode switch

connectionStatus change

Debounce map moveend by 300ms.

6. Performance Degradation Rules

Even on Pi 5, guardrails apply.

If arbitration > 16ms:

Disable Tier 2 for that frame

If > 20ms:

Collapse to District arbitration model (Tier 1 only)

If repeated 3 consecutive frames > 20ms:

Log console warning

Disable environmental overlays

Never queue missed frames.

Never block main thread.

7. Historical Mode Interaction

When playhead leaves live edge:

Immediately:

Disable environmental overlays

Collapse to District arbitration (Tier 1 only)

Change sync dot state

When returning to live edge:

Re-enable Live Mode motion

Re-run arbitration

8. Rapid Pan Behavior

During continuous pan:

Suspend arbitration

Suspend Tier animations

Resume 300ms after moveend

Prevents flicker during throw gestures.

9. Edge Case Matrix
Case: Only 1 visible region

→ Tier 1 only.

Case: 2 visible regions

→ Tier 1 + Tier 2(1).

Case: No severity events

→ Environmental overlays only.

Case: Identical severity + timestamp

→ regionId lexical tie-breaker.

Case: Autoplay fast-forward

→ Arbitration per bucket.
→ Degrade Tier 2 first if performance drops.

10. Strict Prohibitions

Live Mode must never:

Animate more than 3 regions

Scale polygon geometry

Trigger full GeoJSON redraw

Modify raw event objects

Override severity class assignment

Increase flash rate beyond compliance