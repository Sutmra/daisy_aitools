const fs = require('fs');
const { searchKnowledge } = require('./frontend/src/utils/storage.js');

async function test() {
    const docs = JSON.parse(fs.readFileSync('./backend/data/kb.json', 'utf8')).docs;
    const hitDocs = await searchKnowledge('电费账单异常怎么办', 3, docs);
    let ragContext = hitDocs.length > 0 ? hitDocs.map(d => `【来源文档：${d.name}】\n${d.matchedSnippet}`).join('\n\n') : '';

    console.log("RAG CONTEXT length:", ragContext.length);

    try {
        const response = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: '电费账单异常怎么办？' }],
                ragContext: ragContext
            })
        });
        const data = await response.json();
        console.log("LLM 回复:\n", data.content);
    } catch (err) {
        console.error("API error", err.message);
    }
}
test();
