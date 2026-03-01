// ─── EVENTS — OpenDistricts V4 ────────────────────────────────────────────────
// Data contract: id, stateId, districtId, regionId, category,
//   title, summary, timestamp, expiresAt, geoPoint, source,
//   verified, verifiedAt, location, meta
//
// ENCODING RULE: `category` drives all coloring and animation.
// `severity` and `severityScore` are NOT part of this schema.
// DO NOT reintroduce them.
//
// regionId must exactly match a properties.id in the district's .geojson file,
// or be null if the location cannot be confidently mapped to a sub-region.

export const MOCK_EVENTS = [

  // ── Gurugram, Haryana (Dec 2025 – Feb 2026) ───────────────────────────────
  // Source: Real events via research agent. Severity stripped per V4 schema.

  {
    id: "evt_HR_gurugram_20260131_001",
    stateId: "HR",
    districtId: "gurugram",
    regionId: "gurugram-sadar",
    category: "health",
    title: "ARI Spike — Winter Pollution Impact",
    summary: "2,293 acute respiratory illness emergencies recorded. 358 case increase over previous winter due to poor AQI.",
    timestamp: "2026-01-31T18:00:00Z",
    expiresAt: "2026-03-15T18:00:00Z",
    geoPoint: { lat: 28.4595, lng: 77.0266 },
    location: { block: "Gurugram Sadar — Civil Hospital, Medanta, Paras" },
    source: "Gurugram Health Dept / HT",
    verified: true,
    verifiedAt: "2026-01-31T23:23:00Z",
    meta: {
      caseCount: 2293,
      sentinelSites: ["Medanta", "Paras", "Civil Hospital Sector 10"],
      pollutantFocus: "PM2.5 / PM10"
    }
  },

  {
    id: "evt_HR_gurugram_20260203_001",
    stateId: "HR",
    districtId: "gurugram",
    regionId: "gurugram-sadar",
    category: "infrastructure",
    title: "Service Road Repairs — Sector 30/31",
    summary: "GMDA tenders floated for service lane upgrades and footpath repairs to reduce highway congestion.",
    timestamp: "2026-02-03T07:12:00Z",
    expiresAt: "2026-08-01T18:00:00Z",
    geoPoint: { lat: 28.4550, lng: 77.0580 },
    location: { block: "Sector 30-31, Gurugram" },
    source: "GMDA / Hindustan Times",
    verified: true,
    verifiedAt: "2026-02-03T09:00:00Z",
    meta: {
      projectLengthKm: 7.5,
      authority: "GMDA",
      scope: ["Service lane repair", "Encroachment removal"]
    }
  },

  {
    id: "evt_HR_gurugram_20260218_001",
    stateId: "HR",
    districtId: "gurugram",
    regionId: "gurugram-sadar",
    category: "mobility",
    title: "Fatal Crash — KMP Expressway",
    summary: "Dumper truck collision with tourist vehicle resulting in 2 fatalities. Significant traffic disruption reported.",
    timestamp: "2026-02-18T08:07:00Z",
    expiresAt: "2026-02-19T12:00:00Z",
    geoPoint: { lat: 28.3245, lng: 76.8521 },
    location: { block: "KMP Expressway, Gurugram-Rewari stretch" },
    source: "Gurugram Traffic Police",
    verified: true,
    verifiedAt: "2026-02-18T09:30:00Z",
    meta: {
      vehicleTypes: ["Dumper", "Sedan"],
      fatalities: 2,
      highway: "KMP Expressway"
    }
  },

  {
    id: "evt_HR_gurugram_20260222_001",
    stateId: "HR",
    districtId: "gurugram",
    regionId: "badshahpur",
    category: "safety",
    title: "Serious Assault — Badshahpur Police Area",
    summary: "19-year-old student assaulted. Accused arrested under serious criminal charges. Investigation active.",
    timestamp: "2026-02-22T13:30:00Z",
    expiresAt: null,
    geoPoint: { lat: 28.3962, lng: 77.0543 },
    location: { block: "Badshahpur, Gurugram" },
    source: "Badshahpur Police / ANI",
    verified: true,
    verifiedAt: "2026-02-22T15:00:00Z",
    meta: {
      arrestStatus: "Accused in custody",
      incidentType: "Criminal Assault",
      station: "Badshahpur"
    }
  },

  {
    id: "evt_HR_gurugram_20251214_001",
    stateId: "HR",
    districtId: "gurugram",
    regionId: null,
    category: "weather",
    title: "Dense Fog — Massive Pile-up Advisory",
    summary: "Visibility < 50m causing multiple vehicle collisions across Haryana highways, including Gurugram sectors.",
    timestamp: "2025-12-14T12:34:00Z",
    expiresAt: "2025-12-16T12:00:00Z",
    geoPoint: { lat: 28.4595, lng: 77.0266 },
    location: { block: "District-wide highway corridors" },
    source: "IMD / Local News",
    verified: true,
    verifiedAt: "2025-12-14T13:00:00Z",
    meta: {
      visibilityMeters: 50,
      alertLevel: "orange",
      impact: "Highway pile-ups"
    }
  }

];
