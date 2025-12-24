import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';

// Helper to convert hex color to RGB
const hexToRgb = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ?
        {
            color: rgb(parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255),
            opacity
        }
        : { color: rgb(0, 0, 0), opacity };
};

// Transform Editor Coordinates (Top-Left) to PDF Coordinates (Rotated)
const transformPoint = (x, y, rotation, w, h) => {
    switch (rotation) {
        case 90:
            return { x: y, y: w - x };
        case 180:
            return { x: w - x, y: h - y };
        case 270:
            return { x: h - y, y: x };
        default: // 0
            return { x: x, y: h - y };
    }
};

const applyAnnotations = async (page, annotations, pdfDoc, imageCache) => {
    if (!annotations || annotations.length === 0) return;

    const { width: pdfWidth, height: pdfHeight } = page.getSize();
    const rotation = page.getRotation().angle % 360;

    for (const ann of annotations) {
        // --- 1. Dynamic Scaling (Width + Height) ---
        let scale = 0.5; // Fallback

        if (ann.meta && ann.meta.width && ann.meta.height) {
            // Check orientation for dimensions
            const isVertical = rotation % 180 === 0;
            // PDF dimensions relative to the visual upright view used in editor
            const visualPdfWidth = isVertical ? pdfWidth : pdfHeight;
            const visualPdfHeight = isVertical ? pdfHeight : pdfWidth;

            const scaleX = visualPdfWidth / ann.meta.width;
            const scaleY = visualPdfHeight / ann.meta.height;

            // Use minimum to ensure fit/avoid stretching
            scale = Math.min(scaleX, scaleY);
        }

        // --- 2. Coordinate Mapping ---
        const map = (lx, ly) => transformPoint(lx * scale, ly * scale, rotation, pdfWidth, pdfHeight);

        if (ann.type === 'path') {
            if (!ann.points || ann.points.length < 2) continue;

            const { color, opacity } = hexToRgb(ann.color, ann.opacity);
            const ops = ann.points.map((p, i) => {
                const { x, y } = map(p.x, p.y);
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');

            page.drawSvgPath(ops, {
                borderColor: color,
                borderWidth: ann.width * scale,
                borderOpacity: opacity,
            });
        }
        else if (ann.type === 'text') {
            // NOTE: pdf-lib does not support text opacity; color is applied fully opaque
            const { color } = hexToRgb(ann.color);
            const { x, y } = map(ann.x, ann.y);
            const scaledSize = ann.size * scale;

            // Option A: Text follows page (Matches Acrobat behavior)
            page.drawText(ann.text, {
                x,
                y: y - (rotation === 0 ? scaledSize : 0),
                size: scaledSize,
                color: color,
                rotate: degrees(rotation),
            });
        }
        else if (ann.type === 'image') {
            try {
                let image = imageCache.get(ann.dataUrl);
                if (!image) {
                    if (ann.dataUrl.startsWith('data:image/png')) {
                        image = await pdfDoc.embedPng(ann.dataUrl);
                    } else {
                        image = await pdfDoc.embedJpg(ann.dataUrl);
                    }
                    imageCache.set(ann.dataUrl, image);
                }

                const w = ann.width * scale;
                const h = ann.height * scale;

                const { x: mapX, y: mapY } = map(ann.x, ann.y);
                let drawX = mapX;
                let drawY = mapY;

                // Adjust anchor for PDF bottom-left origin requirement
                // NOTE: Rotation anchor logic is approximate for 180/270 degrees.
                // Ideally, anchoring should happen before rotation transformation.
                if (rotation === 0) {
                    drawY -= h;
                } else if (rotation === 90) {
                    drawX -= w;
                } else if (rotation === 180) {
                    drawX -= w;
                } else if (rotation === 270) {
                    drawY -= h;
                }

                page.drawImage(image, {
                    x: drawX,
                    y: drawY,
                    width: w,
                    height: h,
                    rotate: degrees(rotation)
                });
            } catch (e) {
                console.warn("Failed to embed image annotation", e);
            }
        }
    }
};

const processPage = async (pageConfig, sourcePages, pdfDoc, mergedPdf, allAnnotations, imageCache, font, fontSize, pageNum) => {
    const { id: pageId, originalIndex, rotation = 0 } = pageConfig;
    const sourcePage = sourcePages[originalIndex];
    const sourceRotation = sourcePage.getRotation().angle;

    const addedRotation = rotation % 360;
    const totalRotation = (sourceRotation + addedRotation) % 360;

    let targetPage;

    if (addedRotation % 180 !== 0) {
        // Embed & Scale (Preserve Container Aspect)
        const [embeddedPage] = await mergedPdf.embedPages(pdfDoc, [originalIndex]);
        const { width, height } = sourcePage.getSize();

        let effectiveWidth = (sourceRotation % 180 !== 0) ? height : width;
        let effectiveHeight = (sourceRotation % 180 !== 0) ? width : height;

        const newPage = mergedPdf.addPage([effectiveWidth, effectiveHeight]);
        targetPage = newPage;

        const scale = Math.min(effectiveWidth / embeddedPage.height, effectiveHeight / embeddedPage.width);
        const dims = embeddedPage.scale(scale);

        const rad = (totalRotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Robust centered rotation logic
        const x = (effectiveWidth / 2) - (dims.width / 2 * cos - dims.height / 2 * sin);
        const y = (effectiveHeight / 2) - (dims.width / 2 * sin + dims.height / 2 * cos);

        newPage.drawPage(embeddedPage, { ...dims, x, y, rotate: degrees(totalRotation) });
    } else {
        // Simple Copy
        const [copiedPage] = await mergedPdf.copyPages(pdfDoc, [originalIndex]);
        copiedPage.setRotation(degrees((copiedPage.getRotation().angle + addedRotation) % 360));
        targetPage = mergedPdf.addPage(copiedPage);
    }

    // Apply Annotations
    const pageAnns = allAnnotations[pageId];
    if (pageAnns) {
        await applyAnnotations(targetPage, pageAnns, mergedPdf, imageCache);
    }

    drawPageNumber(targetPage, pageNum, font, fontSize);
};

const drawPageNumber = (page, number, font, size) => {
    const { width, height } = page.getSize();
    const text = `${number}`;
    const textWidth = font.widthOfTextAtSize(text, size);
    const rotation = page.getRotation().angle;

    let x, y, rotate;

    // Position at bottom center relative to visual orientation
    if (rotation === 0) {
        x = width / 2 - textWidth / 2;
        y = 20;
        rotate = 0;
    } else if (rotation === 90) {
        x = width - 20;
        y = height / 2 + textWidth / 2;
        rotate = 270;
    } else if (rotation === 180) {
        x = width / 2 + textWidth / 2;
        y = height - 20;
        rotate = 180;
    } else if (rotation === 270) {
        x = 20;
        y = height / 2 - textWidth / 2;
        rotate = 90;
    } else {
        x = width / 2 - textWidth / 2;
        y = 20;
        rotate = 0;
    }

    page.drawText(text, { x, y, size, font, rotate: degrees(rotate), color: rgb(0, 0, 0) });
};

export const mergePDFs = async (items) => {
    const mergedPdf = await PDFDocument.create();
    const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    let pageCount = 0;

    const imageCache = new Map();

    for (const item of items) {
        const { file, pages, annotations = {} } = item;
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const sourcePages = pdfDoc.getPages();

        if (!pages) {
            const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach((page) => {
                const addedPage = mergedPdf.addPage(page);
                pageCount++;
                drawPageNumber(addedPage, pageCount, font, fontSize);
            });
        } else {
            for (const pageConfig of pages) {
                await processPage(pageConfig, sourcePages, pdfDoc, mergedPdf, annotations, imageCache, font, fontSize, ++pageCount);
            }
        }
    }

    return await mergedPdf.save();
};

export const downloadPDF = (bytes, filename) => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
};

const getSplitParts = async (file, interval) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const totalPages = pdfDoc.getPageCount();
    const parts = [];

    const baseName = file.name.replace('.pdf', '');
    let fileCount = 1;

    for (let i = 0; i < totalPages; i += interval) {
        const subDoc = await PDFDocument.create();

        const end = Math.min(i + interval, totalPages);
        const pageIndices = [];
        for (let j = i; j < end; j++) {
            pageIndices.push(j);
        }

        const copiedPages = await subDoc.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach(page => subDoc.addPage(page));

        const pdfBytes = await subDoc.save();
        parts.push({
            name: `${baseName}_part_${fileCount}.pdf`,
            data: pdfBytes
        });
        fileCount++;
    }
    return parts;
};

export const splitPDF = async (file, interval) => {
    const parts = await getSplitParts(file, interval);
    const zip = new JSZip();

    parts.forEach(part => {
        zip.file(part.name, part.data);
    });

    return await zip.generateAsync({ type: 'blob' });
};

export const bulkSplitPDF = async (files, interval) => {
    const rootZip = new JSZip();

    for (const file of files) {
        const parts = await getSplitParts(file, interval);
        // Create a folder for each file to keep it organized
        const folderName = file.name.replace('.pdf', '');
        const folder = rootZip.folder(folderName);

        parts.forEach(part => {
            folder.file(part.name, part.data);
        });
    }

    return await rootZip.generateAsync({ type: 'blob' });
};
