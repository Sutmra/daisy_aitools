import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { storage, searchKnowledge, getAvatarColor } from '../../utils/storage';
import './Chatbot.css';

const QUICK_QUESTIONS = ['如何申请新装？', '如何抄表？', 'CIS常见故障处理', '电费账单异常怎么办？'];

const NO_RESULT_MESSAGES = [
    'Daisy 翻遍了书架，暂时没找到相关指引。',
    '抱歉，这部分知识 Daisy 还没学会，我会继续努力的。',
    '当前的知识库中似乎没有关于此问题的记载。',
    '知识库里还没有这方面的文档，需要管理员来补充。',
    '我在知识库里找了一圈，还是没有找到答案……',
];
const randomNoResultMsg = () => NO_RESULT_MESSAGES[Math.floor(Math.random() * NO_RESULT_MESSAGES.length)];

// 知识库提取片段的高亮渲染器
const highlightText = (text, query) => {
    if (!query || !text) return text;
    // 去除标点和特殊符号，提纯查询意图
    const cleanQuery = query.replace(/[\s\p{P}，。？！、；：""''（）【】《》…—·\n\r\t]+/gu, ' ').trim();
    const salientTerms = cleanQuery.match(/[a-zA-Z0-9]{2,}/g) || [];
    const ngrams2 = [];
    const s = cleanQuery.replace(/\s+/g, '');
    for (let i = 0; i <= s.length - 2; i++) {
        ngrams2.push(s.slice(i, i + 2));
    }
    // 合并英文特征字和分词 ngram，并去重
    const keywords = Array.from(new Set([...salientTerms, ...ngrams2])).filter(k => k.length >= 2);

    if (keywords.length === 0) return text;

    // 根据长度倒序优先正则，防止短片段劫持长单词
    keywords.sort((a, b) => b.length - a.length);
    const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

    const parts = text.split(regex);
    return parts.map((part, i) => {
        if (keywords.some(k => k.toLowerCase() === part.toLowerCase())) {
            return <mark key={i} className="rag-highlight">{part}</mark>;
        }
        return part;
    });
};

// 空结果卡片组件
function NoResultCard({ onFeedback, feedbackSent }) {
    return (
        <div className="no-result-card">
            {/* 插画 */}
            <div className="no-result-illus">
                <svg width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* 书架底部 */}
                    <rect x="10" y="68" width="70" height="6" rx="3" fill="#E5E7EB" />
                    {/* 书1 */}
                    <rect x="16" y="40" width="12" height="28" rx="2" fill="#D1D5DB" />
                    <rect x="17" y="42" width="2" height="24" rx="1" fill="#9CA3AF" />
                    {/* 书2 */}
                    <rect x="30" y="34" width="14" height="34" rx="2" fill="#E5E7EB" />
                    <rect x="31" y="36" width="2" height="30" rx="1" fill="#D1D5DB" />
                    {/* 书3（缺口/问号书） */}
                    <rect x="46" y="38" width="13" height="30" rx="2" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1" />
                    <text x="52" y="56" textAnchor="middle" fontSize="11" fill="#9CA3AF" fontWeight="700">?</text>
                    {/* 书4 */}
                    <rect x="61" y="44" width="10" height="24" rx="2" fill="#E5E7EB" />
                    {/* 放大镜 */}
                    <circle cx="68" cy="28" r="10" stroke="#D1D5DB" strokeWidth="2.5" fill="white" />
                    <line x1="75" y1="35" x2="82" y2="42" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" />
                    <text x="68" y="32" textAnchor="middle" fontSize="10" fill="#D1D5DB" fontWeight="700">?</text>
                </svg>
            </div>
            {/* 随机文案 */}
            <p className="no-result-msg">{randomNoResultMsg()}</p>
            <p className="no-result-sub">你可以点击下方按钮，通知管理员补充相关知识文档。</p>
            {/* 反馈按钮 */}
            <button
                className={`no-result-feedback-btn ${feedbackSent ? 'sent' : ''}`}
                onClick={onFeedback}
                disabled={feedbackSent}
            >
                {feedbackSent ? (
                    <><span className="feedback-check">✓</span> 需求已送达管理员</>
                ) : (
                    <><span>📩</span> 一键反馈，通知管理员补充</>
                )}
            </button>
        </div>
    );
}

