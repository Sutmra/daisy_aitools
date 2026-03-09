const fs = require('fs');
const data = JSON.parse(fs.readFileSync('backend/data/kb.json', 'utf8'));
const makeNgrams = (str, n) => {
    const s = str.replace(/\s+/g, '');
    const result = [];
    for (let i = 0; i <= s.length - n; i++) result.push(s.slice(i, i + n));
    return result;
};

const query = 'cis抄表有哪些功能';
const clean = query.replace(/\s+/g, '').toLowerCase();
const ngrams2 = makeNgrams(clean, 2);
const salientTerms = clean.match(/[a-z0-9]{2,}/g) || [];

const scored = [];
data.docs.forEach(doc => {
    let score = 0;
    const bodyText = doc.content.toLowerCase();

    // 强制显著英文数字匹配
    let missingSalient = false;
    salientTerms.forEach(t => { if (!bodyText.includes(t)) missingSalient = true; });
    if (missingSalient) {
        scored.push({ name: doc.name, score: 0, raw: 0 });
        return;
    }

    let hits = 0;
    ngrams2.forEach(ng => { if (bodyText.includes(ng)) hits++; });
    score += (hits / ngrams2.length) * 8;

    // length penalty
    const lengthPenalty = Math.max(1, Math.log10((bodyText.length || 1) / 1000));
    const finalScore = score / lengthPenalty;

    scored.push({ name: doc.name, score: finalScore, raw: score });
});

scored.sort((a, b) => b.score - a.score);
const topScore = scored[0].score;
console.log('Top Score:', topScore.toFixed(2));
scored.forEach(d => {
    const keep = d.score >= topScore * 0.45 && d.score > 0;
    console.log((keep ? '[KEEP]' : '[DROP]'), d.name, d.score.toFixed(2));
});
