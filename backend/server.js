const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// GLM-4V API 配置
const GLM_API_KEY = process.env.GLM_API_KEY || '2dc9da35b534466db39ee3af5dca0723.d9QLaapX7vxhfogv';
const GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

app.use(cors({
  origin: '*', // 开放全部跨域
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// 文件上传配置
const uploadDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const KB_FILE = path.join(dataDir, 'kb.json');

// 助手函数：读取/保存知识库
const readKB = () => {
  try {
    const defaultKbFile = path.join(dataDir, 'default_kb.json');

    if (!fs.existsSync(KB_FILE)) {
      if (fs.existsSync(defaultKbFile)) {
        const defaultData = JSON.parse(fs.readFileSync(defaultKbFile, 'utf8'));
        fs.writeFileSync(KB_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
        return defaultData;
      }
      return { docs: [] };
    }

    const data = JSON.parse(fs.readFileSync(KB_FILE, 'utf8'));
    // If docs is empty, try to seed with default
    if (!data.docs || data.docs.length === 0) {
      if (fs.existsSync(defaultKbFile)) {
        const defaultData = JSON.parse(fs.readFileSync(defaultKbFile, 'utf8'));
        fs.writeFileSync(KB_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
        return defaultData;
      }
    }
    return data;
  } catch (e) {
    console.error('Read KB Error:', e);
    return { docs: [] };
  }
};
// 调试日志函数
const debugLog = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(path.join(__dirname, 'server_debug.log'), line);
  console.log(line.trim());
};

const saveKB = (data) => {
  try {
    fs.writeFileSync(KB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Save KB Error:', e);
    return false;
  }
};

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, Date.now() + '_' + safeName);
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 放宽至 500MB

// ========== 知识库管理接口 (后端持久化) ==========
app.get('/api/kb', (req, res) => {
  const data = readKB();
  res.json({ success: true, docs: data.docs || [] });
});

app.post('/api/kb', (req, res) => {
  const { docs } = req.body;
  if (saveKB({ docs })) {
    res.json({ success: true });
  } else {
    res.status(500).json({ success: false, error: '存储失败' });
  }
});

// ========== Chatbot 对话接口 ==========
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, ragContext, systemPrompt } = req.body;

    // 严格 RAG 策略
    let systemContent;
    if (systemPrompt) {
      // 前端传来的自定义 prompt（前端已经处理好了）
      systemContent = systemPrompt;
    } else if (ragContext && ragContext.trim()) {
      // 有知识库文档：只允许基于文档内容回答
      systemContent = `你是 Daisy's AI 客服助手。

【核心规则——请严格遵守】
1. 请认真阅读下方提取到的《知识库内容》中的信息来回答用户问题。
2. 如果《知识库内容》中仅包含大纲、菜单或碎片信息（例如提及系统具有“账单管理”或“异常处理”功能），请结合这些碎片线索，并辅以电网/系统的通用业务流常识，为用户提供有价值的解答。
3. 如果确实完全毫无关联，请委婉回答：“抱歉，目前知识库中只涵盖了系统架构等大纲，暂未找到关于此问题的具体操作说明。”
--
回答格式要求：如有多个要点用编号列表，关键信息用**加粗**，假先结论再展开说明

《知识库内容》：
${ragContext}`;
    } else {
      // 无知识库文档：明确拒绝回答业务问题
      systemContent = `你是 Daisy's AI 客服助手。

【核心规则】
当前知识库为空或没有上传相关文档。对于业务相关问题，你必须回答：“知识库中暂无该问题的相关文档，无法回答。请先在《知识库管理》上传相关文档后再询问。”
不得自行编造任何业务知识。`;
    }

    const systemMsg = { role: 'system', content: systemContent };
    const allMessages = [systemMsg, ...messages];

    const response = await axios.post(
      `${GLM_BASE_URL}/chat/completions`,
      {
        model: 'glm-4',
        messages: allMessages,
        temperature: 0.1,   // 降低到 0.1，减少模型自由发挥
        max_tokens: 2000,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${GLM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const reply = response.data.choices[0].message.content;
    res.json({ success: true, content: reply, usage: response.data.usage });
  } catch (error) {
    console.error('Chat API error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message
    });
  }
});

// ========== AI Report 图表生成接口 ==========
app.post('/api/report', async (req, res) => {
  try {
    const { query, databaseData } = req.body;

    const dataStr = databaseData ? JSON.stringify(databaseData, null, 2) : '暂无数据';

    const prompt = `你是一个数据分析助手。用户提出了以下数据查询需求：
"${query}"

当前真实世界时间是：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}。如果你看到“本月”、“今年”、“今天”等相对时间词，请严格以这个时间作为基准进行推算和截取。

当前数据库中的数据如下：
${dataStr}

请根据用户需求和数据，返回一个 JSON 格式的图表配置。如果数据库中没有相关数据，请根据查询意图生成合理的示例数据。
**重要指令：**
1. 如果用户询问的是“本月趋势”、“趋势”、“走势”，X 轴 (labels) 必须精细到**每一天**（例如：1号、2号...30号，或 03-01、03-02...03-30），并且生成对应 30 天的连贯、波动的逼真长数据点数字。绝**不能**只给几个粗略的“上旬/中旬/下旬”或“第一周/第二周”。
2. 数据应该符合业务逻辑常理（比如周六日的波动，或者是符合常规正态分布）。

返回格式必须严格如下（不要有其他文字，只返回 JSON）：
{
  "chartType": "line" | "bar" | "pie" | "doughnut",
  "title": "图表标题",
  "description": "简短描述（1-2句）",
  "summary": "关键数字摘要（如总计、增长率等）",
  "labels": ["标签1", "标签2", ...],
  "datasets": [
    {
      "label": "数据集名称",
      "data": [数字数组],
      "color": "#hex颜色"
    }
  ]
}`;

    const response = await axios.post(
      `${GLM_BASE_URL}/chat/completions`,
      {
        model: 'glm-4',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
      },
      {
        headers: {
          'Authorization': `Bearer ${GLM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const rawContent = response.data.choices[0].message.content;

    // 提取 JSON
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('模型未返回有效的 JSON 格式');

    const chartConfig = JSON.parse(jsonMatch[0]);
    res.json({ success: true, chart: chartConfig });
  } catch (error) {
    console.error('Report API error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message
    });
  }
});

// ========== 异步 Job 任务管理器 (V3 PRO) ==========
const parsingJobs = {};

/**
 * 深度解析 PDF (全量 OCR)
 * 取消页数限制，加入进度追踪
 */
const processDocumentJob = async (jobId, filePath, originalName, ext) => {
  const job = parsingJobs[jobId];
  try {
    let textContent = '';
    const startTime = Date.now();
    job.status = 'processing';
    job.progress = 10;
    job.message = '正在准备解析引擎...';

    debugLog(`[Job:${jobId}] >>> START: ${originalName} (${ext}) Size: ${job.size}`);

    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);

      // 阶段 1: 基础解析
      job.message = '正在执行基础文本提取...';
      try {
        const pdfData = await pdfParse(dataBuffer);
        textContent = (pdfData.text || '').trim();
        debugLog(`[Job:${jobId}] Phase 1 (pdf-parse) done. Chars: ${textContent.length}`);
      } catch (err1) {
        debugLog(`[Job:${jobId}] Phase 1 Error: ${err1.message}`);
      }

      // 阶段 2: 深度识别 (如果基础解析结果不足)
      if (textContent.length < 50) {
        debugLog(`[Job:${jobId}] Phase 2 Triggered (Low chars: ${textContent.length})`);
        job.message = '正在尝试深度结构化提取...';

        try {
          const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
          const data = new Uint8Array(dataBuffer);
          const loadingTask = pdfjsLib.getDocument({
            data,
            useSystemFonts: true,
            disableFontFace: true
          });

          const pdf = await loadingTask.promise;
          let deepText = '';
          const totalPages = pdf.numPages;
          debugLog(`[Job:${jobId}] PDFJS loaded. Pages: ${totalPages}`);

          for (let i = 1; i <= totalPages; i++) {
            try {
              const page = await pdf.getPage(i);
              const textContentObj = await page.getTextContent();
              const pageText = textContentObj.items.map(item => item.str).join(' ');
              deepText += pageText + '\n';
              job.progress = 10 + Math.floor((i / totalPages) * 80);
              if (i % 5 === 0) debugLog(`[Job:${jobId}] Processing page ${i}/${totalPages}...`);
            } catch (pageErr) {
              debugLog(`[Job:${jobId}] Error on page ${i}: ${pageErr.message}`);
            }
          }

          if (deepText.trim().length > textContent.length) {
            textContent = deepText.trim();
            debugLog(`[Job:${jobId}] Phase 2 (pdfjs) improved chars to: ${textContent.length}`);
          }
        } catch (err2) {
          debugLog(`[Job:${jobId}] Phase 2 Core Error: ${err2.message}\nStack: ${err2.stack}`);
        }
      }
    } else if (ext === '.docx' || ext === '.doc') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      textContent = result.value;
      debugLog(`[Job:${jobId}] Word parse done. Chars: ${textContent.length}`);
    } else if (ext === '.pptx' || ext === '.ppt') {
      const officeParser = require('officeparser');
      const ast = await officeParser.parseOffice(filePath);
      textContent = ast.toText();
      debugLog(`[Job:${jobId}] PPT parse done. Chars: ${textContent.length}`);
    } else if (ext === '.txt' || ext === '.md') {
      textContent = fs.readFileSync(filePath, 'utf8');
      debugLog(`[Job:${jobId}] Text parse done. Chars: ${textContent.length}`);
    }

    const finalContent = textContent.trim();
    if (!finalContent && job.size > 0) {
      debugLog(`[Job:${jobId}] FAILED: No content extracted for size ${job.size}`);
      throw new Error('未提取到有效文本内容。文档可能是加密的、损坏的、或纯图片。');
    }

    // 最终存储结果
    job.status = 'completed';
    job.progress = 100;
    job.result = {
      content: finalContent,
      charCount: finalContent.length,
      isLowQuality: finalContent.length < 100 && job.size > 100 * 1024
    };

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    debugLog(`[Job:${jobId}] <<< SUCCESS in ${duration}s. Chars: ${finalContent.length}`);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [Job:${jobId}] !!! Failed:`, error);
    job.status = 'failed';
    job.error = error.message;
    job.message = `处理失败: ${error.message}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
};

// ========== 文件上传 & 状态轮询接口 (异步模式) ==========
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: '未收到文件' });

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();
    const jobId = 'job_' + Date.now();

    // 1. 初始化 Job 状态
    parsingJobs[jobId] = {
      id: jobId,
      filename: originalName,
      size: req.file.size,
      type: ext.replace('.', '').toUpperCase(),
      status: 'pending',
      progress: 0,
      uploadDate: new Date().toLocaleDateString('zh-CN'),
      requestTime: new Date().toISOString()
    };

    // 2. 启动异步解析进程 (不 await)
    processDocumentJob(jobId, req.file.path, originalName, ext);

    // 3. 立即返回 JobId
    console.log(`[${new Date().toISOString()}] [App] Accepted job ${jobId} for ${originalName} (${req.file.size} bytes)`);
    res.json({ success: true, jobId });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Upload Error:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = parsingJobs[req.params.id];
  if (!job) return res.status(404).json({ success: false, error: '任务不存在' });
  res.json({ success: true, job });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    activeJobs: Object.values(parsingJobs).filter(j => j.status !== 'completed' && j.status !== 'failed').length
  });
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] 🚀 Daisy's AI 异步全量索引服务已启动: http://localhost:${PORT}`);
});
