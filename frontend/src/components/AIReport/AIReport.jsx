import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement, LineElement,
    PointElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { storage, getAvatarColor } from '../../utils/storage';
import './AIReport.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const CHART_COLORS = ['#2B3BFF', '#6C63FF', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899'];

const SAMPLE_QUERIES = ['本月售电趋势', '各区域资产库存', '本月用电量分析', '工单处理状态分布'];

function buildChartData(config) {
    if (!config) return null;
    const colors = config.datasets.map((d, i) => d.color || CHART_COLORS[i % CHART_COLORS.length]);

    if (config.chartType === 'pie' || config.chartType === 'doughnut') {
        return {
            labels: config.labels,
            datasets: [{
                data: config.datasets[0]?.data || [],
                backgroundColor: CHART_COLORS.slice(0, config.labels.length).map(c => c + 'CC'),
                borderColor: CHART_COLORS.slice(0, config.labels.length),
                borderWidth: 2,
            }]
        };
    }

    return {
        labels: config.labels,
        datasets: config.datasets.map((d, i) => ({
            label: d.label,
            data: d.data,
            backgroundColor: colors[i] + '30',
            borderColor: colors[i],
            borderWidth: 2,
            borderRadius: config.chartType === 'bar' ? 6 : 0,
            fill: config.chartType === 'line',
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
        }))
    };
}

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'top', labels: { font: { size: 12 }, padding: 16 } },
        tooltip: { mode: 'index', intersect: false }
    },
    scales: {
        x: { grid: { color: '#F3F4F6' }, ticks: { font: { size: 12 } } },
        y: { grid: { color: '#F3F4F6' }, ticks: { font: { size: 12 } }, beginAtZero: true }
    }
};

const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'right', labels: { font: { size: 12 }, padding: 16 } },
        tooltip: { mode: 'index', intersect: false }
    }
};

