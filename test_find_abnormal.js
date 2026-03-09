const fs = require('fs');
const docs = JSON.parse(fs.readFileSync('./backend/data/kb.json', 'utf8')).docs;
const text = docs[0].content; // Assuming this is the training manual
const lines = text.split('\n');
lines.forEach((l, i) => {
    if (l.includes('异常')) {
        console.log(`Line ${i}: ${l.trim()}`);
    }
});
