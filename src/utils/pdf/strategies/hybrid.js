import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

/**
 * Hybrid Strategy: Rasterize background but overlay searchable text.
 * This preserves searchability/accessibility while heavily compressing images.
 */
export const compressHybrid = async (arrayBuffer, params, onProgress, abortSignal) => {
    const { dpi, jpegQuality } = params;
    const scale = dpi / 72;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const outPdfDoc = await PDFDocument.create();
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
        if (abortSignal?.aborted) throw new Error("AbortError");
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1 }); // Standard scale for text extraction
        const renderViewport = page.getViewport({ scale });

        // 1. Render Background
        const canvas = new OffscreenCanvas(renderViewport.width, renderViewport.height);
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport: renderViewport }).promise;

        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: jpegQuality });
        const imageBytes = await blob.arrayBuffer();
        const image = await outPdfDoc.embedJpg(imageBytes);

        const outPage = outPdfDoc.addPage([viewport.width, viewport.height]);
        outPage.drawImage(image, {
            x: 0,
            y: 0,
            width: viewport.width,
            height: viewport.height,
        });

        // 2. Overlay Invisible Searchable Text
        try {
            const textContent = await page.getTextContent();
            for (const item of textContent.items) {
                // Note: placing invisible text at exact same positions.
                // In a production app, we'd handle fonts better, 
                // but for now, we use standard Helvetica as a placeholder for search hits.
                const { transform, width, height, str } = item;
                // transform is [scaleX, skewY, skewX, scaleY, x, y]
                const x = transform[4];
                const y = transform[5];
                const fontSize = Math.sqrt(transform[0] ** 2 + transform[1] ** 2);

                if (str.trim()) {
                    outPage.drawText(str, {
                        x,
                        y,
                        size: fontSize,
                        opacity: 0, // INVISIBLE but searchable
                    });
                }
            }
        } catch (e) {
            console.warn(`Failed to overlay text for page ${i}`, e);
        }

        if (onProgress) onProgress(i / totalPages);
    }

    return await outPdfDoc.save({ useObjectStreams: true });
};
