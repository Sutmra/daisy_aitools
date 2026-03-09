const fs = require('fs');
const path = require('path');

const kbPath = path.join(__dirname, 'backend', 'data', 'kb.json');
const defaultKbPath = path.join(__dirname, 'backend', 'data', 'default_kb.json');

try {
    const kbData = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    const defaultKbData = JSON.parse(fs.readFileSync(defaultKbPath, 'utf8'));

    // Both kb.json and default_kb.json have the format { "docs": [...] }
    const kbDocs = kbData.docs || [];
    const defaultDocs = defaultKbData.docs || [];

    const newDocs = [];
    const defaultDocIds = new Set(defaultDocs.map(d => d.name)); // use name to deduplicate instead of ID in case ID changes

    for (const doc of kbDocs) {
        if (!defaultDocIds.has(doc.name)) {
            // Assign to 'company-policy' collection by default so it shows up in the first tab
            doc.collection = 'company-policy';
            newDocs.push(doc);
        }
    }

    if (newDocs.length > 0) {
        console.log(`Found ${newDocs.length} new documents to add to default_kb.json:`);
        newDocs.forEach(d => console.log(`- ${d.name}`));

        const mergedDocs = [...defaultDocs, ...newDocs];
        const mergedData = { docs: mergedDocs };
        fs.writeFileSync(defaultKbPath, JSON.stringify(mergedData, null, 2), 'utf8');
        console.log('Successfully updated default_kb.json');
    } else {
        console.log('No new documents found in kb.json to add.');
    }
} catch (e) {
    console.error('Error:', e);
}
