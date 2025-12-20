import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import PageCard from './PageCard';
import PageEditor from './PageEditor';

const FileEditor = ({ file, pages, onSave, onCancel }) => {
    const [items, setItems] = useState(pages);
    const [activePageId, setActivePageId] = useState(null);
    const [pageAnnotations, setPageAnnotations] = useState({});

    // 1. Sync State with Props (Hardening)
    useEffect(() => {
        setItems(pages);
    }, [pages]);

    // 2. Constrain Drag Sensors (Hardening)
    // Distance constraint prevents accidental drags when trying to clear a selection or click
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const activePage = activePageId ? items.find(p => p.id === activePageId) : null;

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active && over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleRotate = (id) => {
        setItems(prev => prev.map(p =>
            p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p
        ));
    };

    const handleRemove = (id) => {
        // 3. Confirm Destructive Action (Hardening)
        if (window.confirm("Are you sure you want to remove this page? This cannot be undone.")) {
            // 4. Cleanup Annotations (Hardening)
            // Memory leak fix: ensure we don't hold onto annotations for deleted pages
            setPageAnnotations(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            setItems(prev => prev.filter(p => p.id !== id));
            // Prevent stale state if the removed page was active (though logic usually prevents this while active)
            if (activePageId === id) setActivePageId(null);
        }
    };

    const handleSave = () => {
        // 5. Explicit Save Contract (Hardening)
        // Pass a standardized object structure rather than positional arguments
        onSave({
            pages: items,
            annotations: pageAnnotations
        });
    };

    const handleSaveAnnotations = (pageId, annotations) => {
        setPageAnnotations(prev => ({
            ...prev,
            [pageId]: annotations
        }));
    };

    return (
        <div className="flex flex-col h-full bg-zinc-100">
            {/* Toolbar Area */}
            <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-zinc-200 shadow-sm flex-shrink-0 z-20">
                <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-slate-800">Organize PDF</h2>
                    <p className="text-slate-500 text-sm mt-0.5">Drag to move. Click to edit/annotate.</p>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={items.length === 0}
                        className={`px-8 py-2.5 rounded-lg font-bold shadow-lg transition-all text-lg ${items.length === 0 ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed shadow-none' : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20 hover:scale-105 active:scale-95'}`}
                    >
                        Merge PDF
                    </button>
                </div>
            </div>

            {/* Main Grid Area */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">
                <div className="max-w-[1400px] mx-auto">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pb-20">
                                {items.map(page => (
                                    <div key={page.id} onKeyDown={(e) => { if (e.key === 'Enter') setActivePageId(page.id); }} tabIndex={0} className="outline-none ring-offset-2 focus:ring-2 ring-blue-500 rounded-md">
                                        <PageCard
                                            id={page.id}
                                            file={file}
                                            originalIndex={page.originalIndex}
                                            rotation={page.rotation}
                                            onRotate={() => handleRotate(page.id)}
                                            onRemove={() => handleRemove(page.id)}
                                            onClick={() => setActivePageId(page.id)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {items.length === 0 && (
                        <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 rounded-2xl bg-white/50">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <span className="text-3xl">📄</span>
                            </div>
                            <p className="text-lg font-medium text-slate-600">All pages removed</p>
                            <p className="text-sm mt-1">Add the file again to restore pages</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Full Screen Page Editor Overlay */}
            {activePage && (
                <PageEditor
                    page={activePage}
                    file={file}
                    allPages={items}
                    initialAnnotations={pageAnnotations[activePage.id] || []}
                    onClose={() => setActivePageId(null)}
                    onSaveAnnotations={handleSaveAnnotations}
                    onPageChange={(p) => setActivePageId(p.id)}
                />
            )}
        </div>
    );
};

export default FileEditor;