export default function AIReport({ apiBase, conversation, onUpdate }) {
    const [messages, setMessages] = useState(conversation?.messages || []);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const user = storage.getUser();

    // ── 1. 初始化消息 & 自动滚动 ──
    useEffect(() => { setMessages(conversation?.messages || []); }, [conversation?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const sendQuery = async (text) => {
        const query = text || input.trim();
        if (!query || loading) return;
        setInput('');

        const userMsg = { role: 'user', content: query, sender: user?.name || '用户', time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setLoading(true);

        const title = messages.length === 0 ? query.slice(0, 20) : conversation.title;
        // 如果外部传了 onUpdate，通知外部更新列表
        if (onUpdate) onUpdate(newMessages, title);

        try {
            const db = storage.getDatabase();
            const res = await axios.post(`${apiBase}/api/report`, {
                query,
                databaseData: db
            });

            const aiMsg = {
                role: 'assistant',
                chart: res.data.chart,
                time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            };
            const fin = [...newMessages, aiMsg];
            setMessages(fin);
            if (onUpdate) onUpdate(fin, title);
        } catch (err) {
            const errorMsg = {
                role: 'assistant',
                content: `⚠️ 图表生成失败：${err.response?.data?.error || err.message}`,
                time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                isError: true
            };
            const finErr = [...newMessages, errorMsg];
            setMessages(finErr);
            if (onUpdate) onUpdate(finErr, title);
        } finally {
            setLoading(false);
        }
    };

    const downloadChart = (chartId) => {
        const canvas = document.getElementById(chartId);
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = 'chart.png';
        link.href = canvas.toDataURL();
        link.click();
    };

    const renderChart = (config, idx) => {
        const data = buildChartData(config);
        if (!data) return null;
        const chartId = `report-chart-${idx}`;
        const opts = (config.chartType === 'pie' || config.chartType === 'doughnut') ? pieOptions : chartOptions;

        return (
            <div className="report-chart-card" key={idx}>
                <div className="chart-card-header">
                    <div>
                        <div className="chart-title">{config.title}</div>
                        <div className="chart-date">数据更新于 {new Date().toLocaleDateString('zh-CN')}</div>
                    </div>
                    <div className="chart-actions">
                        <button className="chart-action-btn" title="下载" onClick={() => downloadChart(chartId)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                        </button>
                        <button className="chart-action-btn" title="更多">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
                            </svg>
                        </button>
                    </div>
                </div>

                {config.summary && (
                    <div className="chart-summary">
                        <span className="summary-value">{config.summary.split(' ')[0]}</span>
                        <span className="summary-trend">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                <polyline points="17 6 23 6 23 12" />
                            </svg>
                            {config.summary.split(' ').slice(1).join(' ')}
                        </span>
                    </div>
                )}

                <div className="chart-wrapper" style={{ height: 260 }}>
                    {config.chartType === 'bar' && <Bar id={chartId} data={data} options={opts} />}
                    {config.chartType === 'line' && <Line id={chartId} data={data} options={opts} />}
                    {config.chartType === 'pie' && <Pie id={chartId} data={data} options={opts} />}
                    {config.chartType === 'doughnut' && <Doughnut id={chartId} data={data} options={opts} />}
                </div>

                {config.description && (
                    <p className="chart-description">{config.description}</p>
                )}
            </div>
        );
    };

    return (
        <div className="report-layout">
            {/* 中间区域 */}
            <div className="report-center">
                {messages.length === 0 ? (
                    <div className="report-welcome">
                        <div className="report-welcome-icon">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                        </div>
                        <h2>AI 智能报表</h2>
                        <p>用自然语言描述您想要的数据分析，AI 自动生成可视化图表</p>
                        <div className="sample-queries">
                            {SAMPLE_QUERIES.map((q, i) => (
                                <button key={i} className="sample-query-btn" onClick={() => sendQuery(q)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="report-messages">
                        {messages.map((msg, i) => (
                            <div key={i} className={`report-msg ${msg.role}`}>
                                {msg.role === 'user' ? (
                                    <div className="report-user-msg-row">
                                        <div className="report-user-msg">{msg.content}</div>
                                        <div
                                            className="report-user-avatar"
                                            title={msg.sender || user?.name || '用户'}
                                            style={{ background: getAvatarColor(msg.sender || user?.name || '用户') }}
                                        >
                                            {(msg.sender || user?.name || 'U')[0].toUpperCase()}
                                        </div>
                                    </div>
                                ) : msg.chart ? (
                                    <div className="report-ai-wrap">
                                        <div className="report-ai-desc">
                                            <div className="ai-avatar-sm">
                                                <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
                                                    <rect x="2" y="8" width="24" height="4" rx="2" fill="white" opacity="0.9" />
                                                    <rect x="4" y="14" width="20" height="4" rx="2" fill="white" opacity="0.7" />
                                                </svg>
                                            </div>
                                            <p>根据您的查询，这是 <strong>{msg.chart.title}</strong>。{msg.chart.description}</p>
                                        </div>
                                        {renderChart(msg.chart, i)}
                                    </div>
                                ) : (
                                    <div className={`report-error-msg ${msg.isError ? 'error' : ''}`}>{msg.content}</div>
                                )}
                            </div>
                        ))}
                        {loading && (
                            <div className="report-loading">
                                <div className="spinner spinner-primary" />
                                <span>AI 正在分析数据并生成图表...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}

                {/* 快捷问题 */}
                {messages.length > 0 && (
                    <div className="quick-bar">
                        {SAMPLE_QUERIES.map((q, i) => (
                            <button key={i} className="quick-chip" onClick={() => sendQuery(q)}>{q}</button>
                        ))}
                    </div>
                )}

                {/* 输入框 */}
                <div className="report-input-area">
                    <div className="report-input-box">
                        <input
                            id="report-input"
                            type="text"
                            className="report-input"
                            placeholder="请输入数据查询，生成智能报表..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendQuery()}
                        />
                        <button
                            id="report-send-btn"
                            className={`report-send-btn ${(!input.trim() || loading) ? 'disabled' : ''}`}
                            onClick={() => sendQuery()}
                            disabled={!input.trim() || loading}
                        >
                            {loading ? <span className="spinner" /> : <>发送 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg></>}
                        </button>
                    </div>
                    <p className="input-disclaimer">Daisy AI 可能会产生误差，请核实重要数据。</p>
                </div>
            </div>

        </div>
    );
}
