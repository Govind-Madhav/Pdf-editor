import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Scissors } from 'lucide-react';

export default function SplitModal({ file, onClose, onSplit, isBulk }) {
    const [interval, setInterval] = useState(2);
    const [error, setError] = useState('');

    const totalPages = isBulk ? 0 : (file?.pages?.length || 0);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!interval || interval < 1) {
            setError('Please enter a valid number greater than 0');
            return;
        }
        if (!isBulk && interval >= totalPages) {
            setError(`Split interval must be less than total pages (${totalPages})`);
            return;
        }
        onSplit(parseInt(interval));
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-xl overflow-hidden"
            >
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-800/50">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Scissors className="text-violet-400" size={20} />
                        Split PDF
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                        {isBulk ? (
                            <>
                                <p className="text-sm text-slate-400 mb-1">Bulk Action</p>
                                <p className="text-slate-200 font-medium truncate">Splitting all files</p>
                                <p className="text-xs text-slate-500 mt-1">Files smaller than the interval will be skipped/preserved.</p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-slate-400 mb-1">Target File</p>
                                <p className="text-slate-200 font-medium truncate">{file?.file?.name}</p>
                                <p className="text-xs text-slate-500 mt-1">{totalPages} pages total</p>
                            </>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Split every X pages
                            </label>
                            <input
                                type="number"
                                min="1"
                                max={isBulk ? undefined : (totalPages - 1)}
                                value={interval}
                                onChange={(e) => {
                                    setInterval(Number(e.target.value));
                                    setError('');
                                }}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                                placeholder="e.g. 10"
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                Example: If you enter 10, the PDF will be split into chunks of 10 pages each.
                            </p>
                        </div>

                        {error && (
                            <p className="text-red-400 text-sm bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                {error}
                            </p>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-violet-500/20"
                            >
                                Split PDF
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
