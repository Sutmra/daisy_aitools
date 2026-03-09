const fs = require('fs');
const data = JSON.parse(fs.readFileSync('backend/data/kb.json', 'utf8'));

const makeNgrams = (str, n) => {
    const s = str.replace(/\s+/g, '');
    const result = [];
    for (let i = 0; i <= s.length - n; i++) result.push(s.slice(i, i + n));
    return result;
};

// 极速带限制的词频统计（避免扫描几十万字的高频词）
const countFreqLim = (str, term, limit = 50) => {
    if (!term) return 0;
    let cnt = 0;
    let pos = str.indexOf(term);
    while (pos !== -1 && cnt < limit) {
        cnt++;
        pos = str.indexOf(term, pos + term.length);
    }
    return cnt === limit ? Infinity : cnt;
};

const query = '什么是六顶帽子？';
const raw = query.toLowerCase().trim();
const clean = raw.replace(/[\s\p{P}，。？！、；：""''（）【】《》…—·\n\r\t]+/gu, ' ').trim();
const tokens = clean.split(/\s+/).filter(w => w.length >= 1);
const salientTerms = clean.match(/[a-z0-9]{2,}/g) || [];
const ngrams2 = makeNgrams(clean.replace(/\s+/g, ''), 2); // 2-gram

data.docs.forEach(doc => {
    const nameText = (doc.name || '').toLowerCase();
    const bodyText = (doc.content || '').toLowerCase();
    const docText = nameText + ' ' + bodyText;

    let score = 0;
    console.log('\n---', doc.name, '---');

    let missingSalient = false;
    if (salientTerms.length > 0) {
        salientTerms.forEach(term => {
            const salientRegex = new RegExp('\\b' + term + '\\b', 'i');
            if (!salientRegex.test(docText)) {
                missingSalient = true;
            }
        });
    }
    if (missingSalient) {
        console.log('Miss salient!');
        return;
    }

    // Strategy A
    if (docText.includes(raw)) { score += 20; console.log('+20 (A)'); }
    // Strategy B
    if (clean && docText.includes(clean)) { score += 15; console.log('+15 (B)'); }

    let cScore = 0;
    tokens.forEach(tok => {
        if (nameText.includes(tok)) cScore += 8;
    });
    if (cScore) { score += cScore; console.log('+' + cScore + ' (C)'); }

    let dScore = 0;
    if (ngrams2.length > 0) {
        let hitScore = 0;
        ngrams2.forEach(ng => {
            const freq = countFreqLim(bodyText, ng, 100);
            if (freq > 0) {
                const weight = freq === Infinity ? 0.05 : (1 / Math.sqrt(freq));
                hitScore += weight;
                console.log('ngram2 hit:', ng, freq, weight);
            }
        });
        dScore = (hitScore / ngrams2.length) * 15;
        score += dScore;
        console.log('+' + dScore.toFixed(2) + ' (D)');
    }

    let eScore = 0;
    tokens.forEach(tok => {
        if (tok.length >= 2) {
            if (bodyText.includes(tok)) {
                const cnt = countFreqLim(bodyText, tok, 10);
                eScore += (cnt === Infinity ? 10 : cnt) * 3;
                console.log('tok raw include:', tok, (cnt === Infinity ? 10 : cnt) * 3);
            }
            if (!docText.includes(tok) && tok.length >= 3) {
                for (let len = tok.length - 1; len >= 3; len--) {
                    const sub = tok.slice(0, len);
                    if (docText.includes(sub)) { eScore += 1; console.log('tok sub:', sub); break; }
                }
            }
        }
    });
    if (eScore) { score += eScore; console.log('+' + eScore + ' (E)'); }

    const lengthPenalty = Math.max(1, Math.log10((bodyText.length || 1) / 1000));
    console.log('Total Score:', score.toFixed(2));
    console.log('Penalty:', lengthPenalty.toFixed(2));
    console.log('Final:', (score / lengthPenalty).toFixed(2));
});
