const fs = require('fs');
const bodyText = fs.readFileSync('backend/data/kb.json', 'utf8').toLowerCase();
console.time('match-g');
let matchTotal = 0;
for (let i = 0; i < 50; i++) {
    const m = bodyText.match(/是/g);
    matchTotal += m ? m.length : 0;
}
console.log('RegExp:', matchTotal);
console.timeEnd('match-g');

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

console.time('indexOf');
let idxTotal = 0;
for (let i = 0; i < 50; i++) {
    idxTotal += countFreqLim(bodyText, '是', 50);
}
console.log('IndexOf:', idxTotal);
console.timeEnd('indexOf');
