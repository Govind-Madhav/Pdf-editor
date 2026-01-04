import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Shield, Image as ImageIcon, Gauge, Check, AlertCircle, Info } from 'lucide-react';
import PreviewPane from './PreviewPane';
import {
    INIT_SESSION,
    ANALYZE_PDF,
    RENDER_PREVIEW,
    RENDER_ORIGINAL,
    START_COMPRESSION,
    CANCEL,
    ANALYSIS_COMPLETE,
    PREVIEW_READY,
    ORIGINAL_READY,
    COMPRESSION_COMPLETE,
    PROGRESS_UPDATE,
    SESSION_INITIALIZED
} from '../utils/pdf/worker/commands';
import { calculateCompressionParams } from '../utils/pdf/targetEngine';
import { renderPageToImage } from '../utils/pdf-render';

const CompressModal = ({ file, onClose, onCompress }) => {
    const [isSessionInit, setIsSessionInit] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');
    const [targetReduction, setTargetReduction] = useState(50);
    const [qualityFloor, setQualityFloor] = useState('balanced');
    const [analysis, setAnalysis] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [previewBitmap, setPreviewBitmap] = useState(null);
    const [originalBitmap, setOriginalBitmap] = useState(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [params, setParams] = useState(null);
    const [isCompressing, setIsCompressing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');

    const workerRef = useRef(null);
    const debounceTimerRef = useRef(null);

    // Initialize Worker and Session
    useEffect(() => {
        workerRef.current = new Worker(
            new URL('../utils/pdf/worker/pdfWorker.js', import.meta.url),
            { type: 'module' }
        );

        workerRef.current.onmessage = (e) => {
            const { type, result, progress: p, status, error } = e.data;

            switch (type) {
                case SESSION_INITIALIZED:
                    setIsSessionInit(true);
                    setIsAnalyzing(true);
                    workerRef.current.postMessage({ type: ANALYZE_PDF, id: 'analyze' });
                    break;

                case ANALYSIS_COMPLETE:
                    setAnalysis(result);
                    setIsAnalyzing(false);
                    break;

                case PREVIEW_READY:
                    setPreviewBitmap(result);
                    setIsPreviewing(false);
                    break;

                case ORIGINAL_READY:
                    setOriginalBitmap(result);
                    break;

                case PROGRESS_UPDATE:
                    setProgress(p);
                    if (status) setStatusText(status);
                    break;

                case COMPRESSION_COMPLETE:
                    onCompress(result, params);
                    setIsCompressing(false);
                    break;

                case 'CANCELLED':
                    setIsCompressing(false);
                    setStatusText('Cancelled');
                    break;

                case 'ERROR':
                    console.error("Worker Error:", error);
                    setIsAnalyzing(false);
                    setIsPreviewing(false);
                    setIsCompressing(false);
                    break;
            }
        };

        // Start Session
        workerRef.current.postMessage({ type: INIT_SESSION, payload: { file }, id: 'init' });

        return () => workerRef.current.terminate();
    }, [file]);

    // Handle parameter calculation and preview trigger
    useEffect(() => {
        if (!analysis || !isSessionInit) return;

        const newParams = calculateCompressionParams(analysis, targetReduction, qualityFloor);
        setParams({ ...newParams, targetReduction });

        // Update Original Preview via Worker
        if (!originalBitmap) {
            workerRef.current.postMessage({
                type: RENDER_ORIGINAL,
                payload: { pageNum: analysis.samplePages.mixed || 1 },
                id: 'original'
            });
        }

        // Debounce preview rendering
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setIsPreviewing(true);
            workerRef.current.postMessage({
                type: RENDER_PREVIEW,
                payload: { pageNum: analysis.samplePages.mixed || 1, params: newParams },
                id: 'preview'
            });
        }, 250); // Faster debounce now that we transfer bitmaps

    }, [analysis, isSessionInit, targetReduction, qualityFloor, file]);

    const handleStartCompression = () => {
        setIsCompressing(true);
        setProgress(0);
        setStatusText('Starting...');
        workerRef.current.postMessage({
            type: START_COMPRESSION,
            payload: { params },
            id: 'compress'
        });
    };

    const handleCancel = () => {
        if (isCompressing) {
            workerRef.current.postMessage({ type: CANCEL });
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-slate-900 w-full max-w-6xl h-[85vh] rounded-3xl border border-white/10 shadow-2xl flex flex-col md:flex-row overflow-hidden"
            >
                <div className="w-full md:w-[400px] border-r border-white/5 flex flex-col bg-slate-900">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Zap className="text-indigo-400" size={20} />
                            Intelligent Compression
                        </h2>
                        <button onClick={handleCancel} className="p-2 hover:bg-white/5 rounded-full text-slate-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                        {!isSessionInit || isAnalyzing ? (
                            <div className="space-y-4">
                                <div className="h-4 w-3/4 bg-slate-800 rounded-full animate-pulse" />
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="h-16 bg-slate-800 rounded-2xl animate-pulse" />
                                    <div className="h-16 bg-slate-800 rounded-2xl animate-pulse" />
                                </div>
                                <p className="text-xs text-slate-500 italic mt-8">
                                    {!isSessionInit ? "Parking PDF into memory..." : "Analyzing structure & DPI..."}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col">
                                        <span className="text-[10px] text-slate-500 uppercase font-bold mb-1">Image Ratio</span>
                                        <span className="text-lg font-mono text-white">{Math.round(analysis.imageRatio * 100)}%</span>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col">
                                        <span className="text-[10px] text-slate-500 uppercase font-bold mb-1">Page Count</span>
                                        <span className="text-lg font-mono text-white">{analysis.pageCount}</span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Reduction</label>
                                        <span className="text-2xl font-black text-indigo-400">{targetReduction}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10" max="90" step="1"
                                        value={targetReduction}
                                        onChange={(e) => setTargetReduction(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                    <div className="flex justify-between mt-2 px-1">
                                        <span className="text-[10px] text-slate-600 font-bold">FASTER</span>
                                        <span className="text-[10px] text-slate-600 font-bold">SMALLER</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quality Floor</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[
                                            { id: 'lossless', label: 'Preserve Text', icon: Shield, desc: 'Lossless structural optimization' },
                                            { id: 'balanced', label: 'Balanced', icon: Gauge, desc: 'Optimized DPI, searchable text' },
                                            { id: 'aggressive', label: 'Aggressive', icon: ImageIcon, desc: 'Max compression, rasterized' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                disabled={isCompressing}
                                                onClick={() => setQualityFloor(opt.id)}
                                                className={`p-3 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3 ${qualityFloor === opt.id
                                                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-200 shadow-lg shadow-indigo-500/5'
                                                    : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10 hover:bg-white/[0.07]'
                                                    }`}
                                            >
                                                <div className={`p-2 rounded-xl ${qualityFloor === opt.id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                    <opt.icon size={16} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold flex items-center gap-2">
                                                        {opt.label}
                                                        {qualityFloor === opt.id && <Check size={12} />}
                                                    </div>
                                                    <div className="text-[10px] opacity-60">{opt.desc}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/20 space-y-2">
                                    <div className="flex items-center gap-2 text-indigo-300 text-[10px] font-bold uppercase">
                                        <Info size={14} />
                                        Predicted Result
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xl font-bold text-white">~{(analysis.fileSize * (1 - targetReduction / 100 * 0.7) / 1024 / 1024).toFixed(2)} MB</span>
                                        <span className="text-xs text-slate-500 line-through">{(analysis.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="p-6 border-t border-white/5">
                        {isCompressing ? (
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                                    <span className="text-indigo-400 animate-pulse">{statusText || 'Compressing...'}</span>
                                    <span className="text-slate-500">{Math.round(progress * 100)}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress * 100}%` }}
                                    />
                                </div>
                                <button onClick={handleCancel} className="w-full py-2 text-xs text-slate-500 hover:text-red-400 font-bold transition-colors">
                                    CANCEL TASK
                                </button>
                            </div>
                        ) : (
                            <button
                                disabled={!isSessionInit || isAnalyzing}
                                onClick={handleStartCompression}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                            >
                                {!isSessionInit ? "Warming up..." : isAnalyzing ? "Analyzing..." : "Start Compression"}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 bg-slate-950 p-6 md:p-8 flex flex-col h-full">
                    <PreviewPane
                        originalBitmap={originalBitmap}
                        compressedBitmap={previewBitmap}
                        isProcessing={isPreviewing}
                        analysis={analysis}
                        params={params}
                    />
                </div>
            </motion.div>
        </div>
    );
};

export default CompressModal;
