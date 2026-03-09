const fs = require('fs');
const docs = JSON.parse(fs.readFileSync('./backend/data/kb.json', 'utf8')).docs;
docs.forEach(d => {
    const text = d.content;
    const lines = text.split('\n');
    lines.forEach((l, i) => {
        if (l.includes('STS1') || l.includes('STS2') || l.includes('STS4') || l.includes('STS6')) {
            console.log(`Doc: ${d.name} Line ${i+1}: ${l.trim()}`);
        }
    });
});
