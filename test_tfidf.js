const fs = require('fs');
const data = JSON.parse(fs.readFileSync('backend/data/kb.json', 'utf8'));

const makeNgrams = (str, n) => {
    const s = str.replace(/\s+/g, '');
    const result = [];
    for (let i = 0; i <= s.length - n; i++) result.push(s.slice(i, i + n));
    return result;
};

function countFreqLim(str, term, limit = 50) {
    if (!term) return 0;
    let cnt = 0;
    let pos = str.indexOf(term);
    while (pos !== -1 && cnt < limit) {
        cnt++;
        pos = str.indexOf(term, pos + term.length);
    }
    return cnt === limit ? Infinity : cnt;
}

const getScores = (query) => {
    const clean = query.replace(/\s+/g, '').toLowerCase();
    const ngrams2 = makeNgrams(clean, 2);
    const salientTerms = clean.match(/[a-z0-9]{2,}/g) || [];
    const scored = [];
    data.docs.forEach(doc => {
        let score = 0;
        const bodyText = doc.content.toLowerCase();

        let missingSalient = false;
        salientTerms.forEach(t => {
            const regex = new RegExp('\\b' + t + '\\b', 'i');
            if (!regex.test(bodyText)) missingSalient = true;
        });
        if (missingSalient) return;

        let hitScore = 0;
        ngrams2.forEach(ng => {
            const freq = countFreqLim(bodyText, ng, 100);
            if (freq > 0) {
                // TF-IDF: freq refers to the count IN the document.
                // We penalize words that appear many times, because they are stop words (like 功能).
                // "六顶" freq=2 -> weight=0.7. "哪些" freq=102 -> weight=0.1
                const weight = freq === Infinity ? 0.05 : 1 / Math.sqrt(freq);
                hitScore += weight;
            }
        });
        score += (hitScore / ngrams2.length) * 15;

        const lengthPenalty = Math.max(1, Math.log10((bodyText.length || 1) / 1000));
        scored.push({ name: doc.name, score: score / lengthPenalty });
    });
    console.log('\nQuery:', query);
    scored.sort((a, b) => b.score - a.score).forEach(d => console.log(d.name.substring(0, 20), d.score.toFixed(4)));
};

getScores('什么是六顶帽子？');
getScores('cis抄表有哪些功能？');
