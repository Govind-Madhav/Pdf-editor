import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const PreviewPane = ({ originalUrl, compressedBitmap, isProcessing, analysis, params }) => {
    const [zoom, setZoom] = useState(1);
    const canvasRef = useRef(null);

    useEffect(() => {
        if (compressedBitmap && canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = compressedBitmap.width;
            canvas.height = compressedBitmap.height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(compressedBitmap, 0, 0);
        }
    }, [compressedBitmap]);

    if (!originalUrl && !isProcessing) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900/20 rounded-2xl border-2 border-dashed border-slate-800">
                <Maximize2 className="w-12 h-12 mb-4 opacity-20" />
                <p>Adjust settings to generate a real-time preview</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Visual Fidelity</span>
                    {params && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold border border-indigo-500/30">
                            {params.dpi} DPI / {Math.round(params.jpegQuality * 100)}% Quality
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
                    >
                        <ZoomOut size={16} />
                    </button>
                    <span className="text-xs font-mono text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <button
                        onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
                    >
                        <ZoomIn size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 custom-scrollbar relative">
                {isProcessing && (
                    <div className="absolute inset-0 z-10 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center transition-all">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                            <span className="text-xs text-indigo-300 font-medium">Predicting output...</span>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 h-fit transition-transform duration-200" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                    <div className="space-y-2">
                        <div className="text-[10px] uppercase font-bold text-slate-500 px-1">Original Content</div>
                        <div className="bg-white rounded-lg overflow-hidden shadow-2xl border border-white/10">
                            {originalUrl ? <img src={originalUrl} className="w-full h-auto" alt="Original" /> : <div className="aspect-[3/4] bg-slate-800 animate-pulse" />}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="text-[10px] uppercase font-bold text-indigo-500 px-1">Compressed Result</div>
                        <div className="bg-white rounded-lg overflow-hidden shadow-2xl border border-indigo-500/30">
                            <canvas ref={canvasRef} className="w-full h-auto" />
                            {!compressedBitmap && !isProcessing && <div className="aspect-[3/4] bg-slate-800 animate-pulse" />}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-3 bg-white/5 border-t border-white/5 mt-auto">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Reduction Target</span>
                            <span className="text-sm font-mono text-green-400">{params?.targetReduction || 0}%</span>
                        </div>
                        <div className="h-6 w-px bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Strategy</span>
                            <span className="text-sm font-medium text-slate-300 uppercase letter-spacing-1">{params?.strategy || 'Analyzing'}</span>
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-500 max-w-[120px] text-right">
                        Searchability: <span className={params?.strategy === 'hybrid' || params?.strategy === 'lossless' ? 'text-green-400' : 'text-amber-400'}>
                            {params?.strategy === 'hybrid' || params?.strategy === 'lossless' ? 'Preserved' : 'Reduced'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreviewPane;
