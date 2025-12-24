import React, { useState, useRef } from 'react';
import Header from './components/Header';
import DropZone from './components/DropZone';
import FileList from './components/FileList';
import Controls from './components/Controls';
import Modal from './components/Modal';
import FileEditor from './components/FileEditor';
import SplitModal from './components/SplitModal';
import { mergePDFs, downloadPDF, splitPDF, bulkSplitPDF } from './utils/pdf';
import { getPdfPageCount } from './utils/pdf-render';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [files, setFiles] = useState([]);
  const [isMerging, setIsMerging] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [editingFileId, setEditingFileId] = useState(null);
  const [splittingFileId, setSplittingFileId] = useState(null);
  const [isBulkSplit, setIsBulkSplit] = useState(false);

  const statusTimeoutRef = useRef(null);

  const clearStatusLater = (ms = 3000) => {
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = setTimeout(() => {
      setStatus({ type: '', message: '' });
    }, ms);
  };

  const handleFilesAdded = async (newFiles) => {
    if (newFiles.length === 0) return;

    const processedFiles = await Promise.all(newFiles.map(async (file) => {
      const id = crypto.randomUUID();
      let numPages = 0;
      try {
        numPages = await getPdfPageCount(file);
      } catch (error) {
        console.error("Failed to count pages", error);
        return null;
      }

      if (!numPages || numPages === 0) return null;

      if (file.size > 100 * 1024 * 1024) {
        setStatus({ type: 'info', message: `Large file detected (${(file.size / 1024 / 1024).toFixed(0)}MB). Processing may be slow.` });
        clearStatusLater(6000);
      }

      return {
        id,
        file,
        pages: Array.from({ length: numPages }, (_, i) => ({
          id: `${id}-${i}`,
          originalIndex: i,
          rotation: 0
        }))
      };
    }));

    const validFiles = processedFiles.filter(Boolean);

    if (validFiles.length < newFiles.length) {
      setStatus({ type: 'error', message: `Skipped ${newFiles.length - validFiles.length} invalid/corrupted file(s).` });
      clearStatusLater(4000);
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      // Only override status if we didn't just set an error
      if (validFiles.length === newFiles.length) {
        setStatus({ type: 'success', message: `${validFiles.length} file(s) added successfully` });
      }
      clearStatusLater(3000);
    }
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

  const handleSplitClick = (id) => {
    setSplittingFileId(id);
    setIsBulkSplit(false);
  };

  const handleSplitAllClick = () => {
    setSplittingFileId(true); // Truthy to open modal, but logic relies on isBulkSplit
    setIsBulkSplit(true);
  };

  const handleSplitConfirm = async (interval) => {
    if (isBulkSplit) {
      setSplittingFileId(null);

      let processed = 0;
      const total = files.length;

      for (const f of files) {
        try {
          processed++;
          setStatus({ type: 'info', message: `Splitting ${processed}/${total}: ${f.file.name}...` });

          // Yield to UI
          await new Promise(resolve => setTimeout(resolve, 100));

          const zipContent = await splitPDF(f.file, interval);

          // Create individual ZIP download
          const blob = new Blob([zipContent], { type: 'application/zip' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `${f.file.name.replace('.pdf', '')}-split.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Small delay to prevent browser throttling multiple downloads
          await new Promise(resolve => setTimeout(resolve, 500));
          URL.revokeObjectURL(link.href);

        } catch (err) {
          console.error(`Failed to split ${f.file.name}`, err);
        }
      }

      setStatus({ type: 'success', message: 'All bulk splits completed!' });
      clearStatusLater(5000);
      setIsBulkSplit(false);
      return;
    }

    const fileItem = files.find(f => f.id === splittingFileId);
    if (!fileItem) return;

    setStatus({ type: 'info', message: 'Splitting PDF... Please wait.' });
    setSplittingFileId(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const zipContent = await splitPDF(fileItem.file, interval);

      // Create download link for ZIP
      const blob = new Blob([zipContent], { type: 'application/zip' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileItem.file.name.replace('.pdf', '')}-split.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      setStatus({ type: 'success', message: 'PDF split successfully!' });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Failed to split PDF.' });
    } finally {
      clearStatusLater(5000);
    }
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
      clearStatusLater(5000);
    }
  };

  const editingFile = files.find(f => f.id === editingFileId);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center relative selection:bg-violet-500/30">
      {/* Ambient Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[128px]" />
      </div>
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
                  onSplitAll={handleSplitAllClick}
                  isMerging={isMerging}
                />

                <FileList files={files} onRemove={handleRemove} onEdit={handleEdit} onSplit={handleSplitClick} />
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

      <AnimatePresence>
        {splittingFileId && (
          <SplitModal
            file={isBulkSplit ? null : files.find(f => f.id === splittingFileId)}
            isBulk={isBulkSplit}
            onClose={() => {
              setSplittingFileId(null);
              setIsBulkSplit(false);
            }}
            onSplit={handleSplitConfirm}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
