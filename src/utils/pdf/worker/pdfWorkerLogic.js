import * as pdfjsLib from 'pdfjs-dist';
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
} from './commands';
import { analyzePDF } from '../analyzePDF';
import { renderPreviewSample } from '../previewEngine';
import { compressPDF } from '../compressPDF';

// Stateful worker session
let session = {
    pdf: null, // pdfjs-dist proxy
    file: null,
    analysis: null,
    isCompressing: false,
    abortController: null
};

// Configure PDF.js for worker environment
// Set workerSrc to prevent error, but use disableWorker: true in getDocument
// to run PDF.js in this worker thread without spawning nested workers
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

self.onmessage = async (e) => {
    const { type, payload, id } = e.data;

    if (type === 'PING') {
        self.postMessage({ type: 'PONG' });
        return;
    }

    try {
        switch (type) {
            case INIT_SESSION: {
                const { file } = payload;
                if (!file) throw new Error("No file data provided to worker");

                const arrayBuffer = await file.arrayBuffer();

                // Load PDF once
                session.file = file;
                // Force main-thread execution (this worker thread)
                // disableWorker: true prevents spawning nested workers
                session.pdf = await pdfjsLib.getDocument({
                    data: arrayBuffer,
                    disableFontFace: true,
                    disableWorker: true,
                }).promise;

                self.postMessage({ type: SESSION_INITIALIZED, id });
                break;
            }

            case ANALYZE_PDF: {
                if (!session.pdf) throw new Error("Session not initialized");

                const result = await analyzePDF(session.pdf, session.file);
                session.analysis = result;

                self.postMessage({ type: ANALYSIS_COMPLETE, id, result });
                break;
            }

            case RENDER_PREVIEW: {
                if (!session.pdf) throw new Error("Session not initialized");

                const { pageNum, params } = payload;
                const imageBitmap = await renderPreviewSample(session.pdf, pageNum, params);

                self.postMessage({
                    type: PREVIEW_READY,
                    id,
                    result: imageBitmap
                }, [imageBitmap]); // Transferable ImageBitmap
                break;
            }

            case RENDER_ORIGINAL: {
                if (!session.pdf) throw new Error("Session not initialized");

                const { pageNum } = payload;
                // Render at higher scale but with 1.0 quality (no sim)
                const imageBitmap = await renderPreviewSample(session.pdf, pageNum, { dpi: 150, jpegQuality: 1.0 });

                self.postMessage({
                    type: ORIGINAL_READY,
                    id,
                    result: imageBitmap
                }, [imageBitmap]);
                break;
            }

            case START_COMPRESSION: {
                if (session.isCompressing) return;
                session.isCompressing = true;
                session.abortController = new AbortController();

                const { params } = payload;
                // Clone the ArrayBuffer to prevent detachment issues
                // when the buffer is used in multiple places
                const arrayBuffer = await session.file.arrayBuffer();
                const clonedBuffer = arrayBuffer.slice(0);

                const result = await compressPDF(clonedBuffer, params, (progress, status) => {
                    self.postMessage({ type: PROGRESS_UPDATE, id, progress, status });
                }, session.abortController.signal);

                self.postMessage({ type: COMPRESSION_COMPLETE, id, result }, [result.buffer]);
                session.isCompressing = false;
                break;
            }

            case CANCEL: {
                if (session.abortController) {
                    session.abortController.abort();
                }
                session.isCompressing = false;
                break;
            }

            default:
                console.warn(`Unknown command: ${type}`);
        }
    } catch (error) {
        console.error("Worker Error details:", error);
        if (error.name === 'AbortError') {
            self.postMessage({ type: 'CANCELLED', id });
        } else {
            self.postMessage({ type: 'ERROR', id, error: error.message, code: error.code || 'UNKNOWN' });
        }
        session.isCompressing = false;
    }
};
