// ─── HIERARCHY CONTROLLER — v4-app.js extraction ──────────────────────────────
// Owns: Change Area overlay, tier-1 state grid, tier-2 district map + list.
// Receives: { state, ds, emit } context.
// Exports: init(ctx) → { open, close }
// ─────────────────────────────────────────────────────────────────────────────

let _ctx;
let _allStates = [];
let _tierTwoState = null;

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════

export function init(ctx) {
    _ctx = ctx;

    document.getElementById("tb-change-area").addEventListener("click", () => open());
    document.getElementById("hs-close").addEventListener("click", () => close());
    document.getElementById("hs-t2-close").addEventListener("click", () => close());
    document.getElementById("hs-back").addEventListener("click", () => _backToTier1());

    // Close on backdrop click
    document.getElementById("hierarchy-selector").addEventListener("click", e => {
        if (e.target === e.currentTarget) close();
    });

    // State search filter
    document.getElementById("hs-search").addEventListener("input", e => {
        const q = e.target.value.toLowerCase().trim();
        document.querySelectorAll(".state-cell").forEach(cell => {
            const name = cell.querySelector(".state-name").textContent.toLowerCase();
            cell.classList.toggle("hidden", q.length > 0 && !name.includes(q));
        });
    });
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC
// ═══════════════════════════════════════════════════════════════════

export async function open() {
    const overlay = document.getElementById("hierarchy-selector");
    overlay.classList.remove("hidden", "fading");

    // Reset to Tier 1
    document.getElementById("hs-tier1").style.display = "";
    document.getElementById("hs-tier2").classList.add("hidden");
    document.getElementById("hs-search").value = "";

    if (_allStates.length === 0) {
        _allStates = await _ctx.ds.getAllStates();
    }

    _renderStateGrid(_allStates);
}

export function close() {
    const overlay = document.getElementById("hierarchy-selector");
    overlay.classList.add("fading");
    setTimeout(() => overlay.classList.add("hidden"), 160);
}

// ═══════════════════════════════════════════════════════════════════
// PRIVATE
// ═══════════════════════════════════════════════════════════════════

function _renderStateGrid(states) {
    const grid = document.getElementById("hs-state-grid");
    grid.innerHTML = "";

    states.forEach(state => {
        const cell = document.createElement("div");
        cell.className = "state-cell" + (state.id === _ctx.state.currentStateId ? " active" : "");
        cell.setAttribute("role", "listitem");
        cell.setAttribute("tabindex", "0");
        cell.innerHTML = `
      <div class="state-name">${state.name}</div>
      ${state.activeAlertCount > 0
                ? `<div class="state-alert-badge"><div class="state-alert-dot"></div>${state.activeAlertCount} alerts</div>`
                : ""}`;
        cell.addEventListener("click", () => _loadTierTwo(state));
        cell.addEventListener("keydown", e => { if (e.key === "Enter") _loadTierTwo(state); });
        grid.appendChild(cell);
    });
}

async function _loadTierTwo(state) {
    _tierTwoState = state;
    document.getElementById("hs-tier1").style.display = "none";
    const tier2 = document.getElementById("hs-tier2");
    tier2.classList.remove("hidden");
    document.getElementById("hs-t2-state-name").textContent = state.name;

    const districts = await _ctx.ds.getDistrictsForState(state.id);
    _renderListMirror(districts);
    _renderSVGMap(districts);
}

function _renderListMirror(districts) {
    const list = document.getElementById("hs-district-list");
    list.innerHTML = "";

    districts.forEach(district => {
        const row = document.createElement("div");
        row.className = "dist-list-row" + (district.id === _ctx.state.currentDistrictId ? " active" : "");
        row.setAttribute("role", "listitem");
        row.setAttribute("tabindex", "0");
        row.innerHTML = `
      <span class="dist-list-name">${district.name}</span>
      ${district.activeAlertCount > 0
                ? `<span class="dist-list-alert">${district.activeAlertCount}</span>`
                : ""}`;
        row.addEventListener("click", () => _selectDistrict(district));
        row.addEventListener("keydown", e => { if (e.key === "Enter") _selectDistrict(district); });
        list.appendChild(row);
    });
}

function _renderSVGMap(districts) {
    const svg = document.getElementById("hs-district-svg");
    svg.innerHTML = "";

    const W = 400, H = 380;
    const cols = Math.ceil(Math.sqrt(districts.length));
    const rows = Math.ceil(districts.length / cols);
    const cellW = W / cols;
    const cellH = H / rows;
    const PAD = 0.1;

    districts.forEach((district, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cellW + cellW * PAD;
        const y = row * cellH + cellH * PAD;
        const w = cellW * (1 - PAD * 2);
        const h = cellH * (1 - PAD * 2);

        // Polygon (rect as proxy for real shapefile)
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x); rect.setAttribute("y", y);
        rect.setAttribute("width", w); rect.setAttribute("height", h);
        rect.setAttribute("rx", "3");
        rect.classList.add("dist-poly");
        if (district.id === _ctx.state.currentDistrictId) rect.classList.add("active");
        rect.addEventListener("click", () => _selectDistrict(district));
        svg.appendChild(rect);

        // District name — centered within cell
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x + w / 2);
        text.setAttribute("y", y + h / 2 - 4);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", Math.min(10, Math.floor(cellH * 0.22)));
        text.setAttribute("font-family", "DM Mono, monospace");
        text.setAttribute("fill", "rgba(255,255,255,0.85)");
        text.setAttribute("pointer-events", "none");
        text.textContent = district.name;
        svg.appendChild(text);

        // Alert dot (top-right corner)
        if (district.activeAlertCount > 0) {
            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", x + w - 7); dot.setAttribute("cy", y + 7);
            dot.setAttribute("r", "4.5");
            dot.classList.add("dist-alert-dot");
            dot.setAttribute("pointer-events", "none");
            svg.appendChild(dot);
        }
    });
}

function _selectDistrict(district) {
    close();
    // Emit district change — orchestrator owns the data reload
    _ctx.emit("hierarchy:districtSelected", { districtId: district.id, stateId: district.stateId });
}

function _backToTier1() {
    document.getElementById("hs-tier2").classList.add("hidden");
    document.getElementById("hs-tier1").style.display = "";
}
