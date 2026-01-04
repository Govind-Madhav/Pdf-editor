import '../worker/worker-polyfill';
import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

/**
 * Aggressive Strategy: Full page rasterization at target DPI.
 * This is the fallback for scanned docs or high compression needs.
 */
export const compressAggressive = async (arrayBuffer, params, onProgress, abortSignal) => {
    const { dpi, jpegQuality } = params;
    const scale = dpi / 72; // PDF standard is 72 DPI

    // disableWorker: true is critical when running inside another worker
    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        disableFontFace: true,
        disableWorker: true
    }).promise;
    const outPdfDoc = await PDFDocument.create();
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
        if (abortSignal?.aborted) throw new Error("AbortError");
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        // In node/env without DOM, this would need a canvas shim.
        // In worker, we use OffscreenCanvas.
        const canvas = new OffscreenCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const blob = await canvas.convertToBlob({
            type: 'image/jpeg',
            quality: jpegQuality
        });

        const imageBytes = await blob.arrayBuffer();
        const image = await outPdfDoc.embedJpg(imageBytes);

        const outPage = outPdfDoc.addPage([viewport.width / scale, viewport.height / scale]);
        outPage.drawImage(image, {
            x: 0,
            y: 0,
            width: outPage.getWidth(),
            height: outPage.getHeight(),
        });

        if (onProgress) onProgress(i / totalPages);
    }

    return await outPdfDoc.save({ useObjectStreams: true });
};
