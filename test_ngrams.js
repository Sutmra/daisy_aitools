const fs = require('fs');
const data = JSON.parse(fs.readFileSync('backend/data/kb.json', 'utf8'));

const makeNgrams = (str, n) => {
    const s = str.replace(/\s+/g, '');
    const result = [];
    for (let i = 0; i <= s.length - n; i++) result.push(s.slice(i, i + n));
    return result;
};

const docNPDP = data.docs.find(d => d.name.includes('NPDP'));
const text = docNPDP.content.toLowerCase();

const q = 'cis抄表有哪些功能';
const ngrams2 = makeNgrams(q, 2);

console.log('Query:', q);
ngrams2.forEach(ng => {
    const hits = text.match(new RegExp(ng, 'g'));
    console.log(`2-gram "${ng}":`, hits ? hits.length : 0);
});
