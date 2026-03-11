// localStorage 工具函数

const KEYS = {
    USER: 'daisy_ai_user',
    KNOWLEDGE_BASE: 'daisy_ai_knowledge',
    DATABASE: 'daisy_ai_database',
    CHAT_HISTORY: 'daisy_ai_chats',
    REGISTERED_USERS: 'daisy_ai_registered_users',
    VERSION: 'daisy_ai_version',
};

const CURRENT_VERSION = '1.1.0'; // 升级版本号以强制清理历史知识库缓存

export const getAvatarColor = (name = '') => {
    // 专项优化特定名称的视觉专属体验
    if (name.toLowerCase() === 'daisy' || name.toLowerCase() === 'd') {
        return 'linear-gradient(135deg, #A855F7 0%, #D946EF 100%)'; // Elegant Purple-Pink for Daisy
    }
    if (name === '李明') {
        return 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'; // Trustworthy Blue for Li Ming
    }
    if (name.includes('管理')) {
        return 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'; // Authority Red for Admin
    }

    const colors = [
        'linear-gradient(135deg, #10B981 0%, #059669 100%)', // Emerald
        'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', // Indigo
        'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', // Amber
        'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)', // Pink
        'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)', // Teal
        'linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)', // Rose
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export const storage = {
    // 用户
    getUser: () => JSON.parse(localStorage.getItem(KEYS.USER) || 'null'),
    setUser: (user) => localStorage.setItem(KEYS.USER, JSON.stringify(user)),
    clearUser: () => localStorage.removeItem(KEYS.USER),

    getRegisteredUsers: () => JSON.parse(localStorage.getItem(KEYS.REGISTERED_USERS) || '[]'),
    addRegisteredUser: (user) => {
        const users = storage.getRegisteredUsers();
        // 如果同名覆盖，否则追加
        const existingIdx = users.findIndex(u => u.username === user.username);
        if (existingIdx >= 0) {
            users[existingIdx] = user;
        } else {
            users.push(user);
        }
        localStorage.setItem(KEYS.REGISTERED_USERS, JSON.stringify(users));
    },

    // 知识库
    // 兼容旧逻辑，但大型数据应使用 fetchKnowledge
    getKnowledge: () => {
        // 版本检查：如果版本不符，清空旧知识库缓存（解决 CIS 培训文档残留问题）
        const savedVersion = localStorage.getItem(KEYS.VERSION);
        if (savedVersion !== CURRENT_VERSION) {
            localStorage.removeItem(KEYS.KNOWLEDGE_BASE);
            localStorage.setItem(KEYS.VERSION, CURRENT_VERSION);
            return [];
        }
        return JSON.parse(localStorage.getItem(KEYS.KNOWLEDGE_BASE) || '[]');
    },
    setKnowledge: (list) => localStorage.setItem(KEYS.KNOWLEDGE_BASE, JSON.stringify(list)),

    // 后端同步方法
    fetchKnowledge: async (apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001') => {
        try {
            const resp = await fetch(`${apiBase}/api/kb`);
            const data = await resp.json();
            if (data.success) {
                // 如果量不太大，同步到本地缓存一份以加快检索
                try {
                    localStorage.setItem(KEYS.KNOWLEDGE_BASE, JSON.stringify(data.docs));
                } catch (e) {
                    console.warn('Local storage full, skipped caching docs body.');
                }
                return data.docs;
            }
            return [];
        } catch (e) {
            console.error('Fetch KB Error:', e);
            return [];
        }
    },
    syncKnowledge: async (list, apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001') => {
        try {
            // 先存本地（如果存得下）
            try {
                localStorage.setItem(KEYS.KNOWLEDGE_BASE, JSON.stringify(list));
            } catch (e) {
                console.warn('Local storage full, only syncing to backend.');
            }
            // 同步到后端
            const resp = await fetch(`${apiBase}/api/kb`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docs: list })
            });
            const data = await resp.json();
            return data.success;
        } catch (e) {
            console.error('Sync KB Error:', e);
            return false;
        }
    },

    // 数据库（{ sheets: { [sheetName]: { headers: [], rows: [[]] } } }）
    getDatabase: () => {
        const dbStr = localStorage.getItem(KEYS.DATABASE);
        let db = dbStr ? JSON.parse(dbStr) : null;
        // 如果是从旧版本升级（或遭遇受损存储），强制覆盖成全新长数据
        const todayStr = new Date().toISOString().split('T')[0];
        const lastRowDate = db?.sheets?.['售电数据']?.rows?.[db.sheets['售电数据'].rows.length - 1]?.[0];

        if (!db || !db.sheets || !db.sheets['售电数据'] || db.sheets['售电数据'].rows.length < 430 || lastRowDate !== todayStr) {
            db = defaultDatabase();
            localStorage.setItem(KEYS.DATABASE, JSON.stringify(db));
        }
        return db;
    },
    setDatabase: (db) => localStorage.setItem(KEYS.DATABASE, JSON.stringify(db)),

    // 对话历史
    getChats: () => {
        const chatsObj = localStorage.getItem(KEYS.CHAT_HISTORY);
        if (!chatsObj) return [];
        let chats = [];
        try {
            chats = JSON.parse(chatsObj);
            // Backfill migration: default legacy user messages to '李明'
            chats.forEach(conv => {
                if (conv.messages) {
                    conv.messages.forEach(msg => {
                        if (msg.role === 'user' && !msg.sender) {
                            msg.sender = '李明';
                        }
                    });
                }
            });
        } catch (e) {
            console.error('Failed to parse chat history', e);
        }
        return chats;
    },
    setChats: (chats) => localStorage.setItem(KEYS.CHAT_HISTORY, JSON.stringify(chats))
};

