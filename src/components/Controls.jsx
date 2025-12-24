import React from 'react';
import { Zap, Loader2, Trash, Scissors } from 'lucide-react';
import { clsx } from 'clsx';

export default function Controls({ count, onClear, onMerge, onSplitAll, isMerging }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-800/50 backdrop-blur-md p-4 rounded-2xl border border-white/5"
        >
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                <span className="text-slate-400 font-medium">{count} file{count !== 1 && 's'} selected</span>
                <button
                    onClick={onClear}
                    className="text-slate-500 hover:text-red-400 text-sm font-medium flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-400/10"
                >
                    <Trash size={16} /> Clear All
                </button>
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
                <button
                    onClick={onSplitAll}
                    disabled={isMerging || count < 1}
                    className={clsx(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-200 border border-white/10 hover:bg-white/5 transition-all",
                        (isMerging || count < 1) && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <Scissors size={20} className="text-violet-400" />
                    <span>Split All</span>
                </button>

                <button
                    onClick={onMerge}
                    disabled={isMerging || count < 1}
                    className={clsx(
                        "flex-1 sm:flex-none w-full sm:w-auto relative group overflow-hidden px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all duration-300",
                        isMerging || count < 1
                            ? "bg-slate-700 cursor-not-allowed opacity-50"
                            : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.02] hover:shadow-indigo-500/25"
                    )}
                >
                    <div className="relative flex items-center justify-center gap-2 z-10">
                        {isMerging ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <Zap size={20} className={clsx(!isMerging && "group-hover:fill-current")} />
                                <span>{count > 1 ? `Merge ${count} PDFs` : 'Save PDF'}</span>
                            </>
                        )}
                    </div>
                    {!isMerging && count >= 1 && (
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    )}
                </button>
            </div>
        </motion.div>
    );
}

import { motion } from 'framer-motion';
