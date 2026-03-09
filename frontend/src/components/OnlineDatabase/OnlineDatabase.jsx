import { useState, useCallback, useEffect, useRef } from 'react';
import { storage } from '../../utils/storage';
import './OnlineDatabase.css';

export default function OnlineDatabase() {
    const [db, setDb] = useState(() => storage.getDatabase());
    const [activeSheet, setActiveSheet] = useState(() => Object.keys(storage.getDatabase().sheets)[0] || 'Sheet1');
    const [history, setHistory] = useState([]);
    const [future, setFuture] = useState([]);
    const [editCell, setEditCell] = useState(null); // { row, col }
    const [editValue, setEditValue] = useState('');
    const [savedMsg, setSavedMsg] = useState('');

    // Sheet 编辑与右键菜单状态
    const [editingSheet, setEditingSheet] = useState(null);
    const [editingSheetName, setEditingSheetName] = useState('');
    const [contextMenu, setContextMenu] = useState(null); // {x, y, sheetName}
    const [sheetToDelete, setSheetToDelete] = useState(null);

    const sheetNames = Object.keys(db.sheets);
    const sheet = db.sheets[activeSheet] || { headers: [], rows: [] };

    // Format date logic for LAST SYNCED
    const formatLastSynced = () => {
        const d = new Date();
        const pad = n => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const pushHistory = (oldDb) => {
        setHistory(h => [...h.slice(-20), JSON.parse(JSON.stringify(oldDb))]);
        setFuture([]);
    };

    const updateSheet = (newSheet) => {
        pushHistory(db);
        setDb(prev => {
            const updated = { ...prev, sheets: { ...prev.sheets, [activeSheet]: newSheet } };
            storage.setDatabase(updated);
            return updated;
        });
    };

    const handleCellClick = (row, col) => {
        const val = row === -1 ? sheet.headers[col] : (sheet.rows[row]?.[col] || '');
        setEditCell({ row, col });
        setEditValue(val);
    };

    const handleCellBlur = () => {
        if (editCell === null) return;
        const { row, col } = editCell;
        if (row === -1) {
            const newHeaders = [...sheet.headers];
            newHeaders[col] = editValue;
            updateSheet({ ...sheet, headers: newHeaders });
        } else {
            const newRows = sheet.rows.map((r, ri) =>
                ri === row ? r.map((c, ci) => ci === col ? editValue : c) : r
            );
            updateSheet({ ...sheet, rows: newRows });
        }
        setEditCell(null);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') handleCellBlur();
    };

    const addRow = () => {
        const emptyRow = new Array(sheet.headers.length).fill('');
        updateSheet({ ...sheet, rows: [...sheet.rows, emptyRow] });
    };

    const addColumn = () => {
        const newHeaders = [...sheet.headers, `列${sheet.headers.length + 1}`];
        const newRows = sheet.rows.map(r => [...r, '']);
        updateSheet({ headers: newHeaders, rows: newRows });
    };

    const deleteRow = (idx) => {
        const newRows = sheet.rows.filter((_, i) => i !== idx);
        updateSheet({ ...sheet, rows: newRows });
    };

    const addSheet = () => {
        const name = `Sheet${sheetNames.length + 1}`;
        const newDb = { ...db, sheets: { ...db.sheets, [name]: { headers: ['列A', '列B', '列C'], rows: [] } } };
        pushHistory(db);
        setDb(newDb);
        storage.setDatabase(newDb);
        setActiveSheet(name);
    };

    // ===== Sheet 交互逻辑 =====

    const handleSheetDoubleClick = (name) => {
        setEditingSheet(name);
        setEditingSheetName(name);
    };

    const handleSheetNameSave = () => {
        if (!editingSheet || !editingSheetName.trim()) {
            setEditingSheet(null);
            return;
        }
        const newName = editingSheetName.trim();
        if (newName === editingSheet) {
            setEditingSheet(null);
            return;
        }
        // 检查重名
        if (db.sheets[newName]) {
            alert('工作表名称已存在');
            setEditingSheet(null);
            return;
        }

        const newSheets = {};
        for (const [key, val] of Object.entries(db.sheets)) {
            if (key === editingSheet) {
                newSheets[newName] = val;
            } else {
                newSheets[key] = val;
            }
        }

        pushHistory(db);
        const newDb = { ...db, sheets: newSheets };
        setDb(newDb);
        storage.setDatabase(newDb);
        if (activeSheet === editingSheet) {
            setActiveSheet(newName);
        }
        setEditingSheet(null);
    };

    const handleContextMenu = (e, name) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, sheetName: name });
    };

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    useEffect(() => {
        if (contextMenu) {
            window.addEventListener('click', closeContextMenu);
            return () => window.removeEventListener('click', closeContextMenu);
        }
    }, [contextMenu, closeContextMenu]);

    const requestDeleteSheet = (name) => {
        if (sheetNames.length <= 1) return; // 拦截仅剩的表
        setSheetToDelete(name);
    };

    const confirmDeleteSheet = () => {
        if (!sheetToDelete) return;
        const newSheets = { ...db.sheets };
        delete newSheets[sheetToDelete];
        pushHistory(db);
        const newDb = { ...db, sheets: newSheets };
        setDb(newDb);
        storage.setDatabase(newDb);
        if (activeSheet === sheetToDelete) {
            setActiveSheet(Object.keys(newSheets)[0]);
        }
        setSheetToDelete(null);
    };

    const undo = () => {
        if (!history.length) return;
        const prev = history[history.length - 1];
        setFuture(f => [JSON.parse(JSON.stringify(db)), ...f]);
        setHistory(h => h.slice(0, -1));
        setDb(prev);
        storage.setDatabase(prev);
    };

    const redo = () => {
        if (!future.length) return;
        const next = future[0];
        setHistory(h => [...h, JSON.parse(JSON.stringify(db))]);
        setFuture(f => f.slice(1));
        setDb(next);
        storage.setDatabase(next);
    };

    const saveChanges = () => {
        storage.setDatabase(db);
        setSavedMsg('已保存');
        setTimeout(() => setSavedMsg(''), 2000);
    };

    const exportCSV = () => {
        const lines = [sheet.headers.join(','), ...sheet.rows.map(r => r.join(','))];
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${activeSheet}.csv`;
        link.click();
    };

    return (
        <div className="odb-root">
            {/* 工具栏 */}
            <div className="odb-toolbar">
                <div className="odb-toolbar-left">
                    <button className="toolbar-btn" onClick={undo} disabled={!history.length} title="撤销">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                        </svg>
                        Undo
                    </button>
                    <button className="toolbar-btn" onClick={redo} disabled={!future.length} title="重做">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                        </svg>
                        Redo
                    </button>
                    <div className="toolbar-divider" />
                    <button className="toolbar-btn" title="筛选">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                        Filter
                    </button>
                    <button className="toolbar-btn" title="排序">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
                            <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                        </svg>
                        Sort
                    </button>
                </div>
                <div className="odb-toolbar-right">
                    <button id="export-csv-btn" className="btn btn-ghost btn-sm" onClick={exportCSV}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export CSV
                    </button>
                    <button id="save-changes-btn" className="btn btn-primary btn-sm" onClick={saveChanges}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                        </svg>
                        {savedMsg || 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* 表格区域 */}
            <div className="odb-table-wrap">
                {/* 列标头 (A, B, C...) */}
                <div className="odb-table-container">
                    <table className="odb-table">
                        <thead>
                            {/* 列字母行 */}
                            <tr className="col-letter-row">
                                <th className="row-num-header" />
                                {sheet.headers.map((_, ci) => (
                                    <th key={ci} className="col-letter">{String.fromCharCode(65 + ci)}</th>
                                ))}
                                <th className="add-col-header">
                                    <button className="add-col-btn" onClick={addColumn} title="添加列">+</button>
                                </th>
                            </tr>
                            {/* 表头行 */}
                            <tr className="header-row">
                                <th className="row-num-header" />
                                {sheet.headers.map((h, ci) => (
                                    <th
                                        key={ci}
                                        className={`header-cell ${editCell?.row === -1 && editCell?.col === ci ? 'editing' : ''}`}
                                        onClick={() => handleCellClick(-1, ci)}
                                    >
                                        {editCell?.row === -1 && editCell?.col === ci ? (
                                            <input
                                                className="cell-input"
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onBlur={handleCellBlur}
                                                onKeyDown={handleKeyDown}
                                                autoFocus
                                            />
                                        ) : h}
                                    </th>
                                ))}
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {sheet.rows.map((row, ri) => (
                                <tr key={ri} className="data-row">
                                    <td className="row-num">
                                        {ri + 1}
                                        <button className="delete-row-btn" onClick={() => deleteRow(ri)} title="删除行">×</button>
                                    </td>
                                    {sheet.headers.map((_, ci) => {
                                        const isEditing = editCell?.row === ri && editCell?.col === ci;
                                        const val = row[ci] || '';
                                        return (
                                            <td
                                                key={ci}
                                                className={`data-cell ${isEditing ? 'editing' : ''}`}
                                                onClick={() => handleCellClick(ri, ci)}
                                            >
                                                {isEditing ? (
                                                    <input
                                                        className="cell-input"
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onBlur={handleCellBlur}
                                                        onKeyDown={handleKeyDown}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <StatusCell value={val} colName={sheet.headers[ci]} />
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td />
                                </tr>
                            ))}
                            {/* 添加行按钮 */}
                            {Array.from({ length: Math.max(0, 8 - sheet.rows.length) }).map((_, i) => (
                                <tr key={`empty-${i}`} className="empty-row" onClick={i === 0 ? addRow : undefined}>
                                    <td className="row-num">{sheet.rows.length + i + 1}</td>
                                    {sheet.headers.map((_, ci) => <td key={ci} className="data-cell empty" />)}
                                    <td />
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 底部 Sheet 标签 */}
            <div className="odb-sheet-bar">
                {sheetNames.map(name => (
                    <button
                        key={name}
                        className={`sheet-tab ${name === activeSheet ? 'active' : ''}`}
                        onClick={() => setActiveSheet(name)}
                        onDoubleClick={() => handleSheetDoubleClick(name)}
                        onContextMenu={(e) => handleContextMenu(e, name)}
                    >
                        {editingSheet === name ? (
                            <input
                                autoFocus
                                className="sheet-name-input"
                                value={editingSheetName}
                                onChange={e => setEditingSheetName(e.target.value)}
                                onBlur={handleSheetNameSave}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSheetNameSave();
                                    if (e.key === 'Escape') setEditingSheet(null);
                                }}
                                onFocus={e => e.target.select()}
                                style={{ width: `${Math.max(40, editingSheetName.length * 12 + 10)}px` }}
                            />
                        ) : name}
                    </button>
                ))}
                <button className="sheet-tab-add" onClick={addSheet} title="新建 Sheet">+</button>
                <div className="sheet-bar-right">
                    <span className="last-synced">LAST SYNCED: {formatLastSynced()}</span>
                </div>
            </div>

            {/* 右键菜单 */}
            {contextMenu && (
                <div
                    className="odb-context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y - 40 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className="odb-context-menu-item"
                        onClick={() => {
                            closeContextMenu();
                            requestDeleteSheet(contextMenu.sheetName);
                        }}
                        style={{ opacity: sheetNames.length <= 1 ? 0.4 : 1, cursor: sheetNames.length <= 1 ? 'not-allowed' : 'pointer' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                        删除此工作表
                    </div>
                </div>
            )}

            {/* 个性化删除弹窗 */}
            {sheetToDelete && (
                <div className="odb-modal-overlay">
                    <div className="odb-modal">
                        <h3 className="odb-modal-title">要告别这段数据吗？</h3>
                        <p className="odb-modal-desc">
                            工作表 <b>{sheetToDelete}</b> 即将被删除，数据销毁后不仅无法找回，这片虚空可能还会想念你。
                        </p>
                        <div className="odb-modal-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => setSheetToDelete(null)}>我再想想</button>
                            <button className="btn btn-danger btn-sm" style={{ background: '#ef4444', color: 'white', border: 'none' }} onClick={confirmDeleteSheet}>狠心删除</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 状态单元格渲染
function StatusCell({ value, colName }) {
    const statusColors = {
        'Active': { bg: '#D1FAE5', color: '#065F46' },
        'Pending': { bg: '#FEF3C7', color: '#92400E' },
        'Inactive': { bg: '#F3F4F6', color: '#6B7280' },
        '已完成': { bg: '#D1FAE5', color: '#065F46' },
        '处理中': { bg: '#DBEAFE', color: '#1E40AF' },
        '待处理': { bg: '#FEF3C7', color: '#92400E' },
        '审核中': { bg: '#EDE9FE', color: '#5B21B6' },
    };

    const isStatus = colName?.includes('状态') || colName?.includes('Status') || colName === 'status';
    const style = isStatus ? statusColors[value] : null;

    if (style && value) {
        return (
            <span className="status-pill" style={{ background: style.bg, color: style.color }}>
                {value}
            </span>
        );
    }

    return <span className={value ? '' : 'empty-cell-text'}>{value || ''}</span>;
}
