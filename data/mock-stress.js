// ── STRESS TEST MOCK DATA ───────────────────────────────────────────
// This file injects 150 active events and a 12x12 geographic grid to
// deliberately stress-test the arbitration engine and Leaflet SVG renderer.

export const generateStressEvents = () => {
    const events = [];
    const severities = ["critical", "elevated", "informational", "clear"];
    const baseLat = 20.2;
    const baseLng = 85.8;

    // We create a massive grid of 12x12 = 144 regions
    let count = 0;
    for (let x = 0; x < 12; x++) {
        for (let y = 0; y < 12; y++) {
            count++;
            const revId = `stress-${count}`;

            // heavily weight towards higher severities to force arbitration logic
            const sev = Math.random() > 0.8 ? "critical" : (Math.random() > 0.5 ? "elevated" : "informational");

            events.push({
                id: `evt-stress-${count}`,
                title: `Stress Event ${x}-${y}`,
                description: "Auto-generated load test event",
                source: "System Load Test",
                timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
                stateId: "OD",
                districtId: "stress",
                regionId: revId,
                severity: sev,
                severityScore: Math.floor(Math.random() * 100),
                type: "outbreak",
                tags: ["stress"],
                geoPoint: { lat: baseLat + x * 0.05, lng: baseLng + y * 0.05 }
            });
        }
    }

    return events;
};