function defaultDatabase() {
    return {
        sheets: {
            '售电数据': {
                headers: ['日期', '售电量(MW)', '用电户数', '新增用户', '日收入(万元)'],
                rows: generateSalesData()
            },
            '区域资产': {
                headers: ['区域', '变压器数量', '电表数量', '故障数', '完好率(%)'],
                rows: [
                    ['东城区', '128', '45200', '12', '99.1'],
                    ['西城区', '105', '38600', '8', '99.4'],
                    ['南城区', '142', '52100', '15', '99.0'],
                    ['北城区', '98', '34800', '6', '99.5'],
                    ['高新区', '176', '63400', '18', '98.9'],
                ]
            },
            '工单记录': {
                headers: ['工单号', '类型', '客户姓名', '状态', '创建日期', '处理人'],
                rows: [
                    ['WO-2026-001', '新装申请', '张先生', '已完成', '2026-02-15', '李工'],
                    ['WO-2026-002', '电表故障', '王女士', '处理中', '2026-02-20', '陈工'],
                    ['WO-2026-003', '欠费停电', '刘先生', '待处理', '2026-03-01', '赵工'],
                    ['WO-2026-004', '迁移申请', '孙女士', '已完成', '2026-03-02', '李工'],
                    ['WO-2026-005', '增容申请', '周先生', '审核中', '2026-03-03', '陈工'],
                ]
            }
        }
    };
}

function generateSalesData() {
    const rows = [];
    const startDate = new Date('2025-01-01');
    const endDate = new Date();

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const monthIndex = d.getMonth();
        let baseSales = 15;
        if (monthIndex === 6 || monthIndex === 7 || monthIndex === 11 || monthIndex === 0) {
            baseSales = 20;
        }
        const dailySales = (baseSales + (Math.random() * 8) - 4).toFixed(1);
        const totalUsers = 13000 + (monthIndex * 150) + d.getDate() * 5;
        const newUsers = Math.floor(Math.random() * 10) + 1;
        const dailyIncome = (parseFloat(dailySales) * 1000 * 0.52 / 10000).toFixed(2);

        rows.push([dateStr, dailySales, totalUsers.toString(), newUsers.toString(), dailyIncome]);
    }
    return rows;
}

/**
 * 知识库全文检索 v2（多策略融合，支持中英文）
 *
 * 改进点：
 * 1. 查询预处理：去掉标点/停用词，避免"法。"这类脏 n-gram
 * 2. 文件名高权重匹配：查询词出现在文件名中额外加分
 * 3. 干净查询做 2-gram（不含标点）
 * 4. 1-gram（单字）兜底评分
 * 5. 子串包含检测（queryWord 包含在 docText 或 docText 包含 queryWord）
 * 6. 动态 snippet 定位到实际命中位置
 */
