import React, { useCallback } from 'react';
import { CloudUpload } from 'lucide-react';
import { clsx } from 'clsx';

export default function DropZone({ onFilesAdded }) {
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
            onFilesAdded(files);
            e.currentTarget.classList.remove('border-indigo-500', 'bg-slate-800/80');
        }
    }, [onFilesAdded]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('border-indigo-500', 'bg-slate-800/80');
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('border-indigo-500', 'bg-slate-800/80');
    }, []);

    const handleBrowse = () => {
        document.getElementById('file-input').click();
    };

    const handleInputChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
            onFilesAdded(files);
            e.target.value = null; // Reset
        }
    };

    return (
        <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleBrowse}
            className={clsx(
                "cursor-pointer group relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-700/50 bg-slate-800/30 p-12 text-center transition-all duration-300 backdrop-blur-sm hover:border-indigo-500 hover:bg-slate-800/50 hover:shadow-2xl hover:shadow-indigo-500/10",
            )}
        >
            <input
                type="file"
                id="file-input"
                multiple
                accept="application/pdf"
                className="hidden"
                onChange={handleInputChange}
            />
            <div className="flex flex-col items-center justify-center gap-4">
                <div className="relative">
                    <div className="absolute -inset-4 rounded-full bg-indigo-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <CloudUpload className="relative w-16 h-16 text-indigo-400 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-slate-200 mb-1">Drag & Drop PDFs here</h3>
                    <p className="text-slate-400">
                        or <span className="text-indigo-400 font-medium underline decoration-2 underline-offset-2 hover:text-indigo-300">browse files</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
