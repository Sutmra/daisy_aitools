const fs = require('fs');
const kbPath = './backend/data/kb.json';
const destPath = './backend/data/default_kb.json';

try {
  if (fs.existsSync(kbPath)) {
    const data = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    const defaultDocs = data.filter(doc => 
      doc.name.includes('操作手册') || doc.name.includes('培训文档')
    );
    
    fs.writeFileSync(destPath, JSON.stringify(defaultDocs, null, 2), 'utf8');
    console.log(`Extracted ${defaultDocs.length} documents to default_kb.json`);
  } else {
    console.log('kb.json not found');
  }
} catch (e) {
  console.error(e);
}
