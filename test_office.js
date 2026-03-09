const { parseOffice } = require('officeparser');

async function test() {
    try {
        const data = await parseOffice('backend/uploads/test.pptx', { outputErrorToConsole: true });
        console.log("Type:", typeof data);
        console.log("Data:", data);
    } catch (err) {
        console.error("Error:", err);
    }
}
test();
