/**
 * Renders a specific page with the given compression parameters for preview.
 * Returns an ImageBitmap for high-performance transferable transfer.
 */
export const renderPreviewSample = async (pdf, pageNum, params) => {
    const { dpi, jpegQuality } = params;
    const page = await pdf.getPage(pageNum);

    const scale = dpi / 72;
    const viewport = page.getViewport({ scale });

    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    // Simulate JPEG compression by drawing back to a second canvas if needed,
    // or just return the bitmap if we want to show DPI impact.
    // To truly simulate JPEG quality, we'd need to convert to blob and back to bitmap.
    const blob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: jpegQuality
    });

    return await createImageBitmap(blob);
};