export async function searchKnowledge(query, topK = 3, existingDocs = null) {
    if (!query || query.trim().length === 0) return [];
    const docs = existingDocs || storage.getKnowledge();
    if (!docs.length || !query.trim()) return [];

    // ---- Step 1: 预处理 query ----
    const raw = query.toLowerCase().trim();

    // 去掉中英文标点，只保留汉字、字母、数字
    const clean = raw.replace(/[\s\p{P}，。？！、；：""''（）【】《》…—·\n\r\t]+/gu, ' ').trim();

    // ---- 史诗级进化：ECMAScript Native NLP 中文分词 ----
    // 放弃愚蠢的按标点片段，防止造出长句 Token，彻底废除 2-gram 制造的“随机假词跨域”骗高分机制
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
    const segments = [...segmenter.segment(clean)];
    const tokens = segments.filter(s => s.isWordLike).map(s => s.segment);

    // 极速带限制的词频统计（避免扫描几十万字的高频词）
    const countFreqLim = (str, term, limit = 50) => {
        if (!term) return 0;
        let cnt = 0;
        let pos = str.indexOf(term);
        while (pos !== -1 && cnt < limit) {
            cnt++;
            pos = str.indexOf(term, pos + term.length);
        }
        return cnt === limit ? Infinity : cnt;
    };

    // 提取搜索词中的绝对特征词（连续英文字母或数字，如 cis, 2025），利用其不可替代性作强制硬匹配拦截
    const salientTerms = clean.match(/[a-z0-9]{2,}/g) || [];

    // ---- 【核心防御阵线 -0.5】：条件性停用词与动态权重 (Dynamic Stopwords & Weighting) ----
    const GENERIC_WORDS = new Set([
        '管理', '系统', '平台', '功能', '模块', '操作', '手册', '指南', '规范', '流程', '说明', '步骤',
        '什么', '怎么', '如何', '哪些', '关于', '介绍', '常见', '故障', '处理', '办法', '使用', '进行',
        '配置', '遇到', '解决', '原因', '方案', '业务', '人员', '工具', '情况', '时候', '出现', '知道', '需要', '有些', '我想', '有', '在',
        '办', '吗', '的', '是', '了', '啊', '呢', '请问', '告诉', '我'
    ]);

    const hasCoreToken = tokens.some(tok => !GENERIC_WORDS.has(tok));
    const activeTokens = hasCoreToken ? tokens.filter(tok => !GENERIC_WORDS.has(tok)) : tokens;

    // ---- 伟大的发明：停用词边界复合重组 (Stopword-bounded Compound Recombination) ----
    // `Intl.Segmenter` 作为通用字典，不认识行业词“抄表”而将其劈成“抄”和“表”。
    // 利用停用词把长句断开后，剩下的孤立字如果紧挨着，立刻黏合成“专有名词新词”！
    const activePhrases = [];
    let currentBlock = '';

    for (let s of segments) {
        if (s.isWordLike && !GENERIC_WORDS.has(s.segment)) {
            currentBlock += s.segment;
        } else {
            if (currentBlock.length > 0) {
                activePhrases.push(currentBlock);
                currentBlock = '';
            }
        }
    }
    if (currentBlock.length > 0) activePhrases.push(currentBlock);

    // 如果所有的词全是通用词（例如用户就搜“管理”），那么解开防线，把原词拿来用
    if (activePhrases.length === 0) {
        tokens.forEach(tok => activePhrases.push(tok));
    }

    // ---- 【核心防御阵线 0】：全局逆文档频率 (Global IDF) 预计算 ----
    const dfMap = {};
    const totalDocs = Math.max(1, docs.length);
    const allTerms = [...new Set([...activePhrases, ...activeTokens])];
    allTerms.forEach(ng => {
        let count = 0;
        for (let i = 0; i < totalDocs; i++) {
            if (docs[i] && (docs[i].content || '').toLowerCase().includes(ng)) {
                count++;
            }
        }
        // 如果是单字词（除英文字母数字外），强行压低它的最高 IDF 价值，防止单字毁掉“一票否决门槛”
        let idf = count > 0 ? Math.max(0.1, Math.log10(totalDocs / count) + 0.1) : 0;
        if (ng.length === 1 && !/[a-z0-9]/.test(ng)) {
            idf = Math.min(idf, 0.4);
        }
        dfMap[ng] = idf;
    });

    // 获取当前用户查询中“最罕见词（金点子）”的含金量上限（仅针对在库内存在过的词）
    const maxQueryIdf = Math.max(
        activePhrases.length > 0 ? Math.max(...activePhrases.map(t => dfMap[t] || 0)) : 0,
        activeTokens.length > 0 ? Math.max(...activeTokens.map(t => dfMap[t] || 0)) : 0
    );

    // ---- Step 2: 逐文档异步评分（切分开销释放主线程供 UI 渲染动画） ----
    const scored = [];
    for (let i = 0; i < docs.length; i++) {
        // 每处理 1 个文档让出一次主线程（防止几十万字阻塞前端动画）
        await new Promise(resolve => setTimeout(resolve, 0));

        const doc = docs[i];
        const nameText = (doc.name || '').toLowerCase();
        const bodyText = (doc.content || '').toLowerCase();
        const docText = nameText + ' ' + bodyText;

        if (!docText.trim()) {
            scored.push({ ...doc, score: 0, matchedSnippet: '' });
            continue;
        }

        // ---- 【核心防御阵线 1】：绝对特征词一票否决 ----
        // 比如问“cis功能”，如果书里连单独的“cis”单词都没有，直接判死刑，防止庞大的书本靠“功能”两字凑高分
        let missingSalient = false;
        if (salientTerms.length > 0) {
            salientTerms.forEach(term => {
                // 使用 \b 确保匹配单词边界，防止 `Francis` 错误通过 `cis` 测试
                const salientRegex = new RegExp('\\b' + escapeRegex(term) + '\\b', 'i');
                if (!salientRegex.test(docText)) {
                    missingSalient = true;
                }
            });
        }
        if (missingSalient) {
            scored.push({ ...doc, score: 0, matchedSnippet: '' });
            continue;
        }

        let score = 0;

        // 【策略 A】完整原始 query 直接命中（最高权重，体现整体语义优先）
        if (docText.includes(raw)) score += 50;

        // 【策略 B】clean query 完整命中
        if (clean && docText.includes(clean)) score += 30;

        // 【策略 C】文件名命中（单独高权重）
        activePhrases.forEach(tok => {
            if (nameText.includes(tok)) score += 15; // 行业词出现在标题是致命高分
        });
        activeTokens.forEach(tok => {
            if (nameText.includes(tok)) score += 8;
        });

        // ---- 【核心进化：滑动块最大密度打分 (BM25 Passage Level Score)】 ----
        // 彻底抛弃整书粗暴累加的方式（几十万字的弱相关书籍会靠全书零碎水词堆砌得分战胜一万字的高密度强相关手册）
        // 此时，一本文献的最终核心分 = 它全书中【蕴含意图最稠密的那 600 个字符片段】的得分
        let bestChunkScore = 0;
        let bestChunkHitIdf = 0;

        if (bodyText.length > 0 && activePhrases.length > 0) {
            const chunkSize = 600;
            const overlap = 200;

            for (let c = 0; c < bodyText.length; c += (chunkSize - overlap)) {
                const chunkText = bodyText.slice(c, c + chunkSize);
                let chunkScore = 0;
                let hitPhrases = []; // 记录在这个块中真实命中的高级词组

                // 我们同时跑 activePhrases 和 activeTokens 的得分
                activePhrases.forEach(tok => {
                    const occurrences = (chunkText.match(new RegExp(escapeRegex(tok), 'gi')) || []).length;
                    if (occurrences > 0) {
                        const idf = dfMap[tok] || 0.1;
                        chunkScore += idf * (1 + occurrences * 0.5);
                        hitPhrases.push(tok);
                    }
                });

                activeTokens.forEach(tok => {
                    // 如果 token 所属的大词语（phrase）在当前 chunk 竟然命中了！那么我们跳过该 token 以免重复加分
                    // 如果大词语（phrase）虽然存在于查询语句中，但在当前段落里并没有碰上，我们就必须把 token 放出来兜底加分！
                    const isCoveredByHitPhrase = hitPhrases.some(p => p.includes(tok));
                    if (!isCoveredByHitPhrase) {
                        const occurrences = (chunkText.match(new RegExp(escapeRegex(tok), 'gi')) || []).length;
                        if (occurrences > 0) {
                            const idf = dfMap[tok] || 0.1;
                            // 单字权重略低
                            chunkScore += idf * (tok.length === 1 ? 0.3 : 0.8) * (1 + occurrences * 0.5);
                        }
                    }
                });

                // Update bestChunkScore and bestChunkHitIdf based on the new chunkScore
                if (chunkScore > bestChunkScore) {
                    bestChunkScore = chunkScore;
                    // For bestChunkHitIdf, we need to find the max IDF among the tokens that contributed to this best chunkScore
                    let currentChunkMaxIdf = 0;
                    activePhrases.forEach(tok => {
                        if (chunkText.includes(tok)) {
                            const idfWeight = dfMap[tok] || 0.1;
                            if (idfWeight > currentChunkMaxIdf) currentChunkMaxIdf = idfWeight;
                        }
                    });
                    activeTokens.forEach(tok => {
                        if (chunkText.includes(tok)) {
                            const idfWeight = dfMap[tok] || 0.1;
                            if (idfWeight > currentChunkMaxIdf) currentChunkMaxIdf = idfWeight;
                        }
                    });
                    bestChunkHitIdf = currentChunkMaxIdf;
                }
            }
        }

        score += bestChunkScore;

        // ---- 【核心防御阵线 2.5】：罕见词丢失当即流产 ----
        // 既然用户的提问中包含了极其罕见的查询词（例如“抄表”全局词频小，IDF极高）
        // 那么这本书最牛逼的段落也必须至少提及过跟它匹配的高频词，否则就是串台的垃圾文档
        // 获取文档整书级别的最高 Token IDF 命中
        let maxHitTokenIdf = 0;
        [...activePhrases, ...activeTokens].forEach(tok => {
            if (bodyText.includes(tok) || nameText.includes(tok)) {
                const idfWeight = dfMap[tok] || 0.1;
                if (idfWeight > maxHitTokenIdf) maxHitTokenIdf = idfWeight;
            }
        });

        // 只有当查询中包含核心词条且其最高得分超过 0.20 时，才启用严格门槛拦截
        if (maxQueryIdf > 0.20 && activePhrases.length > 0 && maxHitTokenIdf < maxQueryIdf * 0.50) {
            console.log("VETOED:", nameText, "maxQueryIdf:", maxQueryIdf.toFixed(4), "maxHitTokenIdf:", maxHitTokenIdf.toFixed(4));
            score = 0;
        }

        // 【策略 E】token 子串匹配（适合英文单词、长中文词）
        activePhrases.forEach(tok => {
            if (tok.length >= 2) {
                if (bodyText.includes(tok)) {
                    const cnt = countFreqLim(bodyText, tok, 10);
                    score += (cnt === Infinity ? 10 : cnt) * 3;
                }
            }
        });

        // 【策略 F 已废弃】不再使用单字兜底匹配，防止“子”、“帽”等单个汉字将毫不相干的文件（如 WITLINK）引入知识库污染。

        // ---- 提取 snippet（定位到命中位置）----
        let matchedSnippet = '';
        if (bodyText) {
            let hitIdx = -1;
            let rarestTerm = null;

            // ---- 【核心防御阵线 2.8】：基于滑动窗口密度打分 (BM25 Chunk Scoring) 截取片段 ----
            // 抛弃过去仅靠单个"最罕见词"四处乱撞的锚点法
            // 将长文撕裂为重叠的 600 字符切片，将用户词的 IDF 在切片内重新打分，选出最稠密的“信息黑洞”
            if (score > 0 && bodyText.length > 0) {
                const chunkSize = 600;
                const overlap = 200;
                const chunks = [];
                for (let c = 0; c < bodyText.length; c += (chunkSize - overlap)) {
                    chunks.push({
                        start: c,
                        end: Math.min(bodyText.length, c + chunkSize),
                        lowerText: bodyText.slice(c, c + chunkSize),
                        score: 0
                    });
                }

                chunks.forEach(chunk => {
                    let cScore = 0;
                    activePhrases.forEach(tok => {
                        if (chunk.lowerText.includes(tok)) cScore += (Math.pow(dfMap[tok] || 0.1, 2) * 100);
                    });
                    activeTokens.forEach(tok => {
                        if (chunk.lowerText.includes(tok)) cScore += (Math.pow(dfMap[tok] || 0.1, 2) * 50);
                    });
                    chunk.score = cScore;
                });

                chunks.sort((a, b) => b.score - a.score);
                const bestChunks = chunks.slice(0, 3).sort((a, b) => a.start - b.start);

                matchedSnippet = bestChunks.map(c => {
                    const txt = doc.content.slice(c.start, c.end);
                    return (c.start > 0 ? '…' : '') + txt + (c.end < bodyText.length ? '…' : '');
                }).join('\n\n');
            } else {
                matchedSnippet = doc.content.slice(0, 500) + (doc.content.length > 500 ? '…' : '');
            }
        }

        // 【移除旧版文档长度对数衰减惩罚】
        // 因为采用了段落密度计分，长短文章已经被拉平在同一个 600 字符竞技场，天然杜绝了长文注水
        const finalScore = score;

        scored.push({ ...doc, score: finalScore, matchedSnippet });
    }

    // ---- Step 3: 返回结果 ----
    let matched = scored
        .filter(d => d.score >= 0.5) // 最低命中阈值
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    // 只保留得分超过头号种子选手 45% 分数的文档，斩断长尾无关文档
    if (matched.length > 0) {
        const topScore = matched[0].score;
        matched = matched.filter(d => d.score >= topScore * 0.45);
        return matched;
    }

    return [];
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
