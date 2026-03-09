const fs = require('fs');
const data = JSON.parse(fs.readFileSync('backend/data/kb.json', 'utf8'));

const makeNgrams = (str, n) => {
    const s = str.replace(/\s+/g, '');
    const result = [];
    for (let i = 0; i <= s.length - n; i++) result.push(s.slice(i, i + n));
    return result;
};

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

function testQuery(query) {
    const raw = query.toLowerCase().trim();
    const clean = raw.replace(/[\s\p{P}，。？！、；：""''（）【】《》…—·\n\r\t]+/gu, ' ').trim();
    const tokens = clean.split(/\s+/).filter(w => w.length >= 1);
    const ngrams2 = makeNgrams(clean.replace(/\s+/g, ''), 2);

    console.log(`\n========= Test Query: "${query}" =========`);
    const dfMap = {};
    const totalDocs = Math.max(1, data.docs.length);
    ngrams2.forEach(ng => {
        let count = 0;
        for (let i = 0; i < totalDocs; i++) {
            if (data.docs[i] && (data.docs[i].content || '').toLowerCase().includes(ng)) {
                count++;
            }
        }
        dfMap[ng] = Math.max(0.1, Math.log10(totalDocs / (count || 1)) + 0.1);
    });

    const maxQueryIdf = ngrams2.length > 0 ? Math.max(...ngrams2.map(ng => dfMap[ng] || 0.1)) : 0.1;
    console.log('maxQueryIdf:', maxQueryIdf);

    data.docs.forEach(doc => {
        const nameText = (doc.name || '').toLowerCase();
        const bodyText = (doc.content || '').toLowerCase();
        const docText = nameText + ' ' + bodyText;

        let score = 0;
        console.log('\n---', doc.name, '---');

        let maxHitIdf = 0;
        let dScore = 0;
        if (ngrams2.length > 0) {
            let hitScore = 0;
            ngrams2.forEach(ng => {
                if (bodyText.includes(ng)) {
                    const idfWeight = dfMap[ng] || 0.1;
                    if (idfWeight > maxHitIdf) maxHitIdf = idfWeight;
                    const freq = countFreqLim(bodyText, ng, 100);
                    const tfWeight = freq === Infinity ? 0.3 : (1 / Math.log10(freq + 9));
                    hitScore += (idfWeight * tfWeight);
                    console.log(`ngram hit: ${ng} freq:${freq} idf:${idfWeight.toFixed(3)} tf:${tfWeight.toFixed(3)} sum:${(idfWeight * tfWeight).toFixed(3)}`);
                }
            });
            dScore = (hitScore / ngrams2.length) * 25;
            score += dScore;
            console.log('+' + dScore.toFixed(3) + ' (D)');
        }

        if (maxQueryIdf > 0.35 && maxHitIdf < maxQueryIdf * 0.70) {
            console.log('REJECTED BY MAX QUERY IDF. maxHitIdf:', maxHitIdf, 'need:', maxQueryIdf * 0.70);
            score = 0;
        }

        let eScore = 0;
        tokens.forEach(tok => {
            if (tok.length >= 2) {
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
        console.log('Total Raw Score:', score.toFixed(4));
        console.log('Penalty:', lengthPenalty.toFixed(4));
        console.log('Final:', (score / lengthPenalty).toFixed(4));
    });
}

testQuery('抄表');
testQuery('如何抄表');
