const fs = require('fs');
const data = JSON.parse(fs.readFileSync('backend/data/kb.json', 'utf8'));
const { searchKnowledge } = require('./frontend/src/utils/storage.js');

async function testCurrent() {
    console.log('--- 测试: 如何抄表 ---');
    let res1 = await searchKnowledge('如何抄表', 5, data.docs);
    res1.forEach(r => console.log('Doc:', r.name, 'Score:', r.score.toFixed(4)));

    console.log('\n--- 测试: 我想知道在系统进行抄表需要进行什么操作，有哪些步骤 ---');
    let res2 = await searchKnowledge('我想知道在系统进行抄表需要进行什么操作，有哪些步骤', 5, data.docs);
    res2.forEach(r => console.log('Doc:', r.name, 'Score:', r.score.toFixed(4)));
}

testCurrent();
