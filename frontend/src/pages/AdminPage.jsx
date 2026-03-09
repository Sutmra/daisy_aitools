import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../utils/storage';
import KnowledgeBase from '../components/KnowledgeBase/KnowledgeBase';
import OnlineDatabase from '../components/OnlineDatabase/OnlineDatabase';
import './AdminPage.css';

export default function AdminPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('knowledge');
    const [toast, setToast] = useState('');
    const user = storage.getUser();

    const handleLogout = () => {
        storage.clearUser();
        navigate('/login');
    };

    const showToast = (e, msg = 'Daisy 正在施工中... 🏗️') => {
        if (e) e.preventDefault();
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    return (
        <div className="admin-root">
            {toast && <div className="admin-toast">{toast}</div>}
            {/* 左侧导航 */}
            <aside className="admin-sidebar">
                <div className="admin-sidebar-header">
                    <div className="admin-logo">
                        <div className="admin-logo-icon">
                            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                                <rect x="2" y="8" width="24" height="4" rx="2" fill="white" opacity="0.9" />
                                <rect x="4" y="14" width="20" height="4" rx="2" fill="white" opacity="0.7" />
                                <rect x="6" y="20" width="16" height="4" rx="2" fill="white" opacity="0.5" />
                            </svg>
                        </div>
                        <span style={{ fontSize: '15px' }}>Daisy's AI 后台管理系统</span>
                    </div>
                </div>

                <nav className="admin-nav">
                    <button
                        id="nav-knowledge"
                        className={`admin-nav-item ${activeTab === 'knowledge' ? 'active' : ''}`}
                        onClick={() => setActiveTab('knowledge')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                        <span>Knowledge Base</span><br /><small>知识库管理</small>
                    </button>

                    <button
                        id="nav-database"
                        className={`admin-nav-item ${activeTab === 'database' ? 'active' : ''}`}
                        onClick={() => setActiveTab('database')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <ellipse cx="12" cy="5" rx="9" ry="3" />
                            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                        </svg>
                        <span>Online Database</span><br /><small>在线数据库</small>
                    </button>

                    <button className="admin-nav-item" onClick={showToast}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2" />
                        </svg>
                        <span>Settings</span><br /><small>系统设置</small>
                    </button>
                </nav>

                <div className="admin-sidebar-user">
                    <div className="admin-user-avatar">{user?.name?.[0]?.toUpperCase() || 'A'}{user?.name?.[1]?.toUpperCase() || 'D'}</div>
                    <div className="admin-user-info">
                        <div className="admin-user-name">{user?.name || 'Admin User'}</div>
                        <div className="admin-user-email">{user?.email || 'admin@daisyai.com'}</div>
                    </div>
                    <button
                        className="admin-logout-btn"
                        onClick={handleLogout}
                        title="退出登录"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </aside>

            {/* 主体 */}
            <main className="admin-main">
                {/* 顶部栏 */}
                <header className="admin-header">
                    <h1 className="admin-title">
                        {activeTab === 'knowledge' ? 'Knowledge Base Management' : 'Online Database'}
                    </h1>
                    <div className="admin-header-right">
                        <div className="admin-search">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                className="admin-search-input"
                                placeholder={activeTab === 'knowledge' ? 'Search knowledge...' : 'Search database...'}
                            />
                        </div>
                        <button className="icon-btn" title="通知">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>退出</button>
                    </div>
                </header>

                {/* 内容区域 */}
                <div className="admin-content">
                    {activeTab === 'knowledge' ? <KnowledgeBase /> : <OnlineDatabase />}
                </div>
            </main>
        </div>
    );
}
