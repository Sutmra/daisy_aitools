const fs = require('fs');
const { searchKnowledge } = require('./frontend/src/utils/storage.js');
async function testQuery(query) {
    const docs = JSON.parse(fs.readFileSync('./backend/data/kb.json', 'utf8')).docs;
    const hitDocs = await searchKnowledge(query, 3, docs);
    console.log(`\n--- 测试: ${query} ---`);
    if (hitDocs.length === 0) console.log("No documents matched.");
    else hitDocs.forEach(d => console.log(`Doc: ${d.name} Score: ${d.score.toFixed(4)}`));
}
testQuery('我想知道在系统进行抄表需要进行什么操作，有哪些步骤');
