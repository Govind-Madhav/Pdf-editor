import React, { useState } from 'react';
import Header from './components/Header';
import DropZone from './components/DropZone';
import FileList from './components/FileList';
import Controls from './components/Controls';
import Modal from './components/Modal';
import FileEditor from './components/FileEditor';
import { mergePDFs, downloadPDF } from './utils/pdf';
import { getPdfPageCount } from './utils/pdf-render';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [files, setFiles] = useState([]);
  const [isMerging, setIsMerging] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [editingFileId, setEditingFileId] = useState(null);

  const handleFilesAdded = async (newFiles) => {
    if (newFiles.length === 0) return;

    // Create placeholders immediately for UI feedback if needed, 
    // but parsing is usually fast enough for local files.
    // We'll process them and then add to state.

    const newFileItems = [];

    // Process sequentially or parallel? Parallel is fine.
    await Promise.all(newFiles.map(async (file) => {
      const id = crypto.randomUUID();
      let numPages = 0;
      try {
        numPages = await getPdfPageCount(file);
      } catch (error) {
        console.error("Failed to count pages", error);
      }

      const pages = Array.from({ length: numPages }, (_, i) => ({
        id: `${id}-${i}`,
        originalIndex: i,
        rotation: 0
      }));

      newFileItems.push({ id, file, pages });
    }));

    setFiles(prev => [...prev, ...newFileItems]);
    setStatus({ type: 'success', message: `${newFiles.length} file(s) added successfully` });
    setTimeout(() => setStatus({ type: '', message: '' }), 3000);
  };

  const handleRemove = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleClear = () => {
    setFiles([]);
    setStatus({ type: '', message: '' });
  };

  const handleEdit = (id) => {
    setEditingFileId(id);
  };

  const handleSaveEdit = (updatedPages, annotations = {}) => {
    // Note: annotations handling should be merged here too if we want to persist them
    // For now, we update the pages order/rotation
    // If we want to persist annotations, we need to add them to the file state structure

    // We update the specific pages for the file
    setFiles(prev => prev.map(f => {
      if (f.id === editingFileId) {
        return {
          ...f,
          pages: updatedPages,
          // store annotations map in the file object
          annotations: { ...(f.annotations || {}), ...annotations }
        };
      }
      return f;
    }));

    setEditingFileId(null);
  };

  const handleMerge = async () => {
    if (files.length < 1) return; // Allow 1 file if they just want to modify pages

    setIsMerging(true);
    setStatus({ type: 'info', message: 'Merging PDFs... Please wait.' });

    try {
      // Small timeout to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 100));

      const mergedBytes = await mergePDFs(files);
      downloadPDF(mergedBytes, `infinity-merged-${Date.now()}.pdf`);

      setStatus({ type: 'success', message: 'PDFs merged successfully!' });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Failed to merge PDFs. Please try again.' });
    } finally {
      setIsMerging(false);
      setTimeout(() => setStatus({ type: '', message: '' }), 5000);
    }
  };

  const editingFile = files.find(f => f.id === editingFileId);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-8">
        <Header />

        <main className="space-y-6">
          <DropZone onFilesAdded={handleFilesAdded} />

          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6 overflow-hidden"
              >
                <Controls
                  count={files.length}
                  onClear={handleClear}
                  onMerge={handleMerge}
                  isMerging={isMerging}
                />

                <FileList files={files} onRemove={handleRemove} onEdit={handleEdit} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status Message Toast */}
          <AnimatePresence>
            {status.message && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white font-medium shadow-lg backdrop-blur-md border z-40 whitespace-nowrap ${status.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-100' :
                  status.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-100' :
                    'bg-indigo-500/20 border-indigo-500/50 text-indigo-100'
                  }`}
              >
                {status.message}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="text-center text-slate-500 text-sm mt-12 py-4">
          <p>&copy; {new Date().getFullYear()} Infinity Merge. Secure client-side processing.</p>
        </footer>
      </div>

      {/* Full Screen Editor Integration */}
      <AnimatePresence>
        {editingFileId && editingFile && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 20 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="fixed inset-0 z-50 bg-zinc-100 overflow-hidden"
          >
            <FileEditor
              file={editingFile.file}
              pages={editingFile.pages}
              onSave={handleSaveEdit}
              onCancel={() => setEditingFileId(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
