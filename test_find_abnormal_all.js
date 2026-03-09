const fs = require('fs');
const docs = JSON.parse(fs.readFileSync('./backend/data/kb.json', 'utf8')).docs;
docs.forEach(d => {
    const text = d.content;
    const lines = text.split('\n');
    lines.forEach((l, i) => {
        if (l.includes('异常') || l.includes('账单')) {
            console.log(`Doc: ${d.name} Line ${i}: ${l.trim()}`);
        }
    });
});
