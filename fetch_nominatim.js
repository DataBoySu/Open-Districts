const https = require('https');
const fs = require('fs');
const path = require('path');

const districts = [
    { id: "central", search: "Central Delhi" },
    { id: "east", search: "East Delhi" },
    { id: "new_delhi", search: "New Delhi" },
    { id: "north", search: "North Delhi" },
    { id: "north_east", search: "North East Delhi" },
    { id: "north_west", search: "North West Delhi" },
    { id: "shahdara", search: "Shahdara district" },
    { id: "south", search: "South Delhi" },
    { id: "south_east", search: "South East Delhi" },
    { id: "south_west", search: "South West Delhi" },
    { id: "west", search: "West Delhi" }
];

const dlFeatures = [];
let processed = 0;

function fetchDistrict(district, index) {
    // Adding timeout to avoid hitting rate limits
    setTimeout(() => {
        const query = encodeURIComponent(district.search + ', Delhi, India');
        // Ensure format=jsonv2 and polygon_geojson=1
        const url = `https://nominatim.openstreetmap.org/search.php?q=${query}&polygon_geojson=1&format=jsonv2`;

        console.log(`Fetching ${district.search}...`);

        https.get(url, { headers: { 'User-Agent': 'Node/OpenDistricts (Bot)' } }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    // Find the best match that is an administrative boundary
                    const boundary = json.find(j => j.addresstype === 'county' || j.addresstype === 'district' || j.addresstype === 'state_district' || j.type === 'administrative');

                    if (boundary && boundary.geojson) {
                        const feature = {
                            type: "Feature",
                            id: district.id,
                            properties: {
                                id: district.id,
                                name: district.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                                stateId: "DL"
                            },
                            geometry: boundary.geojson
                        };
                        dlFeatures.push(feature);

                        // Save individual file
                        const featureColl = { type: "FeatureCollection", features: [feature] };
                        fs.writeFileSync(`data/geo/DL/${district.id}.geojson`, JSON.stringify(featureColl, null, 2));
                        console.log(`✅ Saved ${district.id}.`);
                    } else {
                        console.warn(`❌ No valid polygon found for ${district.search}`, json.map(j => j.type));
                    }
                } catch (e) {
                    console.error(`Error parsing ${district.search}:`, e.message);
                }

                processed++;
                if (processed === districts.length) {
                    // Save master DL file
                    const masterColl = { type: "FeatureCollection", features: dlFeatures };
                    fs.writeFileSync(`data/geo/DL.geojson`, JSON.stringify(masterColl, null, 2));
                    console.log(`🎉 Finished! Saved ${dlFeatures.length} districts to DL.geojson`);
                }
            });
        }).on('error', err => console.error(err));
    }, index * 1000); // 1 request per second to respect Nominatim limits
}

console.log("Starting Nominatim fetch loop...");
districts.forEach((d, i) => fetchDistrict(d, i));
