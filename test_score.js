const fs = require('fs');
const data = JSON.parse(fs.readFileSync('backend/data/kb.json', 'utf8'));
const { searchKnowledge } = require('./frontend/src/utils/storage.js');

searchKnowledge('什么是六顶帽子？', 10, data.docs).then(res => {
    console.log('\n--- 什么是六顶帽子？ ---');
    console.log('Hits length:', res.length);
    res.forEach(r => console.log('Doc:', r.name, 'Score:', r.score.toFixed(4)));
});
