import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage, getAvatarColor } from '../utils/storage';
import Chatbot from '../components/Chatbot/Chatbot';
import AIReport from '../components/AIReport/AIReport';
import './ChatPage.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// 对话图标：chatbot 用气泡，report 用图表
const TAB_ICON = {
    chatbot: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    ),
    report: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
    ),
};

const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()} -${pad(d.getMonth() + 1)} -${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} `;
};

export default function ChatPage() {
    const navigate = useNavigate();
    const user = storage.getUser();

    const [activeTab, setActiveTab] = useState('chatbot');

    // 对话历史（每条都带 tab 字段区分类型）
    const [conversations, setConversations] = useState(() => {
        const saved = storage.getChats();
        const now = Date.now();
        if (saved.length) {
            // 兼容老数据，如果没有 timestamp 则赋予 id 或者当前时间
            return saved.map(c => ({ ...c, timestamp: c.timestamp || (c.id > 10000 ? c.id : now) }));
        }
        return [
            { id: 1, title: 'CIS是什么系统？', tab: 'chatbot', messages: [], timestamp: now - 86400000 * 2 },
            { id: 2, title: '新装流程咨询', tab: 'chatbot', messages: [], timestamp: now - 86400000 },
            { id: 3, title: '电费账单异常处理', tab: 'chatbot', messages: [], timestamp: now - 3600000 },
            { id: 4, title: '本月售电趋势分析', tab: 'report', messages: [], timestamp: now },
        ];
    });

    // 当前各 Tab 激活的对话 ID（独立记忆）
    const [activeConvIdByTab, setActiveConvIdByTab] = useState(() => ({
        chatbot: 1,
        report: 4,
    }));

    // 当前 Tab 对应的所有历史（按最后更新时间倒序排序）
    const filteredConvs = conversations
        .filter(c => c.tab === activeTab)
        .sort((a, b) => b.timestamp - a.timestamp);

    // 当前激活的对话
    const currentConvId = activeConvIdByTab[activeTab] || filteredConvs[0]?.id;
    const currentConv = conversations.find(c => c.id === currentConvId) || filteredConvs[0];

    // 切换 Tab：历史列表自动切换，并强制激活该分类下最新的一条对话
    const handleTabSwitch = (tab) => {
        setActiveTab(tab);
        const tabConvs = conversations
            .filter(c => c.tab === tab)
            .sort((a, b) => b.timestamp - a.timestamp);

        if (tabConvs.length === 0) {
            handleNewChat(tab);
        } else {
            // 切 Tab 时强行忘掉旧记忆，把最新的一条推到聚光灯下
            setActiveConvIdByTab(prev => ({ ...prev, [tab]: tabConvs[0].id }));
        }
    };

    // 新建对话：按当前 tab 分类（也可传入指定 tab）
    const handleNewChat = (forTab) => {
        const tab = forTab || activeTab;
        const newId = Date.now();
        const newConv = {
            id: newId,
            title: tab === 'chatbot' ? '新问答对话' : '新报表分析',
            tab,
            messages: [],
            timestamp: newId,
        };
        setConversations(prev => {
            const updated = [newConv, ...prev];
            storage.setChats(updated);
            return updated;
        });
        setActiveConvIdByTab(prev => ({ ...prev, [tab]: newId }));
        if (!forTab) setActiveTab(tab); // 如果是手动点击按钮，保持当前 tab
    };

    // 选择某条历史
    const handleSelectConv = (conv) => {
        setActiveConvIdByTab(prev => ({ ...prev, [conv.tab]: conv.id }));
    };

    // Chatbot 更新对话内容
    const updateConversation = (id, messages, title) => {
        setConversations(prev => {
            const updated = prev.map(c =>
                c.id === id ? { ...c, messages, title: title || c.title, timestamp: Date.now() } : c
            );
            storage.setChats(updated);
            return updated;
        });
    };

    // AIReport 保存报表对话
    const handleReportSave = (title) => {
        if (!currentConvId) return;
        setConversations(prev => {
            const updated = prev.map(c =>
                c.id === currentConvId ? { ...c, title, timestamp: Date.now() } : c
            );
            storage.setChats(updated);
            return updated;
        });
    };

    const handleLogout = () => {
        storage.clearUser();
        navigate('/login');
    };

    // 删除单条对话记录
    const handleDeleteConv = (e, id) => {
        e.stopPropagation(); // 防止触发选中事件
        if (!window.confirm('确定要删除这条对话历史吗？此操作无法恢复。')) return;

        setConversations(prev => {
            const updated = prev.filter(c => c.id !== id);
            storage.setChats(updated);

            // 如果删掉的是当前阅读的项，需要帮用户降级退回或者清空到新建状态
            if (id === currentConvId) {
                const remainingInTab = updated.filter(c => c.tab === activeTab);
                if (remainingInTab.length > 0) {
                    // 默认跳到同 Tab 的第一条
                    setActiveConvIdByTab(ids => ({ ...ids, [activeTab]: remainingInTab[0].id }));
                } else {
                    // 全删光了，拉起一个带新上下文环境的空屏
                    const newId = Date.now();
                    const newConv = {
                        id: newId,
                        title: activeTab === 'chatbot' ? '新问答对话' : '新报表分析',
                        tab: activeTab,
                        messages: [],
                    };
                    updated.unshift(newConv);
                    storage.setChats(updated);
                    setActiveConvIdByTab(ids => ({ ...ids, [activeTab]: newId }));
                }
            }
            return updated;
        });
    };

    return (
        <div className="chat-root">
            {/* 左侧边栏 */}
            <aside className="chat-sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">
                            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                                <rect x="2" y="8" width="24" height="4" rx="2" fill="white" opacity="0.9" />
                                <rect x="4" y="14" width="20" height="4" rx="2" fill="white" opacity="0.7" />
                                <rect x="6" y="20" width="16" height="4" rx="2" fill="white" opacity="0.5" />
                            </svg>
                        </div>
                        <span>Daisy's AI 助手</span>
                    </div>
                </div>

                <div className="sidebar-new">
                    <button id="new-chat-btn" className="btn btn-primary new-chat-btn" onClick={() => handleNewChat()}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        开启新对话
                    </button>
                </div>

                {/* 分类标签 */}
                <div className="sidebar-section-label">
                    {activeTab === 'chatbot' ? '智能问答历史' : '智能报表历史'}
                    <span className="sidebar-section-count">{filteredConvs.length}</span>
                </div>

                {/* 对话列表（仅显示当前 Tab 类型） */}
                <div className="sidebar-conv-list">
                    {filteredConvs.length === 0 ? (
                        <div className="sidebar-empty">暂无历史，点击"开启新对话"开始</div>
                    ) : (
                        filteredConvs.map(conv => (
                            <div
                                key={conv.id}
                                className={`conv-item ${conv.id === currentConvId ? 'active' : ''}`}
                                onClick={() => handleSelectConv(conv)}
                            >
                                <div className="conv-icon">
                                    {TAB_ICON[conv.tab] || TAB_ICON.chatbot}
                                </div>
                                <div className="conv-content">
                                    <span className="conv-title">{conv.title}</span>
                                    <span className="conv-time">{formatTime(conv.timestamp)}</span>
                                </div>
                                <button
                                    className="icon-btn delete-btn"
                                    onClick={(e) => handleDeleteConv(e, conv.id)}
                                    title="删除此对话"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="sidebar-user">
                    <div
                        className="user-avatar"
                        style={{ background: getAvatarColor(user?.name || '用户') }}
                    >
                        {user?.name?.[0] || 'U'}
                    </div>
                    <div className="user-info">
                        <div className="user-name">{user?.name || '用户'}</div>
                        <div className="user-role">普通用户</div>
                    </div>
                    <button className="user-settings" onClick={handleLogout} title="退出登录">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </aside>

            {/* 主体区域 */}
            <main className="chat-main">
                {/* 顶部 Tab 栏 */}
                <header className="chat-header">
                    <div className="chat-tabs">
                        <button
                            id="tab-chatbot"
                            className={`chat-tab ${activeTab === 'chatbot' ? 'active' : ''}`}
                            onClick={() => handleTabSwitch('chatbot')}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            智能问答 Chatbot
                        </button>
                        <button
                            id="tab-report"
                            className={`chat-tab ${activeTab === 'report' ? 'active' : ''}`}
                            onClick={() => handleTabSwitch('report')}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                            智能报表 AI Report
                        </button>
                    </div>
                    <div className="chat-header-actions">
                        <button className="icon-btn" title="通知">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                        </button>
                        <button className="icon-btn" title="分享">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                        </button>
                    </div>
                </header>

                {/* Tab 内容 */}
                <div className="chat-content">
                    {activeTab === 'chatbot' ? (
                        <Chatbot
                            key={currentConvId}
                            conversation={currentConv}
                            onUpdate={(messages, title) => updateConversation(currentConvId, messages, title)}
                            apiBase={API_BASE}
                        />
                    ) : (
                        <AIReport
                            key={currentConvId}
                            conversation={currentConv}
                            onUpdate={(messages, title) => updateConversation(currentConvId, messages, title)}
                            apiBase={API_BASE}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
