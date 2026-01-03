import { PDFDocument } from 'pdf-lib';

export const compressLossless = async (arrayBuffer) => {
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    // pdf-lib's save with useObjectStreams and addDefaultPage true
    // is the most "lossless" optimization we can do without deep structural changes
    const compressedBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        updateFieldAppearances: false
    });

    return compressedBytes;
};