// ============================================================
// 富文本渲染器：解析 Markdown，输出结构化 React 节点
// 关键词自动高亮定义（业务腯录）
const HIGHLIGHT_KEYWORDS = [
    // 证件 & 身份
    '身份证', '户口本', '房产证', '业务执照', '继居原件', '委托书',
    // 电力设备
    '电表号', '用电账号', '变压器', '开关柜号', '线路编号',
    // 时间节点
    '10个工作日', '5个工作日', '3个工作日', '7个工作日', '15个工作日',
    '24小时', '48小时', '72小时',
    // 金额
    '预付款', '缴款', '违约金', '保证金',
    // 流程用语
    '现场勘验', '远程验表', '验收合格', '延伸申请', '提前预约',
    // 常见业务名
    '新装申请', '拆表申请', '迁移申请', '增容', '时段计费',
    '居民用电', '工商业用电', '恶技业用电',
];

// 匹配关键词 + **bold** + `code`
function renderInline(text) {
    if (!text) return null;

    // 构建匹配 regex：关键词 | **bold** | `code`
    const kwPattern = HIGHLIGHT_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(\\*\\*[^*]+\\*\\*|\`[^\`]+\`|${kwPattern})`, 'g');
    const parts = text.split(regex).filter(p => p !== undefined);

    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="rc-bold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="rc-code">{part.slice(1, -1)}</code>;
        }
        if (HIGHLIGHT_KEYWORDS.includes(part)) {
            return <mark key={i} className="rc-kw">{part}</mark>;
        }
        return part;
    });
}

// ============================================================
// 忌文渲染器：解析 Markdown，输出结构化 React 节点
// ============================================================
function RichContent({ content }) {
    const lines = content.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // 空行
        if (line.trim() === '') { elements.push(<div key={i} className="rc-gap" />); i++; continue; }

        // 一级标题 #
        if (/^#\s/.test(line)) {
            elements.push(<h3 key={i} className="rc-h1">{renderInline(line.slice(2))}</h3>);
            i++; continue;
        }
        // 二级标题 ##
        if (/^##\s/.test(line)) {
            elements.push(<h4 key={i} className="rc-h2">{renderInline(line.slice(3))}</h4>);
            i++; continue;
        }
        // 三级标题 ###
        if (/^###\s/.test(line)) {
            elements.push(<h5 key={i} className="rc-h3">{renderInline(line.slice(4))}</h5>);
            i++; continue;
        }

        // 有序列表（1. 2. 3.）→ 步骤卡片
        if (/^\d+\.\s/.test(line)) {
            const listItems = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
                const match = lines[i].match(/^(\d+)\.\s(.*)/);
                listItems.push(
                    <li key={i} className="rc-step-card">
                        <div className="rc-step-num">{match[1]}</div>
                        <div className="rc-step-body">{renderInline(match[2])}</div>
                    </li>
                );
                i++;
            }
            elements.push(<ol key={`ol-${i}`} className="rc-steps">{listItems}</ol>);
            continue;
        }

        // 无序列表 - 或 •
        if (/^[-•]\s/.test(line)) {
            const listItems = [];
            while (i < lines.length && /^[-•]\s/.test(lines[i])) {
                listItems.push(
                    <li key={i} className="rc-ul-item">{renderInline(lines[i].slice(2))}</li>
                );
                i++;
            }
            elements.push(<ul key={`ul-${i}`} className="rc-ul">{listItems}</ul>);
            continue;
        }

        // 分隔线
        if (/^---+$/.test(line.trim())) {
            elements.push(<hr key={i} className="rc-hr" />);
            i++; continue;
        }

        // 普通段落
        elements.push(<p key={i} className="rc-p">{renderInline(line)}</p>);
        i++;
    }

    return <div className="rc-root">{elements}</div>;
}

