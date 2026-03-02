const https = require('https');
const fs = require('fs');

const query = `[out:json];
area["name"="Delhi"]["admin_level"="4"]->.searchArea;
relation["admin_level"="6"](area.searchArea);
out geom;`;

const data = new URLSearchParams({ data: query }).toString();

const options = {
    hostname: 'overpass-api.de',
    path: '/api/interpreter',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'Nodejs/OpenDistricts'
    }
};

const req = https.request(options, res => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        fs.writeFileSync('osm_delhi.json', body);
        console.log('Saved roughly ' + body.length + ' bytes of OSM JSON.');
    });
});
req.on('error', e => console.error(e));
req.write(data);
req.end();
