const fs = require('fs');
const d3 = require('d3');

const stateGeo = JSON.parse(fs.readFileSync('data/geo/DL.geojson', 'utf8'));
const W = 400;
const H = 380;

const projection = d3.geoMercator().fitSize([W, H], stateGeo);
const pathGen = d3.geoPath().projection(projection);

console.log("Found", stateGeo.features.length, "features");

stateGeo.features.forEach(f => {
    const p = pathGen(f);
    const bounds = pathGen.bounds(f);
    const w = bounds[1][0] - bounds[0][0];
    const h = bounds[1][1] - bounds[0][1];
    const c = pathGen.centroid(f);

    let pathPreview = p.substring(0, 50);
    console.log(`${f.properties.name}:\n - Bounds: W=${w.toFixed(2)}, H=${h.toFixed(2)}\n - Centroid: ${c[0].toFixed(2)}, ${c[1].toFixed(2)}\n - Path string length: ${p.length}\n`);
});
