const fs = require('fs');
const data = JSON.parse(fs.readFileSync('backend/data/kb.json', 'utf8'));
const { searchKnowledge } = require('./frontend/src/utils/storage.js');

async function testQuery(query) {
    console.log('\n======================================');
    console.log(`Testing Query: '${query}'`);

    // 直接复印一点 storage.js 里面的算分规则打印
    const raw = query.toLowerCase().trim();
    const clean = raw.replace(/[\s\p{P}，。？！、；：""''（）【】《》…—·\n\r\t]+/gu, ' ').trim();
    const tokens = clean.split(/\s+/).filter(w => w.length >= 1);

    const makeNgrams = (str, n) => {
        const s = str.replace(/\s+/g, '');
        const result = [];
        for (let i = 0; i <= s.length - n; i++) result.push(s.slice(i, i + n));
        return result;
    };
    const ngrams2 = makeNgrams(clean.replace(/\s+/g, ''), 2);

    console.log(`Tokens:`, tokens);
    console.log(`2-grams:`, ngrams2);

    const res = await searchKnowledge(query, 5, data.docs);
    console.log('Returned Docs:', res.length);
    res.forEach(r => {
        const docText = (r.name + ' ' + (r.content || '')).toLowerCase();
        const lenPenalty = Math.max(1, Math.log10((docText.length || 1) / 1000));
        console.log(`\n📄 Doc: ${r.name}`);
        console.log(`   Final Score: ${r.score.toFixed(4)}`);
        console.log(`   Length: ${docText.length} chars`);
        console.log(`   Length Penalty Factor: ${lenPenalty.toFixed(4)}`);
        console.log(`   Estimated Raw Score (Before Penalty): ${(r.score * lenPenalty).toFixed(4)}`);

        let exactPhrases = [];
        if (docText.includes(raw)) exactPhrases.push('RAW EXACT');
        if (clean && docText.includes(clean)) exactPhrases.push('CLEAN EXACT');
        console.log(`   Exact Contains: ${exactPhrases.join(', ') || 'NONE'}`);
    });
}

(async () => {
    await testQuery('如何抄表');
    await testQuery('我想知道在系统进行抄表需要进行什么操作，有哪些步骤');
})();
