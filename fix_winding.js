const fs = require('fs');

function reverseWinding(geom) {
    if (geom.type === 'Polygon') {
        geom.coordinates.forEach(ring => ring.reverse());
    } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(poly => poly.forEach(ring => ring.reverse()));
    }
}

// 1. Fix DL.geojson (the state file)
let d = JSON.parse(fs.readFileSync('data/geo/DL.geojson', 'utf8'));
d.features.forEach(f => reverseWinding(f.geometry));
fs.writeFileSync('data/geo/DL.geojson', JSON.stringify(d, null, 2));
console.log('Fixed DL.geojson winding order');

// 2. Fix individual districts
const districts = [
    "central", "east", "new_delhi", "north", "north_east",
    "north_west", "shahdara", "south", "south_east", "south_west", "west"
];

for (const id of districts) {
    let df = JSON.parse(fs.readFileSync(`data/geo/DL/${id}.geojson`, 'utf8'));
    df.features.forEach(f => reverseWinding(f.geometry));
    fs.writeFileSync(`data/geo/DL/${id}.geojson`, JSON.stringify(df, null, 2));
    console.log(`Fixed ${id}.geojson`);
}
