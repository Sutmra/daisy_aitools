import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { storage } from '../../utils/storage';
import './KnowledgeBase.css';

// 默认预置的分类集合
const DEFAULT_COLLECTIONS = [
    { id: 'employee-handbook', name: '员工手册', icon: '📕', desc: '新成员入职必读，助你快速融入团队', color: '#FFF7ED' },
    { id: 'company-policy', name: '核心业务指南', icon: '📁', desc: '涵盖系统核心功能、业务流转及关键规则的权威指南', color: '#EEF0FF' },
    { id: 'product-skills', name: '产品能力提升', icon: '📋', desc: '工作技能提升', color: '#F0FDF4' },
];

export default function KnowledgeBase() {
    const [docs, setDocs] = useState([]); // 默认空数组，待加载
    const [previewDoc, setPreviewDoc] = useState(null);
    const fileInputRef = useRef(null);
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

    // 集合列表（从 localStorage 读取，非核心数据暂不迁后端）
    const [collections, setCollections] = useState(() => {
        const saved = JSON.parse(localStorage.getItem('daisy_ai_collections') || 'null');
        return saved || DEFAULT_COLLECTIONS;
    });
    const [selectedId, setSelectedId] = useState(collections[0]?.id || null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [showNewModal, setShowNewModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');

    // 编辑分类相关状态
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');

    const [toast, setToast] = useState('');

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    // ── 1. 组件加载时从后端拉取全量数据 ──
    useEffect(() => {
        const loadKB = async () => {
            const list = await storage.fetchKnowledge(apiBase);
            setDocs(list);
        };
        loadKB();
    }, []);

    // 同步 collections 到 localStorage
    const saveCollections = (cols) => {
        setCollections(cols);
        localStorage.setItem('daisy_ai_collections', JSON.stringify(cols));
    };

    // 当前选中的分类
    const selectedCol = collections.find(c => c.id === selectedId) || collections[0];
    // 过滤出当前分类下的文档
    const colDocs = docs.filter(d => d.collection === selectedId);

    // ── 2. 处理文件上传 (异步 Job 模式) ──
    const handleFiles = async (files) => {
        if (!selectedId) return;
        setUploading(true);

        for (const file of files) {
            try {
                const formData = new FormData();
                formData.append('file', file);

                // 1. 发起上传请求，获取 JobId
                const res = await axios.post(`${apiBase}/api/upload`, formData);

                if (res.data.success) {
                    const jobId = res.data.jobId;

                    // 2. 先插入一个“处理中”的占位文档
                    const placeholderDoc = {
                        id: jobId, // 临时使用 jobId 作为 ID
                        jobId: jobId,
                        name: file.name,
                        size: formatSize(file.size),
                        type: file.name.split('.').pop().toUpperCase(),
                        collection: selectedId,
                        status: 'processing', // 处理中状态
                        progress: 0,
                        uploadDate: new Date().toLocaleDateString('zh-CN'),
                        createdAt: Date.now(),
                        content: '',
                        charCount: 0
                    };

                    setDocs(prev => {
                        const updated = [placeholderDoc, ...prev];
                        storage.syncKnowledge(updated, apiBase);
                        return updated;
                    });

                    // 3. 开启轮询追踪进度
                    pollJobStatus(jobId);
                }
            } catch (err) {
                console.error('Upload error:', err);
                alert(`上传失败: ${file.name}`);
            }
        }
        setUploading(false);
    };

    // ── 3. 轮询 Job 状态 ──
    const pollJobStatus = async (jobId) => {
        const timer = setInterval(async () => {
            try {
                const res = await axios.get(`${apiBase}/api/jobs/${jobId}`);
                if (res.data.success) {
                    const job = res.data.job;

                    // 更新文档列表中的对应项
                    setDocs(prev => {
                        const updated = prev.map(d => {
                            if (d.jobId === jobId) {
                                return {
                                    ...d,
                                    status: job.status === 'completed' ? 'synced' : job.status, // 'synced' for completed, 'failed' for failed
                                    progress: job.progress,
                                    message: job.message || '正在解析...',
                                    ...(job.status === 'completed' ? {
                                        content: job.result.content,
                                        charCount: job.result.charCount,
                                        isLowQuality: job.result.isLowQuality,
                                        id: Date.now() + Math.random().toString(36).substr(2, 9) // 最终真实 ID
                                    } : {})
                                };
                            }
                            return d;
                        });

                        // 只有完成或失败时，才同步并停止轮询
                        if (job.status === 'completed' || job.status === 'failed') {
                            clearInterval(timer);
                            // Filter out failed jobs before syncing
                            storage.syncKnowledge(updated.filter(u => u.status !== 'failed'), apiBase);
                        }
                        return updated;
                    });
                }
            } catch (e) {
                console.error('Polling error:', e);
                clearInterval(timer);
                setDocs(prev => prev.map(d => d.jobId === jobId ? { ...d, status: 'failed', message: '轮询失败' } : d));
            }
        }, 2000); // 每2秒查询一次
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(Array.from(e.dataTransfer.files));
    };

    const handleDelete = (id) => {
        setDocs(prev => {
            const updated = prev.filter(d => d.id !== id);
            storage.syncKnowledge(updated, apiBase); // 异步同步到后端
            return updated;
        });
    };

    const handleSyncAll = async () => {
        // 全部同步 — 将当前状态显式推送到后端
        const success = await storage.syncKnowledge(docs, apiBase);
        if (success) {
            showToast('✅ 已成功覆盖同步至后端存储！');
        } else {
            showToast('❌ 同步失败，请检查网络或后端服务。');
        }
    };

    // 新建知识库分类
    const handleCreateCollection = () => {
        if (!newName.trim()) return;
        const ICONS = ['📁', '📂', '📋', '📝', '🗂️', '💼', '🔖', '📌'];
        const COLORS = ['#EEF0FF', '#F0FDF4', '#FFF7ED', '#FEF2F2', '#F0F9FF', '#FEFCE8', '#F5F3FF', '#FFF1F2'];
        const idx = collections.length % ICONS.length;
        const newCol = {
            id: `col-${Date.now()}`,
            name: newName.trim(),
            desc: newDesc.trim() || '暂无描述',
            icon: ICONS[idx],
            color: COLORS[idx],
        };
        saveCollections([...collections, newCol]);
        setSelectedId(newCol.id);
        setShowNewModal(false);
        setNewName('');
        setNewDesc('');
    };

    // 打开编辑模式
    const openEditModal = () => {
        if (!selectedCol) return;
        setEditName(selectedCol.name);
        setEditDesc(selectedCol.desc);
        setShowEditModal(true);
    };

    // 保存编辑修改
    const handleSaveEdit = () => {
        if (!editName.trim() || !selectedCol) return;
        const updatedCols = collections.map(c => {
            if (c.id === selectedCol.id) {
                return { ...c, name: editName.trim(), desc: editDesc.trim() || '暂无描述' };
            }
            return c;
        });
        saveCollections(updatedCols);
        setShowEditModal(false);
        showToast('✅ 知识库信息已成功更新');
    };

    const handleDeleteCollection = (colId) => {
        if (!window.confirm('确认删除该知识库分类及其所有文档？')) return;
        saveCollections(collections.filter(c => c.id !== colId));
        setDocs(prev => {
            const updated = prev.filter(d => d.collection !== colId);
            storage.syncKnowledge(updated, apiBase);
            return updated;
        });
        if (selectedId === colId) setSelectedId(collections[0]?.id || null);
    };

    const formatSize = (bytes) => {
        if (!bytes) return '未知大小';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    };

    const getDocTypeColor = (type) => {
        const t = (type || '').toLowerCase();
        if (t === 'pdf') return '#EF4444';
        if (t === 'docx' || t === 'doc') return '#3B82F6';
        if (t === 'md' || t === 'txt') return '#6B7280';
        if (t === 'pptx' || t === 'ppt') return '#EA580C'; // Orange for PPT
        return '#8B5CF6';
    };

    const getRelativeTime = (colDocs) => {
        if (!colDocs || colDocs.length === 0) return '尚未更新';

        // Find latest timestamp among documents in this collection
        const latestTime = Math.max(...colDocs.map(d => {
            if (d.createdAt) return d.createdAt;
            // Fallback for old documents based on uploadDate
            if (d.uploadDate) {
                const dateParts = d.uploadDate.split(/[/-]/);
                if (dateParts.length === 3) return new Date(d.uploadDate).getTime();
            }
            return 0;
        }));

        if (latestTime === 0) return '未知时间';

        const diff = Date.now() - latestTime;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return '刚刚更新';
        if (minutes < 60) return `${minutes} 分钟前`;
        if (hours < 24) return `${hours} 小时前`;
        if (days < 30) return `${days} 天前`;
        return '1 个月前';
    };

    return (
        <div className="kb-root">
            {toast && <div className="kb-toast">{toast}</div>}
            {/* ===== 现有知识库 ===== */}
            <div className="kb-section-wrap">
                <div className="kb-top-bar">
                    <h2 className="kb-section-title">现有知识库</h2>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowNewModal(true)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        新建知识库
                    </button>
                </div>

                <div className="kb-cards-grid">
                    {collections.map(col => {
                        const count = docs.filter(d => d.collection === col.id).length;
                        const isActive = col.id === selectedId;
                        return (
                            <div
                                key={col.id}
                                className={`kb-card ${isActive ? 'active' : ''}`}
                                onClick={() => setSelectedId(col.id)}
                            >
                                <div className="kb-card-icon" style={{ background: col.color }}>{col.icon}</div>
                                <div className="kb-card-name">{col.name}</div>
                                <div className="kb-card-desc-wrapper">
                                    <div className="kb-card-desc">{col.desc}</div>
                                    <div className="kb-card-tooltip">{col.desc}</div>
                                </div>
                                <div className="kb-card-footer">
                                    <span className="kb-card-count">{count} 个文档</span>
                                    <span className="kb-card-sync">{getRelativeTime(docs.filter(d => d.collection === col.id))}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ===== 知识库详情 ===== */}
            {selectedCol && (
                <div className="kb-detail-wrap">
                    {/* 详情头部 */}
                    <div className="kb-detail-header">
                        <div>
                            <h2 className="kb-detail-title">知识库详情：{selectedCol.name}</h2>
                            <p className="kb-detail-sub">上传 PDF、Word、PPT 或 TXT 文件进行 AI 训练</p>
                        </div>
                        <div className="kb-header-actions">
                            <button
                                className="kb-edit-col-btn"
                                onClick={openEditModal}
                                title="编辑知识库信息"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                </svg>
                                编辑知识库
                            </button>
                            <button
                                className="kb-delete-col-btn"
                                onClick={() => handleDeleteCollection(selectedCol.id)}
                                title="删除该知识库"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                                删除知识库
                            </button>
                        </div>
                    </div>

                    {/* 上传区 */}
                    <div
                        className={`kb-dropzone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.docx,.doc,.txt,.md,.pptx,.ppt"
                            style={{ display: 'none' }}
                            onChange={e => handleFiles(Array.from(e.target.files))}
                        />
                        {uploading ? (
                            <div className="kb-dropzone-content">
                                <div className="spinner spinner-primary" style={{ width: 36, height: 36 }} />
                                <p className="kb-dropzone-main">正在上传并解析文件…</p>
                            </div>
                        ) : (
                            <div className="kb-dropzone-content">
                                <div className="kb-upload-icon">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                        <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                                        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                                    </svg>
                                </div>
                                <p className="kb-dropzone-main">拖拽文件到此处上传</p>
                                <p className="kb-dropzone-sub">
                                    或者<span className="kb-browse-link">点此处从文件夹中选择</span>（支持 .pdf、.docx、.txt、.md）
                                </p>
                                <p className="kb-dropzone-hint">单个文件不超过 500MB</p>
                            </div>
                        )}
                    </div>

                    {/* 文件列表 */}
                    <div className="kb-filelist-header">
                        <h3 className="kb-filelist-title">文件列表（{colDocs.length}）</h3>
                        {colDocs.length > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={handleSyncAll}>全部同步</button>
                        )}
                    </div>

                    {colDocs.length === 0 ? (
                        <div className="kb-filelist-empty">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <p>该知识库暂无文档，请上传文件开始训练</p>
                        </div>
                    ) : (
                        <div className="kb-filelist">
                            {colDocs.map((doc) => {
                                const chars = doc.charCount || doc.content?.length || 0;
                                const hasContent = chars > 0;
                                return (
                                    <div key={doc.id} className={`kb-file-row ${doc.isLowQuality ? 'is-low-quality' : ''}`}>
                                        <div className="kb-file-icon" style={{ background: getDocTypeColor(doc.type) }}>
                                            {(doc.type || 'F')[0].toUpperCase()}
                                        </div>
                                        <div className="kb-file-info">
                                            <span className="kb-file-name">
                                                {doc.name}
                                                {doc.status === 'processing' && <span className="kb-processing-badge">处理中</span>}
                                                {doc.status === 'failed' && <span className="kb-error-badge">处理失败</span>}
                                                {doc.isLowQuality && doc.status !== 'processing' && <span className="kb-warning-badge" title="提取字数异常低，可能是扫描版PDF或图片">⚠️ 异常</span>}
                                            </span>
                                            <span className="kb-file-meta">
                                                {doc.size} · 上传于 {doc.uploadDate}
                                                {doc.status === 'processing' ? (
                                                    <div className="kb-file-status processing">
                                                        <div className="kb-progress-bar">
                                                            <div className="kb-progress-inner" style={{ width: `${doc.progress}%` }}></div>
                                                        </div>
                                                        <span className="kb-progress-text">{doc.message || '解析中...'} {doc.progress}%</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {hasContent
                                                            ? (
                                                                <>
                                                                    <span className="kb-content-tag ok">✓ 已提取 {chars > 10000 ? (chars / 10000).toFixed(1) + '万' : chars} 字</span>
                                                                    <span className="kb-content-tag sync" style={{ marginLeft: '6px', color: '#059669', background: '#D1FAE5' }}>☁️ 云端已同步</span>
                                                                </>
                                                            )
                                                            : <span className="kb-content-tag fail">⚠ 内容未提取，请重新上传</span>
                                                        }
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                        <div className="kb-file-actions">
                                            <button className="btn btn-ghost btn-xs" onClick={() => setPreviewDoc(doc)} disabled={doc.status === 'processing'}>预览内容</button>
                                            <button className="kb-file-del" onClick={() => handleDelete(doc.id)} title="删除">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ===== 新建知识库 Modal ===== */}
            {showNewModal && (
                <div className="kb-modal-overlay" onClick={() => setShowNewModal(false)}>
                    <div className="kb-modal" onClick={e => e.stopPropagation()}>
                        <h3 className="kb-modal-title">新建知识库</h3>
                        <label className="kb-modal-label">知识库名称 <span style={{ color: '#ef4444' }}>*</span></label>
                        <input
                            className="kb-modal-input"
                            placeholder="例如：产品使用手册"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            autoFocus
                        />
                        <label className="kb-modal-label">描述（可选）</label>
                        <input
                            className="kb-modal-input"
                            placeholder="简短描述该知识库的用途"
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                        />
                        <div className="kb-modal-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowNewModal(false)}>取消</button>
                            <button className="btn btn-primary btn-sm" onClick={handleCreateCollection} disabled={!newName.trim()}>
                                创建
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== 编辑知识库 Modal ===== */}
            {showEditModal && (
                <div className="kb-modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="kb-modal" onClick={e => e.stopPropagation()}>
                        <h3 className="kb-modal-title">编辑知识库：{selectedCol?.name}</h3>
                        <label className="kb-modal-label">修改名称 <span style={{ color: '#ef4444' }}>*</span></label>
                        <input
                            className="kb-modal-input"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            autoFocus
                        />
                        <label className="kb-modal-label">修改描述</label>
                        <input
                            className="kb-modal-input"
                            value={editDesc}
                            onChange={e => setEditDesc(e.target.value)}
                        />
                        <div className="kb-modal-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowEditModal(false)}>取消</button>
                            <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={!editName.trim()}>
                                保存修改
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ===== 内容预览 Modal ===== */}
            {previewDoc && (
                <div className="kb-modal-overlay" onClick={() => setPreviewDoc(null)}>
                    <div className="kb-modal kb-modal-large" onClick={e => e.stopPropagation()}>
                        <div className="kb-modal-header">
                            <h3 className="kb-modal-title">内容预览：{previewDoc.name}</h3>
                            <button className="btn-close" onClick={() => setPreviewDoc(null)}>×</button>
                        </div>
                        <div className="kb-preview-content">
                            {previewDoc.content ? (
                                <pre>{previewDoc.content.slice(0, 2000)}{previewDoc.content.length > 2000 ? '...' : ''}</pre>
                            ) : (
                                <div className="kb-preview-empty">
                                    <p>该文档未提取到任何文字内容。</p>
                                    <p className="hint">提示：请确保 PDF 不是扫描图片版。如果是图片版，请先进行 OCR 文字识别后再上传。</p>
                                </div>
                            )}
                        </div>
                        <div className="kb-modal-footer">
                            <span className="kb-char-info">共提取 {previewDoc.charCount || 0} 个字符</span>
                            <button className="btn btn-primary btn-sm" onClick={() => setPreviewDoc(null)}>关闭</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
