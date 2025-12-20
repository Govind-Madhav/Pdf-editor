import React, { useState, useRef, useEffect } from 'react';
import {
    Type, Pen, Highlighter, Image as ImageIcon, MousePointer2,
    ZoomIn, ZoomOut, ChevronLeft, ChevronRight, X, Save,
    Undo, Redo, Eraser
} from 'lucide-react';
import { renderPageToImage, extractPageText } from '../utils/pdf-render';

const TOOL_TYPES = {
    SELECT: 'select',
    TEXT: 'text',
    PEN: 'pen',
    HIGHLIGHT: 'highlight',
    IMAGE: 'image',
    ERASE: 'erase'
};

const PEN_COLORS = {
    BLACK: '#000000',
    RED: '#ef4444',
    BLUE: '#3b82f6',
    GREEN: '#22c55e'
};

const HIGHLIGHT_COLORS = {
    YELLOW: '#facc15',
    GREEN: '#4ade80',
    CYAN: '#22d3ee',
    PINK: '#f472b6',
    ORANGE: '#fb923c'
};

const Thumbnail = ({ file, page, isActive, onClick }) => {
    const [url, setUrl] = useState(null);
    useEffect(() => {
        let active = true;
        renderPageToImage(file, page.originalIndex, 0.3).then(u => {
            if (active) setUrl(u);
        });
        return () => { active = false; };
    }, [file, page.originalIndex]);

    return (
        <div
            onClick={onClick}
            className={`aspect-[1/1.4] w-full bg-white rounded-md border-2 transition-all cursor-pointer relative overflow-hidden flex items-center justify-center ${isActive ? 'border-red-500 ring-2 ring-red-100 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
        >
            {url ? (
                <img src={url} className="max-w-full max-h-full object-contain pointer-events-none select-none" style={{ transform: `rotate(${page.rotation}deg)` }} alt="" />
            ) : (
                <div className="w-4 h-4 border-2 border-slate-300 border-t-red-500 rounded-full animate-spin"></div>
            )}
            <div className="absolute bottom-1 right-1 bg-slate-900/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono backdrop-blur-sm">{page.originalIndex + 1}</div>
        </div>
    )
};

const PageEditor = ({ page, file, allPages, onClose, onSaveAnnotations, initialAnnotations = [], onPageChange }) => {
    const [scale, setScale] = useState(1);
    const [activeTool, setActiveTool] = useState(TOOL_TYPES.SELECT);
    const [activeColor, setActiveColor] = useState(PEN_COLORS.BLACK);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [imgDims, setImgDims] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState(null);
    const [textInput, setTextInput] = useState(null);

    // Text Awareness
    const [pageTextItems, setPageTextItems] = useState([]);
    const [activeTextSnap, setActiveTextSnap] = useState(null);
    const textCacheRef = useRef(new Map());

    // History Management
    const [history, setHistory] = useState([initialAnnotations]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const MAX_HISTORY = 50;

    const annotations = history[historyIndex];

    const containerRef = useRef(null);
    const fileInputRef = useRef(null);
    const itemClickedRef = useRef(false);

    // Auto-search palette for current color when tool changes
    useEffect(() => {
        if (activeTool === TOOL_TYPES.HIGHLIGHT) {
            // Switch to yellow if current color isn't in highlight palette
            if (!Object.values(HIGHLIGHT_COLORS).includes(activeColor)) {
                setActiveColor(HIGHLIGHT_COLORS.YELLOW);
            }
        } else if (activeTool === TOOL_TYPES.PEN || activeTool === TOOL_TYPES.TEXT) {
            // Switch to black if current color isn't in pen palette
            if (!Object.values(PEN_COLORS).includes(activeColor)) {
                setActiveColor(PEN_COLORS.BLACK);
            }
        }
    }, [activeTool]);

    useEffect(() => {
        if (page && file) {
            setPreviewUrl(null);
            setImgDims(null);
            setTextInput(null);
            setPageTextItems([]);
            setActiveTextSnap(null);

            renderPageToImage(file, page.originalIndex, 2).then(setPreviewUrl);

            // Check cache for text
            if (textCacheRef.current.has(page.id)) {
                setPageTextItems(textCacheRef.current.get(page.id));
            } else {
                extractPageText(file, page.originalIndex).then(items => {
                    textCacheRef.current.set(page.id, items);
                    setPageTextItems(items);
                });
            }

            const initial = initialAnnotations || [];
            setHistory([initial]);
            setHistoryIndex(0);
        }
    }, [page, file]);

    const addToHistory = (newAnnotations) => {
        let newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newAnnotations);
        if (newHistory.length > MAX_HISTORY) {
            newHistory = newHistory.slice(newHistory.length - MAX_HISTORY);
        }
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const handleUndo = () => { if (historyIndex > 0) setHistoryIndex(historyIndex - 1); };
    const handleRedo = () => { if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1); };
    const handleZoomIn = () => setScale(s => Math.min(s + 0.1, 3));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.1, 0.5));

    const getRelativeCoords = (e) => {
        if (!containerRef.current || !imgDims) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / scale,
            y: (e.clientY - rect.top) / scale
        };
    };

    const findTextSnap = (x, y) => {
        if (pageTextItems.length === 0 || !imgDims) return null;

        // Approximate factor between PDF point coords and Rendered Image pixels
        const firstItem = pageTextItems[0];
        const factor = firstItem ? (imgDims.height / firstItem.viewportHeight) : 2;

        for (const item of pageTextItems) {
            const top = item.y * factor;
            const height = item.height * factor;
            const bottom = top + height;
            const left = item.x * factor;
            const right = left + (item.width * factor);

            const padding = 12;

            if (y >= top - padding && y <= bottom + padding && x >= left - 100 && x <= right + 100) {
                return {
                    y: top + (height / 2),
                    height: height * 1.5,
                    isSnap: true
                };
            }
        }
        return null;
    };

    // Eraser Logic
    const eraseAt = (x, y) => {
        const threshold = 10 / scale; // Eraser radius relative to page scale

        const remaining = annotations.filter(ann => {
            if (ann.type === 'path') {
                // Check if any point in path is close
                return !ann.points.some(p => Math.hypot(p.x - x, p.y - y) < threshold);
            }
            if (ann.type === 'image') {
                return !(x >= ann.x && x <= ann.x + ann.width && y >= ann.y && y <= ann.y + ann.height);
            }
            if (ann.type === 'text') {
                // Simple bounding box approx
                const approxWidth = ann.text.length * (ann.size * 0.6);
                return !(x >= ann.x && x <= ann.x + approxWidth && y >= ann.y - ann.size && y <= ann.y);
            }
            return true;
        });

        if (remaining.length !== annotations.length) {
            addToHistory(remaining);
        }
    };

    const handlePointerDown = (e) => {
        // Capture pointer to ensure we get moves/ups even outside container
        e.target.setPointerCapture(e.pointerId);

        if (activeTool === TOOL_TYPES.ERASE) {
            setIsDrawing(true); // Reusing isDrawing for eraser state
            const { x, y } = getRelativeCoords(e);
            eraseAt(x, y);
            return;
        }

        if (activeTool === TOOL_TYPES.PEN || activeTool === TOOL_TYPES.HIGHLIGHT) {
            setIsDrawing(true);
            let { x, y } = getRelativeCoords(e);

            let width = activeTool === TOOL_TYPES.HIGHLIGHT ? 20 : 3;
            let finalY = y;

            if (activeTool === TOOL_TYPES.HIGHLIGHT) {
                const snap = findTextSnap(x, y);
                if (snap) {
                    finalY = snap.y;
                    width = snap.height;
                    setActiveTextSnap(snap); // Lock
                }
            }

            setCurrentPath({
                type: 'path',
                tool: activeTool,
                color: activeColor, // Use active color for highlights too
                width: width,
                opacity: activeTool === TOOL_TYPES.HIGHLIGHT ? 0.4 : 1,
                points: [{ x, y: finalY }]
            });
        }
    };

    const handlePointerMove = (e) => {
        if (!isDrawing) return;

        const { x, y } = getRelativeCoords(e);

        if (activeTool === TOOL_TYPES.ERASE) {
            eraseAt(x, y);
            return;
        }

        if (currentPath) {
            let nextY = y;
            if (activeTool === TOOL_TYPES.HIGHLIGHT && activeTextSnap) {
                nextY = activeTextSnap.y; // Lock Y
            }

            setCurrentPath(prev => ({
                ...prev,
                points: [...prev.points, { x, y: nextY }]
            }));
        }
    };

    const handlePointerUp = (e) => {
        e.target.releasePointerCapture(e.pointerId);

        if (activeTool === TOOL_TYPES.ERASE) {
            setIsDrawing(false);
            return;
        }

        if (isDrawing && currentPath) {
            addToHistory([...annotations, {
                ...currentPath,
                meta: { width: imgDims?.width, height: imgDims?.height }
            }]);
            setIsDrawing(false);
            setCurrentPath(null);
            setActiveTextSnap(null);
        }
    };

    const handleCanvasClick = (e) => {
        if (activeTool === TOOL_TYPES.TEXT) {
            if (itemClickedRef.current) {
                itemClickedRef.current = false;
                return;
            }
            const { x, y } = getRelativeCoords(e);
            setTextInput({ x, y, value: '', fontSize: 16, color: activeColor });
            setActiveTool(TOOL_TYPES.SELECT);
        }
    };

    const handleTextComplete = () => {
        if (textInput && textInput.value.trim()) {
            addToHistory([...annotations, {
                type: 'text',
                x: textInput.x,
                y: textInput.y,
                text: textInput.value,
                size: textInput.fontSize,
                color: textInput.color,
                meta: { width: imgDims?.width, height: imgDims?.height }
            }]);
        }
        setTextInput(null);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                addToHistory([...annotations, {
                    type: 'image',
                    x: 50,
                    y: 50,
                    width: 200,
                    height: 200 * (imgDims ? imgDims.height / imgDims.width : 1),
                    dataUrl: ev.target.result,
                    meta: { width: imgDims?.width, height: imgDims?.height }
                }]);
            };
            reader.readAsDataURL(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
        setActiveTool(TOOL_TYPES.SELECT);
    };

    const deleteAnnotation = (index) => {
        addToHistory(annotations.filter((_, i) => i !== index));
    };

    const getContainerStyle = () => {
        if (!imgDims) return {};
        const isRotated = page.rotation % 180 !== 0;
        const width = (isRotated ? imgDims.height : imgDims.width) * scale;
        const height = (isRotated ? imgDims.width : imgDims.height) * scale;
        return { width: `${width}px`, height: `${height}px` };
    };

    const currentPalette = activeTool === TOOL_TYPES.HIGHLIGHT ? HIGHLIGHT_COLORS : PEN_COLORS;

    return (
        <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col animate-in fade-in duration-200">
            {/* Toolbar */}
            <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X size={20} /></button>
                    <h2 className="font-semibold text-slate-700">Page {page?.originalIndex + 1}</h2>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                    <ToolButton active={activeTool === TOOL_TYPES.SELECT} onClick={() => setActiveTool(TOOL_TYPES.SELECT)} icon={<MousePointer2 size={18} />} label="Select" />
                    <ToolButton active={activeTool === TOOL_TYPES.TEXT} onClick={() => setActiveTool(TOOL_TYPES.TEXT)} icon={<Type size={18} />} label="Text" />
                    <ToolButton active={activeTool === TOOL_TYPES.PEN} onClick={() => setActiveTool(TOOL_TYPES.PEN)} icon={<Pen size={18} />} label="Draw" />
                    <ToolButton active={activeTool === TOOL_TYPES.HIGHLIGHT} onClick={() => setActiveTool(TOOL_TYPES.HIGHLIGHT)} icon={<Highlighter size={18} />} label="Highlight" />
                    <ToolButton active={activeTool === TOOL_TYPES.ERASE} onClick={() => setActiveTool(TOOL_TYPES.ERASE)} icon={<Eraser size={18} />} label="Erase" />
                    <ToolButton active={activeTool === TOOL_TYPES.IMAGE} onClick={() => fileInputRef.current.click()} icon={<ImageIcon size={18} />} label="Image" />

                    <div className="w-px h-6 bg-slate-200 mx-1" />
                    <div className="flex gap-1 px-2">
                        {Object.values(currentPalette).map(c => (
                            <button
                                key={c}
                                onClick={() => setActiveColor(c)}
                                className={`w-5 h-5 rounded-full border border-slate-300 ${activeColor === c ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                                style={{ backgroundColor: c }}
                                title={c}
                            />
                        ))}
                    </div>

                    <div className="w-px h-6 bg-slate-200 mx-1" />
                    <div className="flex items-center gap-1">
                        <button onClick={handleUndo} disabled={historyIndex <= 0} className={`p-2 rounded hover:bg-slate-100 ${historyIndex <= 0 ? 'text-slate-300' : 'text-slate-600'}`}><Undo size={18} /></button>
                        <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={`p-2 rounded hover:bg-slate-100 ${historyIndex >= history.length - 1 ? 'text-slate-300' : 'text-slate-600'}`}><Redo size={18} /></button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md">
                        <button onClick={handleZoomOut}><ZoomOut size={16} /></button>
                        <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                        <button onClick={handleZoomIn}><ZoomIn size={16} /></button>
                    </div>
                    <button onClick={() => onSaveAnnotations(page.id, annotations)} className="px-4 py-2 bg-zinc-800 text-white rounded-md text-sm font-medium hover:bg-zinc-900 flex items-center gap-2">
                        <Save size={16} /> Save Page
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Thumbnails */}
                {/* ... existing thumbnail code ... */}
                <div className="w-64 bg-white border-r border-slate-200 flex flex-col z-10 box-border">
                    <div className="p-4 border-b border-slate-100 font-medium text-sm text-slate-500 bg-slate-50/50">Pages ({allPages.length})</div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
                        {allPages.map(p => (
                            <Thumbnail key={p.id} file={file} page={p} isActive={p.id === page.id} onClick={() => onPageChange && onPageChange(p)} />
                        ))}
                    </div>
                </div>

                {/* Main Workspace */}
                <div className="flex-1 bg-slate-200/50 overflow-auto flex p-8 relative">
                    {previewUrl ? (
                        <div
                            ref={containerRef}
                            className={`relative shadow-xl bg-white transition-none ease-out border border-slate-200 origin-center m-auto flex-shrink-0 select-none ${activeTool === TOOL_TYPES.PEN || activeTool === TOOL_TYPES.HIGHLIGHT ? 'cursor-crosshair' :
                                    activeTool === TOOL_TYPES.TEXT ? 'cursor-text' :
                                        activeTool === TOOL_TYPES.ERASE ? 'cursor-[url(https://api.iconify.design/lucide:eraser.svg?height=24&width=24),_pointer]' :
                                            activeTool === TOOL_TYPES.IMAGE ? 'cursor-copy' :
                                                'cursor-default'
                                }`}
                            style={{
                                ...getContainerStyle(),
                                cursor: activeTool === TOOL_TYPES.PEN ? 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTcgM2w0IDQgLTUgNSAtNCAtNG0tMTEgMTFsNiA2IC0yIDIgLTcgMCAwIC03IDIgLTJtMyAwIGw0IDQiLz48L3N2Zz4=") 0 24, crosshair' :
                                    activeTool === TOOL_TYPES.HIGHLIGHT ? 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmYWNjMTUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNOSAxMXY1bDMgMyA0LTR2LTVsLTctN20tMiAwbC0yIDJtMTIgMGwKLTIgMnY1bDggOCAwLTMiLz48L3N2Zz4=") 0 24, crosshair' : undefined
                            }}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                            onClick={handleCanvasClick}
                        >
                            <img
                                src={previewUrl}
                                onLoad={(e) => setImgDims({ width: e.target.naturalWidth, height: e.target.naturalHeight })}
                                className="absolute top-1/2 left-1/2 max-w-none pointer-events-none origin-center"
                                style={{ transform: `translate(-50%, -50%) rotate(${page.rotation}deg) scale(${scale})` }}
                                alt=""
                            />

                            {/* Highlights Layer - Separated to prevent overlap darkening */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5, mixBlendMode: 'multiply', opacity: 0.5 }}>
                                {annotations.filter(a => a.type === 'path' && a.tool === TOOL_TYPES.HIGHLIGHT).map((a, i) => (
                                    <path
                                        key={i}
                                        d={`M ${a.points.map(p => `${p.x * scale} ${p.y * scale}`).join(' L ')}`}
                                        stroke={a.color}
                                        strokeWidth={a.width * scale}
                                        fill="none"
                                        strokeLinecap="butt"
                                        strokeLinejoin="round"
                                        strokeOpacity={1}
                                    />
                                ))}
                                {currentPath && currentPath.tool === TOOL_TYPES.HIGHLIGHT && (
                                    <path
                                        d={`M ${currentPath.points.map(p => `${p.x * scale} ${p.y * scale}`).join(' L ')}`}
                                        stroke={currentPath.color}
                                        strokeWidth={currentPath.width * scale}
                                        fill="none"
                                        strokeLinecap="butt"
                                        strokeLinejoin="round"
                                        strokeOpacity={1}
                                    />
                                )}
                            </svg>

                            {/* Pen / Standard Layer */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
                                {annotations.filter(a => a.type === 'path' && a.tool !== TOOL_TYPES.HIGHLIGHT).map((a, i) => (
                                    <path
                                        key={i}
                                        d={`M ${a.points.map(p => `${p.x * scale} ${p.y * scale}`).join(' L ')}`}
                                        stroke={a.color}
                                        strokeWidth={a.width * scale}
                                        fill="none"
                                        // Standard pens use round caps
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        opacity={a.opacity}
                                    />
                                ))}
                                {currentPath && currentPath.tool !== TOOL_TYPES.HIGHLIGHT && (
                                    <path
                                        d={`M ${currentPath.points.map(p => `${p.x * scale} ${p.y * scale}`).join(' L ')}`}
                                        stroke={currentPath.color}
                                        strokeWidth={currentPath.width * scale}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        opacity={currentPath.opacity}
                                    />
                                )}
                            </svg>

                            <div className="absolute inset-0 w-full h-full" style={{ zIndex: 20 }}>
                                {annotations.map((a, i) => {
                                    if (a.type === 'text') {
                                        return (
                                            <div
                                                key={i}
                                                className="absolute group whitespace-nowrap cursor-move"
                                                style={{ left: a.x * scale, top: a.y * scale, color: a.color, fontSize: a.size * scale, lineHeight: 1 }}
                                                onClick={() => { if (activeTool === TOOL_TYPES.SELECT) { itemClickedRef.current = true; } }}
                                            >
                                                {a.text}
                                                {activeTool === TOOL_TYPES.SELECT && (
                                                    <button onClick={(e) => { e.stopPropagation(); deleteAnnotation(i); }} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-0.5 hidden group-hover:block"><X size={8} /></button>
                                                )}
                                            </div>
                                        );
                                    }
                                    if (a.type === 'image') {
                                        return (
                                            <div
                                                key={i}
                                                className="absolute group cursor-move border border-transparent hover:border-blue-400"
                                                style={{ left: a.x * scale, top: a.y * scale, width: a.width * scale, height: a.height * scale }}
                                                onClick={() => { if (activeTool === TOOL_TYPES.SELECT) { itemClickedRef.current = true; } }}
                                            >
                                                <img src={a.dataUrl} className="w-full h-full object-contain pointer-events-none" alt="" />
                                                {activeTool === TOOL_TYPES.SELECT && (
                                                    <button onClick={(e) => { e.stopPropagation(); deleteAnnotation(i); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hidden group-hover:block"><X size={10} /></button>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                })}

                                {textInput && (
                                    <textarea
                                        autoFocus
                                        className="absolute bg-transparent border border-blue-400 outline-none p-0 resize-none overflow-hidden"
                                        style={{
                                            left: textInput.x * scale,
                                            top: textInput.y * scale,
                                            fontSize: textInput.fontSize * scale,
                                            color: textInput.color,
                                            minWidth: '100px',
                                            height: 'auto'
                                        }}
                                        value={textInput.value}
                                        onChange={(e) => setTextInput(prev => ({ ...prev, value: e.target.value }))}
                                        onBlur={handleTextComplete}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.ctrlKey) {
                                                handleTextComplete();
                                            } else if (e.key === 'Escape') {
                                                setTextInput(null);
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center w-full h-full text-slate-400">Loading...</div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ... ToolButton Component (unchanged) ...
const ToolButton = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`p-2 rounded-md transition-all flex flex-col items-center gap-1 min-w-[3.5rem] ${active ? 'bg-red-50 text-red-600 shadow-sm ring-1 ring-red-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
        title={label}
    >
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
    </button>
);

export default PageEditor;
