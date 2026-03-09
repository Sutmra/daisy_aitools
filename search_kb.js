const fs = require('fs');
const path = require('path');

const kbPath = path.join(__dirname, 'backend', 'data', 'kb.json');
try {
    const data = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    const npdpDoc = data.docs.find(d => d.name.includes('NPDP'));

    if (!npdpDoc) {
        console.log('NPDP document not found');
        process.exit(1);
    }

    const content = npdpDoc.content;
    console.log(`NPDP Extracted Characters: ${content.length}`);

    const keywords = ['六顶', '帽子', 'Bono', 'Six', '帽'];
    for (const keyword of keywords) {
        const index = content.indexOf(keyword);
        if (index !== -1) {
            console.log(`Found "${keyword}" at index ${index}`);
            // Print context
            const start = Math.max(0, index - 30);
            const end = Math.min(content.length, index + 30);
            console.log(`Context: ...${content.slice(start, end).replace(/\n/g, ' ')}...`);
        } else {
            console.log(`Did not find "${keyword}"`);
        }
    }

} catch (err) {
    console.error(err);
}
