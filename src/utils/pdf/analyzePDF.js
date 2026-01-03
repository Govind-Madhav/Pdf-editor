import * as pdfjsLib from 'pdfjs-dist';
// Note: We'll need to set the workerSrc if using this inside a worker too, 
// but usually workers can't start workers easily. We'll use the main dist.

export const analyzePDF = async (pdf, file) => {
    const pageCount = pdf.numPages;
    let totalImages = 0;
    let totalTextItems = 0;
    let samplePages = { text: null, image: null, mixed: null };

    // Analyze a subset of pages for efficiency and ratios
    // For large PDFs, we probe first, middle, last and some in between
    const pagesToAnalyze = new Set([1, Math.floor(pageCount / 2), pageCount].filter(p => p > 0 && p <= pageCount));

    // Add more samples if needed
    for (let i = 1; i <= Math.min(pageCount, 10); i++) {
        pagesToAnalyze.add(i);
    }

    for (const pageNum of pagesToAnalyze) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const ops = await page.getOperatorList();

        const imageCount = ops.fnArray.filter(fn =>
            fn === pdfjsLib.OPS.paintImageXObject ||
            fn === pdfjsLib.OPS.paintInlineImageXObject
        ).length;

        totalImages += imageCount;
        totalTextItems += textContent.items.length;

        // Classify page for preview samples
        if (!samplePages.text && textContent.items.length > 50 && imageCount === 0) {
            samplePages.text = pageNum;
        } else if (!samplePages.image && imageCount > 0 && textContent.items.length < 10) {
            samplePages.image = pageNum;
        } else if (!samplePages.mixed && imageCount > 0 && textContent.items.length > 20) {
            samplePages.mixed = pageNum;
        }
    }

    // Fallbacks for samples
    if (!samplePages.text) samplePages.text = 1;
    if (!samplePages.image) samplePages.image = 1;
    if (!samplePages.mixed) samplePages.mixed = 1;

    const imageRatio = totalImages / (totalImages + totalTextItems / 10 || 1);

    return {
        fileSize: file.size,
        pageCount,
        imageRatio: Math.min(imageRatio, 1),
        textRatio: 1 - Math.min(imageRatio, 1),
        isScanned: totalTextItems === 0 && totalImages > 0,
        samplePages
    };
};
