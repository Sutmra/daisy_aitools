const { chromium } = require('playwright');
const path = require('path');

// 捕获前端动画的测试用例
(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let logs = [];
    page.on('console', msg => logs.push(`[Console] ${msg.type()}: ${msg.text()}`));

    try {
        console.log('--- 开始端到端测试 RAG 优化后的加载响应 ---');
        await page.goto('http://localhost:5173/chat', { waitUntil: 'networkidle' });

        // 设置知识库测试问题
        await page.fill('#chat-input', '请详细解释什么是六顶帽子法？');
        await page.waitForTimeout(500);

        console.log('点击发送...');
        await page.click('#chat-send-btn');

        // 测试点 1：是否能立刻弹出扫描知识库的动画卡片
        console.log('等待 loading 元素出现...');
        await page.waitForSelector('.loading-card', { state: 'attached', timeout: 5000 });
        const loadingText1 = await page.locator('.loading-status-text').textContent();
        console.log(`UI 捕获阶段一: ${loadingText1.trim()}`);
        await page.screenshot({ path: path.join(__dirname, 'test_rag_ui_scanning.png') });

        // 测试点 2：等待状态切换到思考中
        // (注：如果机器极速扫描完成，这步可能极快闪过，故不强制抛错)
        try {
            await page.waitForFunction(() => {
                const el = document.querySelector('.loading-status-text');
                return el && el.textContent.includes('模型正在思考');
            }, { timeout: 3000 });
            const loadingText2 = await page.locator('.loading-status-text').textContent();
            console.log(`UI 捕获阶段二: ${loadingText2.trim()}`);
            await page.screenshot({ path: path.join(__dirname, 'test_rag_ui_thinking.png') });
        } catch (e) {
            console.log('未能捕获阶段二 (可能是切片速度过快，或后端直接卡主)');
        }

        // 测试点 3：等待最终回复和参考引文卡片
        console.log('等待 AI 回复输出...');
        await page.waitForSelector('.ai-msg-header', { state: 'attached', timeout: 15000 });

        // 等待最后一个 assistant bubble 不包含 loading-card
        await page.waitForFunction(() => {
            const msgs = document.querySelectorAll('.msg-row.assistant');
            const last = msgs[msgs.length - 1];
            return last && !last.querySelector('.loading-card');
        }, { timeout: 20000 });

        await page.waitForTimeout(1000); // 预留一点时间让富文本组件渲染
        await page.screenshot({ path: path.join(__dirname, 'test_rag_ui_final.png') });
        console.log('测试成功！截图已保存。');

    } catch (err) {
        console.error('测试失败:', err);
        console.log('前端控制台输出:\n', logs.join('\n'));
    } finally {
        await browser.close();
    }
})();
