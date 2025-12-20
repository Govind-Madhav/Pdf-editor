import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RotateCw, Trash2, GripVertical } from 'lucide-react';
import { renderPageToImage } from '../utils/pdf-render';

const PageCard = ({ id, file, originalIndex, rotation, onRotate, onRemove, onClick }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const [imageDims, setImageDims] = useState(null);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1
    };

    useEffect(() => {
        let active = true;
        renderPageToImage(file, originalIndex).then(url => {
            if (active && url) setImageUrl(url);
        });
        return () => { active = false; };
    }, [file, originalIndex]);

    const handleImageLoad = (e) => {
        setImageDims({
            width: e.target.naturalWidth,
            height: e.target.naturalHeight
        });
    };

    const getScale = () => {
        if (!imageDims || rotation % 180 === 0) return 1;
        const { width, height } = imageDims;
        if (width === height) return 1;
        return Math.min(width / height, height / width);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="group relative flex flex-col items-center justify-center p-3 touch-none"
        >
            {/* Paper Shadow Container */}
            <div
                className="relative bg-white shadow-sm hover:shadow-xl transition-all duration-300 w-full aspect-[1/1.4] flex items-center justify-center overflow-hidden cursor-pointer rounded-sm border border-transparent hover:border-red-400/50"
                onClick={onClick}
            >
                {/* Checkered background pattern for transparency indication */}
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
                    backgroundSize: '10px 10px'
                }} />

                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={`Page ${originalIndex + 1}`}
                        onLoad={handleImageLoad}
                        className="relative z-0 max-w-full max-h-full object-contain transition-transform duration-300 origin-center select-none"
                        style={{
                            transform: `rotate(${rotation}deg) scale(${getScale()})`
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin" />
                    </div>
                )}

                {/* Overlay only appears on hover */}
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-4 pointer-events-none z-10 backdrop-blur-[2px]">
                    {/* Circular Buttons */}
                    <div className="flex items-center gap-4 pointer-events-auto scale-90 group-hover:scale-100 transition-transform duration-200">
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onRotate(e); }}
                            className="bg-white text-slate-700 hover:text-red-600 hover:bg-red-50 p-3 rounded-full shadow-lg transition-colors border border-slate-100"
                            title="Rotate"
                        >
                            <RotateCw size={20} className="stroke-[2.5]" />
                        </button>
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onRemove(e); }}
                            className="bg-white text-slate-700 hover:text-red-600 hover:bg-red-50 p-3 rounded-full shadow-lg transition-colors border border-slate-100"
                            title="Remove"
                        >
                            <Trash2 size={20} className="stroke-[2.5]" />
                        </button>
                    </div>
                </div>

                {/* Drag Handle overlaid on top-left of the image area itself */}
                <div {...attributes} {...listeners} className="absolute top-2 left-2 z-20 cursor-grab active:cursor-grabbing p-2 text-white hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                    <GripVertical size={20} className="drop-shadow-md" />
                </div>
            </div>

            {/* Page Number Label Below */}
            <div className="mt-2 text-sm font-medium text-slate-500 group-hover:text-red-600 transition-colors select-none">
                Page {originalIndex + 1}
            </div>
        </div>
    );
};

export default PageCard;
