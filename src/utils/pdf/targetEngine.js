/**
 * Translates a target reduction percentage and PDF analysis into actionable parameters.
 */
export const calculateCompressionParams = (analysis, targetReduction, qualityFloor = 'balanced') => {
    const { imageRatio, isScanned, pageCount } = analysis;

    // Base parameters
    let dpi = 150;
    let jpegQuality = 0.8;
    let strategy = 'hybrid';

    // If text-heavy and target is low, stay lossless
    if (imageRatio < 0.2 && targetReduction < 30) {
        strategy = 'lossless';
        return { strategy, dpi: 300, jpegQuality: 1.0 };
    }

    // Define floors
    const minDpi = qualityFloor === 'aggressive' ? 96 : (qualityFloor === 'balanced' ? 120 : 150);
    const minQuality = qualityFloor === 'aggressive' ? 0.6 : (qualityFloor === 'balanced' ? 0.7 : 0.85);

    // Target-driven reduction
    // This is a heuristic: we assume linear reduction impact for images
    // Actual impact is exponential with JPEG quality and quadratic with DPI
    const intensity = targetReduction / 100;

    // Adjust DPI: 300 down to minDpi
    dpi = Math.max(minDpi, 300 - (300 - minDpi) * intensity * 1.5);

    // Adjust Quality: 1.0 down to minQuality
    jpegQuality = Math.max(minQuality, 1.0 - (1.0 - minQuality) * intensity);

    // Strategy selection
    if (isScanned || (imageRatio > 0.8 && intensity > 0.7)) {
        strategy = 'aggressive'; // Full rasterization if it's mostly images anyway
    } else {
        strategy = 'hybrid'; // Re-encode images only, preserve text
    }

    return {
        strategy,
        dpi: Math.round(dpi),
        jpegQuality: parseFloat(jpegQuality.toFixed(2)),
        predictedSize: Math.round(analysis.fileSize * (1 - intensity * 0.8)) // Very rough estimate
    };
};
