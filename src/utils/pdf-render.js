import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// --- Cache ---
let cachedPdf = null;
let cachedFile = null;

const loadPdf = async (file) => {
    // Basic reference check. For robust usage with multiple files, 
    // we would need a Map<File, PDFDocumentProxy>. 
    // Since this app edits one file at a time or merges, this simple single-slot cache is a huge step up.
    if (cachedPdf && cachedFile === file) {
        return cachedPdf;
    }

    const arrayBuffer = await file.arrayBuffer();
    cachedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    cachedFile = file;
    return cachedPdf;
};

export const getPdfPageCount = async (file) => {
    try {
        const pdf = await loadPdf(file);
        return pdf.numPages;
    } catch (error) {
        console.error("Error loading PDF", error);
        return 0;
    }
};

export const renderPageToImage = async (file, pageIndex, scale = 1) => {
    try {
        const pdf = await loadPdf(file);
        const page = await pdf.getPage(pageIndex + 1); // pdfjs is 1-indexed

        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
        console.error('Error rendering page:', error);
        return null;
    }
};

export const extractPageText = async (file, pageIndex) => {
    try {
        const pdf = await loadPdf(file);
        const page = await pdf.getPage(pageIndex + 1);
        const textContent = await page.getTextContent();

        // Use scale 1 to get standard point dimensions
        const viewport = page.getViewport({ scale: 1 });

        return textContent.items.map(item => {
            // item.transform is [scaleX, skewY, skewX, scaleY, x, y]
            // PDF coords: y is from bottom-left.
            const tx = item.transform;
            const pdfX = tx[4];
            const pdfY = tx[5];
            const pdfHeight = Math.abs(tx[3]); // Approx font height
            const width = item.width;

            // NORMALIZE TO TOP-LEFT (Screen Coords)
            // Screen Y = Viewport Height - (PDF Y + Height) ? No.
            // PDF Y is the baseline. 
            // Top of text in PDF space = pdfY + pdfHeight (approx).
            // Distance from top = ViewportH - (pdfY + pdfHeight).
            // Actually, let's stick to standard top-left bounding box logic:
            // Top = ViewportHeight - pdfY - pdfHeight (if we assume pdfY is bottom) -> wait, pdfY is baseline.
            // Let's use standard convention: ScreenY = ViewportHeight - pdfY - pdfHeight.
            // This places the `y` at the visual top of the text entry.
            const screenY = viewport.height - pdfY - pdfHeight;

            return {
                str: item.str,
                x: pdfX,            // x is usually fine (left = 0)
                y: screenY,         // Normalized Top-Left Y
                bottomY: viewport.height - pdfY, // Normalized Bottom-Left Y (for reference)
                width: width,
                height: pdfHeight,
                rawTransform: tx,
                viewportHeight: viewport.height
            };
        });
    } catch (error) {
        console.error('Error extracting text:', error);
        return [];
    }
};
