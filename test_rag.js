const fs = require('fs');
const path = require('path');

const kbPath = path.join(__dirname, 'backend', 'data', 'kb.json');
const data = JSON.parse(fs.readFileSync(kbPath, 'utf8'));

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 极速带限制的词频统计（避免扫描百万字高频词）
function countFreqLim(str, term, limit = 50) {
    if (!term) return 0;
    let cnt = 0;
    let pos = str.indexOf(term);
    while (pos !== -1 && cnt < limit) {
        cnt++;
        pos = str.indexOf(term, pos + term.length);
    }
    return cnt === limit ? Infinity : cnt; // 如果达到 limit，认为是高频词直接无限大
}

async function searchKnowledge(query, topK = 3, externalDocs = null) {
    const startT = performance.now();
    const docs = externalDocs;
    if (!docs.length || !query.trim()) return [];

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
    const ngrams1 = makeNgrams(clean.replace(/\s+/g, ''), 1);

    const scored = [];
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const nameText = (doc.name || '').toLowerCase();
        const bodyText = (doc.content || '').toLowerCase();
        const docText = nameText + ' ' + bodyText;

        if (!docText.trim()) {
            scored.push({ ...doc, score: 0, matchedSnippet: '' });
            continue;
        }

        let score = 0;

        if (docText.includes(raw)) score += 20;
        if (clean && docText.includes(clean)) score += 15;

        tokens.forEach(tok => {
            if (nameText.includes(tok)) score += 8;
        });

        if (ngrams2.length > 0) {
            let hits = 0;
            ngrams2.forEach(ng => { if (docText.includes(ng)) hits++; });
            score += (hits / ngrams2.length) * 8;
        }

        tokens.forEach(tok => {
            if (tok.length >= 2) {
                if (bodyText.includes(tok)) {
                    // 仅使用受限统计替代全局 match
                    const cnt = countFreqLim(bodyText, tok, 10);
                    score += (cnt === Infinity ? 10 : cnt) * 3;
                }
                if (!docText.includes(tok) && tok.length >= 3) {
                    for (let len = tok.length - 1; len >= 3; len--) {
                        const sub = tok.slice(0, len);
                        if (docText.includes(sub)) { score += 1; break; }
                    }
                }
            }
        });

        if (score === 0 && ngrams1.length > 0) {
            let charHits = 0;
            ngrams1.forEach(c => { if (bodyText.includes(c)) charHits++; });
            score += (charHits / ngrams1.length) * 2;
        }

        let matchedSnippet = '';
        if (bodyText) {
            let hitIdx = -1;
            let rarestTerm = null;

            if (score > 0) {
                let minFreq = Infinity;

                const checkTerm = (term) => {
                    if (!term) return;
                    if (!bodyText.includes(term)) return;

                    const freq = countFreqLim(bodyText, term, 50); // 最多只查 50 次
                    if (freq > 0 && freq < minFreq) {
                        minFreq = freq;
                        rarestTerm = term;
                    }
                };

                // 只对核心 tokens 找稀有词。如果还没找到，才考虑 2-gram。不再扫描单字(极其昂贵且无用)。
                tokens.forEach(checkTerm);
                if (!rarestTerm && ngrams2) ngrams2.forEach(checkTerm);

                if (rarestTerm) {
                    hitIdx = bodyText.indexOf(rarestTerm);
                } else if (clean) {
                    hitIdx = bodyText.indexOf(clean.slice(0, 4));
                }
            }

            if (hitIdx >= 0 && score > 0) {
                if (rarestTerm) {
                    let occurrences = [];
                    let pos = bodyText.indexOf(rarestTerm);
                    let safeGuard = 0;
                    while (pos !== -1 && occurrences.length < 3 && safeGuard < 10) {
                        occurrences.push(pos);
                        pos = bodyText.indexOf(rarestTerm, pos + Math.max(1, rarestTerm.length));
                        safeGuard++;
                    }

                    const snippets = occurrences.map(idx => {
                        const start = Math.max(0, idx - 80);
                        const end = Math.min(bodyText.length, idx + 250);
                        return (start > 0 ? '…' : '') + doc.content.slice(start, end) + (end < bodyText.length ? '…' : '');
                    });
                    matchedSnippet = snippets.join('\n\n=====\n\n');
                } else {
                    const start = Math.max(0, hitIdx - 80);
                    const end = Math.min(bodyText.length, hitIdx + 300);
                    matchedSnippet = (start > 0 ? '…' : '') + doc.content.slice(start, end) + (end < bodyText.length ? '…' : '');
                }
            } else {
                matchedSnippet = doc.content.slice(0, 300) + (doc.content.length > 300 ? '…' : '');
            }
        }

        scored.push({ ...doc, score, matchedSnippet });
    }

    const matched = scored
        .filter(d => d.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    console.log(`执行耗时: ${(performance.now() - startT).toFixed(2)}ms`);

    if (matched.length > 0) return matched;
    return scored
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, topK)
        .map(d => ({ ...d, isGeneralRef: true }));
}

console.log('Query: "什么是六顶帽子法？"');
searchKnowledge("什么是六顶帽子法？", 3, data.docs).then(res => {
    res.forEach(r => {
        console.log(`Doc: ${r.name}, Score: ${r.score}`);
        console.log(`Snippet 截取长度: ${r.matchedSnippet.length}`);
    });
});
