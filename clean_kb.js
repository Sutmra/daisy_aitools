const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'backend', 'data', 'kb.json');
const raw = fs.readFileSync(p, 'utf8');
const data = JSON.parse(raw);
const seen = new Set();
const uniqueDocs = [];
for (const d of data.docs) {
    if (!seen.has(d.name)) {
        seen.add(d.name);
        uniqueDocs.push(d);
    }
}
data.docs = uniqueDocs;
fs.writeFileSync(p, JSON.stringify(data, null, 2));
console.log('Cleaned ' + (data.docs.length) + ' unique docs.');
