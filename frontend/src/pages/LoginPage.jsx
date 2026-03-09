import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../utils/storage';
import './LoginPage.css';

// 预设账号
const ACCOUNTS = [
    { username: 'admin', password: 'admin123', role: 'admin', name: '管理员', email: 'admin@daisyai.com' },
    { username: 'user', password: 'user123', role: 'user', name: '李明', email: 'liming@daisyai.com' },
    { username: 'daisy', password: 'daisy123', role: 'user', name: 'Daisy', email: 'daisy@daisyai.com' },
];

export default function LoginPage() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('login');
    const [form, setForm] = useState({ username: '', password: '', remember: false });
    const [regForm, setRegForm] = useState({ username: '', email: '', password: '', confirm: '' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    const showToast = (e, msg = 'Daisy 正在为您打磨这个新功能，再给它一点时间。') => {
        if (e) e.preventDefault();
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.username || !form.password) {
            setError('请填写用户名和密码');
            return;
        }
        setLoading(true);
        await new Promise(r => setTimeout(r, 600));

        const registeredUsers = storage.getRegisteredUsers();
        const allAccounts = [...ACCOUNTS, ...registeredUsers];

        const account = allAccounts.find(
            a => a.username === form.username && a.password === form.password
        );
        if (!account) {
            setError('用户名或密码错误，请重试');
            setLoading(false);
            return;
        }
        storage.setUser({ username: account.username, name: account.name, role: account.role, email: account.email });
        navigate(account.role === 'admin' ? '/admin' : '/chat');
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        if (!regForm.username || !regForm.password) {
            setError('请填写所有必填项（用户名和密码）');
            return;
        }
        if (regForm.password !== regForm.confirm) {
            setError('两次密码不一致');
            return;
        }
        setLoading(true);
        await new Promise(r => setTimeout(r, 600));

        const newUser = { username: regForm.username, password: regForm.password, name: regForm.username, role: 'user', email: regForm.email };
        storage.addRegisteredUser(newUser);
        storage.setUser(newUser);
        navigate('/chat');
    };

    const handleQuickLogin = async (role) => {
        setLoading(true);
        setError('');
        await new Promise(r => setTimeout(r, 600)); // 制造一个真实的加载感

        const account = ACCOUNTS.find(a => a.role === role);
        if (account) {
            storage.setUser({ username: account.username, name: account.name, role: account.role, email: account.email });
            navigate(account.role === 'admin' ? '/admin' : '/chat');
        }
    };

    return (
        <div className="login-root">
            <div className="login-bg">
                <div className="login-bg-circle c1" />
                <div className="login-bg-circle c2" />
                <div className="login-bg-circle c3" />
            </div>

            <div className="login-card">
                {/* Logo */}
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <rect x="2" y="8" width="24" height="4" rx="2" fill="white" opacity="0.9" />
                            <rect x="4" y="14" width="20" height="4" rx="2" fill="white" opacity="0.7" />
                            <rect x="6" y="20" width="16" height="4" rx="2" fill="white" opacity="0.5" />
                        </svg>
                    </div>
                    <span className="login-logo-text">Daisy's AI</span>
                </div>
                <p className="login-subtitle">智能问答 + 智能报表</p>
                <p className="login-subtitle-small">助力企业高效运营</p>

                {/* Tabs */}
                <div className="login-tabs">
                    <button
                        className={`login-tab ${tab === 'login' ? 'active' : ''}`}
                        onClick={() => { setTab('login'); setError(''); }}
                    >登录账号</button>
                    <button
                        className={`login-tab ${tab === 'register' ? 'active' : ''}`}
                        onClick={() => { setTab('register'); setError(''); }}
                    >注册新用户</button>
                </div>

                {error && <div className="login-error">{error}</div>}

                {/* 漂浮 Toast 提示 */}
                {toast && <div className="login-toast">{toast}</div>}

                {tab === 'login' ? (
                    <form className="login-form" onSubmit={handleLogin} id="login-form">
                        <div className="form-group">
                            <label>用户名</label>
                            <div className="input-wrap">
                                <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                </svg>
                                <input
                                    id="login-username"
                                    type="text"
                                    className="input"
                                    placeholder="请输入您的用户名"
                                    value={form.username}
                                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                />
                                {form.username && (
                                    <button type="button" className="input-clear" onClick={() => setForm(f => ({ ...f, username: '' }))}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>密码</label>
                            <div className="input-wrap">
                                <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <input
                                    id="login-password"
                                    type={showPass ? 'text' : 'password'}
                                    className="input"
                                    placeholder="请输入您的密码"
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                />
                                <button type="button" className="input-clear" onClick={() => setShowPass(v => !v)}>
                                    {showPass ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="login-options">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={form.remember}
                                    onChange={e => setForm(f => ({ ...f, remember: e.target.checked }))}
                                />
                                <span>记住登录状态</span>
                            </label>
                            <a href="#" className="forgot-link" onClick={showToast}>忘记密码？</a>
                        </div>

                        <button id="login-submit" type="submit" className="btn btn-primary btn-lg login-btn" disabled={loading}>
                            {loading ? <><span className="spinner" /><span>登录中...</span></> : '登录系统'}
                        </button>

                        <div className="quick-login-container">
                            <div className="quick-login-header">
                                <span className="quick-label">⚡️ 快捷测试通道</span>
                            </div>
                            <div className="quick-login-cards">
                                <div className="quick-card" onClick={() => handleQuickLogin('user')}>
                                    <div className="quick-icon user-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                        </svg>
                                    </div>
                                    <div className="quick-text">
                                        <span className="quick-title">普通用户</span>
                                        <span className="quick-desc">测试问答与报表</span>
                                    </div>
                                </div>

                                <div className="quick-card" onClick={() => handleQuickLogin('admin')}>
                                    <div className="quick-icon admin-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                    </div>
                                    <div className="quick-text">
                                        <span className="quick-title">系统管理员</span>
                                        <span className="quick-desc">测试后台管理系统</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                ) : (
                    <form className="login-form" onSubmit={handleRegister} id="register-form">
                        <div className="form-group">
                            <label>用户名</label>
                            <div className="input-wrap">
                                <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                </svg>
                                <input type="text" className="input" placeholder="请设置用户名" value={regForm.username}
                                    onChange={e => setRegForm(f => ({ ...f, username: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>邮箱（选填）</label>
                            <div className="input-wrap">
                                <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                                </svg>
                                <input type="email" className="input" placeholder="请输入您的邮箱地址" value={regForm.email}
                                    onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>密码</label>
                            <div className="input-wrap">
                                <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <input type="password" className="input" placeholder="请设置密码（6位以上）" value={regForm.password}
                                    onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>确认密码</label>
                            <div className="input-wrap">
                                <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <input type="password" className="input" placeholder="请再次输入密码" value={regForm.confirm}
                                    onChange={e => setRegForm(f => ({ ...f, confirm: e.target.value }))} />
                            </div>
                        </div>
                        <button id="register-submit" type="submit" className="btn btn-primary btn-lg login-btn" disabled={loading}>
                            {loading ? <><span className="spinner" /><span>注册中...</span></> : '注册账号'}
                        </button>
                    </form>
                )}

                <div className="login-divider"><span>其他登录方式</span></div>
                <div className="login-oauth">
                    <button className="oauth-btn" title="Google" type="button" onClick={showToast}>
                        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                    </button>
                    <button className="oauth-btn" title="微信" type="button" onClick={showToast}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#07C160"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.295.295a.316.316 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-3.898-6.348-7.601-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.62-.12 2.377-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1 .018-.357C23.308 19.07 24 17.76 24 16.414c0-3.175-2.748-5.549-7.062-5.556zm-3.302 2.548c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982zm6.302 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" /></svg>
                    </button>
                </div>
            </div>

            <footer className="login-footer">
                <a href="#" onClick={showToast}>服务承诺</a>
                <span>｜</span>
                <a href="#" onClick={showToast}>隐私政策</a>
                <span>｜</span>
                <a href="#" onClick={showToast}>帮助中心</a>
                <p>© 2026 Daisy's AI Computing. All rights reserved.</p>
            </footer>
        </div>
    );
}