// ============================================================
// Toast 通知组件
// ============================================================
function Toast({ toasts }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast-${t.type}`}>
                    <span className="toast-icon">{t.type === 'success' ? '✓' : t.type === 'warning' ? '!' : 'ℹ'}</span>
                    {t.text}
                </div>
            ))}
        </div>
    );
}

// ============================================================
// 主组件
// ============================================================
export default function Chatbot({ conversation, onUpdate, apiBase }) {
    const [messages, setMessages] = useState(conversation?.messages || []);
    const [input, setInput] = useState('');
    const [loadingStatus, setLoadingStatus] = useState(null); // 'scanning' | 'thinking' | null
    const [ragDocs, setRagDocs] = useState([]);
    const [kbDocs, setKbDocs] = useState([]); // 后端同步的知识库全量文档
    const [expandedSrc, setExpandedSrc] = useState(null);
    const [feedback, setFeedback] = useState({});
    const [toasts, setToasts] = useState([]);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const user = storage.getUser();

    // ── 1. 初始化消息 & 自动滚动 ──
    useEffect(() => { setMessages(conversation?.messages || []); }, [conversation?.id]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loadingStatus]);

    // ── 2. 加载后端全量知识库 ──
    useEffect(() => {
        const loadKB = async () => {
            const list = await storage.fetchKnowledge(apiBase);
            setKbDocs(list);
        };
        loadKB();
    }, [apiBase]);

    // 自动撑高 textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [input]);

    // Toast 工具函数
    const showToast = (text, type = 'success', duration = 2500) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, text, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    };

    const sendMessage = async (text) => {
        const userText = text || input.trim();
        if (!userText || loadingStatus) return;
        setInput('');

        const userMsg = {
            role: 'user',
            content: userText,
            sender: user?.name || '用户',
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setLoadingStatus('scanning');
        const title = messages.length === 0 ? userText.slice(0, 20) : conversation.title;

        // ── 1. 获取最新全库文档 (确保用户刚上传的文档也能立即被检索到) ──
        const allDocs = await storage.fetchKnowledge(apiBase);
        setKbDocs(allDocs);

        // ── 2. 知识库完全为空 → 直接显示空结果卡，不调 API ──
        if (allDocs.length === 0) {
            setLoadingStatus(null);
            const emptyMsg = {
                role: 'assistant', content: '',
                time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                isNoResult: true, ragSources: [],
            };
            const fin = [...newMessages, emptyMsg];
            setMessages(fin); onUpdate(fin, title);
            return;
        }

        // ── 3. 本地 n-gram 快速命中 ──
        const hits = await searchKnowledge(userText, 5, allDocs);
        const exactHits = hits.filter(d => !d.isGeneralRef);
        setRagDocs(exactHits.length > 0 ? exactHits : allDocs.slice(0, 3));

        // ── 4. 构建 ragContext ──
        //    只在精确命中时传参给 LLM，严格不发送无关全量文档。
        let ragContext = '';
        let ragSources = [];

        // 依据文件名对命中结果去重防重叠
        const uniqueHits = Array.from(new Map(exactHits.map(item => [item.name, item])).values());

        if (uniqueHits.length > 0) {
            // 精确命中路径：使用精心提炼出的 matchedSnippet 喂给 LLM
            ragContext = uniqueHits
                .map(d => `【来源文档：${d.name}】\n${d.matchedSnippet || (d.content || '').slice(0, 3000)}`)
                .join('\n\n---\n\n');
            ragSources = uniqueHits.map(d => ({
                name: d.name,
                snippet: d.matchedSnippet || (d.content || '').slice(0, 300) + '…',
                type: d.type,
                isGeneralRef: false,
            }));
        } else {
            // 未命中任何具体知识 → 不产生假数据源，让大模型走无知判定路径
            ragContext = '';
            ragSources = [];
        }

        // ── 5. 调用 LLM ──
        try {
            setLoadingStatus(uniqueHits.length > 0 ? 'thinking_hit' : 'thinking_miss');
            const res = await axios.post(`${apiBase}/api/chat`, {
                messages: newMessages.map(m => ({ role: m.role, content: m.content })),
                ragContext,
            });

            const reply = res.data.content || '';

            // ── 6. LLM 明确说"不知道"→ 显示空结果卡 ──
            // ── 6. LLM 明确说"不知道"→ 尽最大可能展示其推理 ──
            const noAnswerKeywords = ['完全没有相关', '暂无该问题'];
            const looksLikeNoAnswer = noAnswerKeywords.some(kw => reply.includes(kw)) && reply.length < 50;

            if (looksLikeNoAnswer) {
                const emptyMsg = {
                    role: 'assistant', content: '',
                    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                    isNoResult: true, ragSources: [],
                };
                const fin = [...newMessages, emptyMsg];
                setMessages(fin); onUpdate(fin, title);
            } else {
                const aiMsg = {
                    role: 'assistant',
                    content: reply,
                    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                    ragSources,
                };
                const fin = [...newMessages, aiMsg];
                setMessages(fin); onUpdate(fin, title);
            }
        } catch (err) {
            const errorMsg = {
                role: 'assistant',
                content: `⚠️ 请求失败：${err.response?.data?.error || err.message}\n请检查后端服务是否正常运行或网络连通性。`,
                time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                isError: true
            };
            setMessages([...newMessages, errorMsg]);
            onUpdate([...newMessages, errorMsg], title);
        } finally {
            setLoadingStatus(null);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    // ============================================================
    // 交互反馈处理
    // ============================================================
    const handleLike = (msgIdx) => {
        if (feedback[msgIdx] === 'like') return;
        setFeedback(prev => ({ ...prev, [msgIdx]: 'like' }));
        showToast('感谢反馈，很高兴对你有帮助 🎉', 'success');
    };

    const handleDislike = (msgIdx) => {
        if (feedback[msgIdx] === 'dislike') return;
        setFeedback(prev => ({ ...prev, [msgIdx]: 'dislike' }));
        showToast('收到，我们会持续改进回答质量 🙏', 'warning', 3000);
    };

    const handleCopy = (text, msgIdx) => {
        navigator.clipboard.writeText(text).then(() => {
            showToast('内容已复制到剪贴板 ✓', 'success');
        }).catch(() => {
            // fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('内容已复制到剪贴板 ✓', 'success');
        });
    };

    const userInitial = (user?.name || 'U')[0].toUpperCase();

    return (
        <div className="chatbot-layout">
            <Toast toasts={toasts} />

            {/* 顶部标题栏 */}
            <div className="chatbot-topbar">
                <div className="chatbot-topbar-left">
                    <span className="chatbot-topic">{conversation?.title || '智能问答'}</span>
                    {ragDocs.length > 0 && (
                        <span className="chatbot-kb-badge">
                            <span className="dot-green" />知识库已连接
                        </span>
                    )}
                </div>
            </div>

            {/* 消息区 */}
            <div className="chatbot-messages-wrap">
                {messages.length === 0 ? (
                    <div className="chatbot-welcome">
                        <div className="welcome-icon">
                            <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
                                <rect x="2" y="8" width="24" height="4" rx="2" fill="white" opacity="0.9" />
                                <rect x="4" y="14" width="20" height="4" rx="2" fill="white" opacity="0.7" />
                                <rect x="6" y="20" width="16" height="4" rx="2" fill="white" opacity="0.5" />
                            </svg>
                        </div>
                        <h2>Daisy's AI 客服助手</h2>
                        <p>我能帮你解答电力业务相关问题，包括新装流程、电表故障、账单异常等</p>
                        <div className="welcome-chips">
                            {QUICK_QUESTIONS.map((q, i) => (
                                <button key={i} className="welcome-chip" onClick={() => sendMessage(q)}>{q}</button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="chatbot-messages">
                        {messages.map((msg, i) => (
                            <div key={i} className={`msg-row ${msg.role}`}>

                                {/* AI 回复 */}
                                {msg.role === 'assistant' && (
                                    <>
                                        <div className="ai-msg-header">
                                            <div className="ai-avatar-sm">
                                                <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
                                                    <rect x="2" y="8" width="24" height="4" rx="2" fill="white" opacity="0.9" />
                                                    <rect x="4" y="14" width="20" height="4" rx="2" fill="white" opacity="0.7" />
                                                </svg>
                                            </div>
                                            <span className="ai-name">Daisy's AI 助手</span>
                                            <span className="msg-time-small">{msg.time}</span>
                                        </div>

                                        {/* 空结果卡片 */}
                                        {msg.isNoResult ? (
                                            <NoResultCard
                                                feedbackSent={!!feedback[`nores-${i}`]}
                                                onFeedback={() => {
                                                    setFeedback(prev => ({ ...prev, [`nores-${i}`]: true }));
                                                    showToast('已通知管理员补充相关知识 📚', 'success', 3000);
                                                }}
                                            />
                                        ) : (
                                            <div className={`ai-card ${msg.isError ? 'ai-card-error' : ''}`}>
                                                {/* 正文内容：富文本渲染 */}
                                                <div className="ai-content">
                                                    {msg.isError
                                                        ? <p style={{ color: '#991B1B' }}>{msg.content}</p>
                                                        : <RichContent content={msg.content} />
                                                    }
                                                </div>

                                                {/* 来源卡片区 */}
                                                {msg.ragSources && msg.ragSources.length > 0 && (
                                                    <div className="source-section">
                                                        <div className="source-section-label">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                                                            </svg>
                                                            核心参考源
                                                        </div>
                                                        <div className="source-list">
                                                            {msg.ragSources.map((src, si) => {
                                                                const key = `${i}-${si}`;
                                                                const isOpen = expandedSrc === key;
                                                                const prevUserMsg = messages[i - 1]?.role === 'user' ? messages[i - 1].content : '';
                                                                return (
                                                                    <div key={si} className="source-item">
                                                                        <div
                                                                            className={`source-card ${isOpen ? 'expanded' : ''}`}
                                                                            onClick={() => setExpandedSrc(isOpen ? null : key)}
                                                                        >
                                                                            <div className="source-card-left">
                                                                                <div className="source-file-icon">
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                                                        <polyline points="14 2 14 8 20 8" />
                                                                                    </svg>
                                                                                </div>
                                                                                <div className="source-card-info">
                                                                                    <span className="source-card-label" title={src.name}>{src.name}</span>
                                                                                    <span className="source-card-meta">
                                                                                        {src.isGeneralRef
                                                                                            ? <span className="src-badge src-badge-ref">通用参考</span>
                                                                                            : <span className="src-badge src-badge-hit">精准命中</span>
                                                                                        }
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="source-expand-icon">
                                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                                    <polyline points="6 9 12 15 18 9" />
                                                                                </svg>
                                                                            </div>
                                                                        </div>
                                                                        {isOpen && src.snippet && (
                                                                            <div className="source-snippet">
                                                                                {highlightText(src.snippet, prevUserMsg)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 操作按钮（有感知交互） */}
                                                {!msg.isError && (
                                                    <div className="ai-actions">
                                                        <button
                                                            className={`action-btn ${feedback[i] === 'like' ? 'action-liked' : ''}`}
                                                            onClick={() => handleLike(i)}
                                                            disabled={feedback[i] === 'dislike'}
                                                            title="这个回答有帮助"
                                                        >
                                                            {feedback[i] === 'like' ? (
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                                                                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                                                </svg>
                                                            ) : (
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                                                                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                                                </svg>
                                                            )}
                                                            {feedback[i] === 'like' ? '已标记有用' : '有用'}
                                                        </button>

                                                        <button
                                                            className={`action-btn ${feedback[i] === 'dislike' ? 'action-disliked' : ''}`}
                                                            onClick={() => handleDislike(i)}
                                                            disabled={feedback[i] === 'like'}
                                                            title="这个回答不够准确"
                                                        >
                                                            {feedback[i] === 'dislike' ? (
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                                                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
                                                                    <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                                                                </svg>
                                                            ) : (
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
                                                                    <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                                                                </svg>
                                                            )}
                                                            {feedback[i] === 'dislike' ? '已反馈' : '无用'}
                                                        </button>

                                                        <button
                                                            className="action-btn"
                                                            onClick={() => handleCopy(msg.content, i)}
                                                            title="复制全文"
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                            </svg>
                                                            复制
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* 用户消息 */}
                                {msg.role === 'user' && (
                                    <div className="user-msg-row">
                                        <div className="user-bubble">{msg.content}</div>
                                        <div
                                            className="user-avatar-chat"
                                            title={msg.sender || user?.name || '用户'}
                                            style={{ background: getAvatarColor(msg.sender || user?.name || '用户') }}
                                        >
                                            {(msg.sender || user?.name || 'U')[0].toUpperCase()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Loading / Stage UX */}
                        {loadingStatus && (
                            <div className="msg-row assistant">
                                <div className="ai-msg-header">
                                    <div className="ai-avatar-sm">
                                        <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
                                            <rect x="2" y="8" width="24" height="4" rx="2" fill="white" opacity="0.9" />
                                        </svg>
                                    </div>
                                    <span className="ai-name">Daisy's AI 助手</span>
                                </div>
                                <div className="ai-card loading-card" style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                    <div className="loading-status-text" style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {loadingStatus === 'scanning' ? (
                                            <>
                                                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#3b82f6', borderTopColor: 'transparent' }} />
                                                正在深度扫描知识库文档...
                                            </>
                                        ) : loadingStatus === 'thinking_hit' ? (
                                            <>
                                                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#10b981', borderTopColor: 'transparent' }} />
                                                精准命中知识库，大模型正在组织回复...
                                            </>
                                        ) : (
                                            <>
                                                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#f59e0b', borderTopColor: 'transparent' }} />
                                                未命中具体知识，大模型正在通识思考...
                                            </>
                                        )}
                                    </div>
                                    <div className="typing-dots">
                                        <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* 快捷问题 */}
            {messages.length > 0 && (
                <div className="quick-bar">
                    {QUICK_QUESTIONS.map((q, i) => (
                        <button key={i} className="quick-chip" onClick={() => sendMessage(q)}>{q}</button>
                    ))}
                </div>
            )}

            {/* 输入框 */}
            <div className="chatbot-input-area">
                <div className="input-box">
                    <textarea
                        ref={textareaRef}
                        id="chat-input"
                        className="chat-textarea"
                        placeholder="输入您的问题，Daisy 为您提供专业解答…"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    <button
                        id="chat-send-btn"
                        className={`send-btn ${(!input.trim() || loadingStatus) ? 'disabled' : ''}`}
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || !!loadingStatus}
                    >
                        {loadingStatus
                            ? <span className="spinner" />
                            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        }
                    </button>
                </div>
                <p className="input-disclaimer">Daisy AI 可能会产生误差，请核实重要信息。</p>
            </div>
        </div>
    );
}
