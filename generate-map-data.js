import fs from 'node:fs';
import path from 'node:path';

const svgPath = path.join(process.cwd(), 'travel-map', 'images', 'china-map.svg');
const outPath = path.join(process.cwd(), 'travel-map', 'map-data.js');

const svg = fs.readFileSync(svgPath, 'utf-8');
const output = 'window.EMBEDDED_CHINA_MAP_SVG = ' + JSON.stringify(svg) + ';\n';
fs.writeFileSync(outPath, output, 'utf-8');
console.log('Successfully wrote map-data.js:', fs.statSync(outPath).size);
