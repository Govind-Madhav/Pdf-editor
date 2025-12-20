import React from 'react';
import { FileText, Trash2, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FileList({ files, onRemove, onEdit }) {
    return (
        <div className="w-full bg-slate-800/30 backdrop-blur-md rounded-2xl border border-white/5 p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
            <ul className="space-y-2">
                <AnimatePresence mode='popLayout'>
                    {files.map((item) => (
                        <motion.li
                            key={item.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                            className="flex items-center justify-between p-3 bg-slate-800/80 rounded-xl border border-white/5 group hover:border-violet-500/30 transition-colors"
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400">
                                    <FileText size={20} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="truncate font-medium text-slate-200 text-sm md:text-base">{item.file.name}</span>
                                    <span className="text-xs text-slate-500">
                                        {(item.file.size / 1024 / 1024).toFixed(2)} MB • {item.pages ? item.pages.length : 0} pages
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onEdit(item.id)}
                                    className="p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                                    title="Modify pages"
                                >
                                    <Settings2 size={18} />
                                </button>
                                <button
                                    onClick={() => onRemove(item.id)}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                    title="Remove file"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>
        </div>
    );
}
