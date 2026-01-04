import { compressLossless } from './strategies/lossless';
import { compressHybrid } from './strategies/hybrid';
import { compressAggressive } from './strategies/aggressive';

/**
 * Orchestrates the two-phase compression: Predict -> Compact -> Refine.
 */
export const compressPDF = async (arrayBuffer, params, onProgress, abortSignal) => {
    const { strategy, targetReduction } = params;
    const originalSize = arrayBuffer.byteLength;

    // Preserve the original buffer for potential refinement
    // Clone it for the first pass to prevent detachment
    const firstPassBuffer = arrayBuffer.slice(0);

    // Phase 1: Fast Exploration
    let result = await executeStrategy(firstPassBuffer, strategy, params, onProgress, abortSignal);

    if (abortSignal?.aborted) throw new Error("AbortError");

    // Phase 2: Quality Refinement if far from target
    // Check if we hit the target reduction (±5% tolerance)
    const reductionAchieved = ((originalSize - result.byteLength) / originalSize) * 100;
    const error = targetReduction - reductionAchieved;

    if (error > 10 && params.strategy !== 'lossless') {
        // We are way off (too big), try one more pass with more aggressive settings
        const refinedParams = {
            ...params,
            jpegQuality: Math.max(0.6, params.jpegQuality * 0.8),
            dpi: Math.max(96, Math.floor(params.dpi * 0.9))
        };

        // Notify progress system that we're refining
        if (onProgress) onProgress(0.5, "Refining for target...");

        // Use the preserved original buffer for refinement
        const refinementBuffer = arrayBuffer.slice(0);
        result = await executeStrategy(refinementBuffer, strategy, refinedParams, (p) => {
            if (onProgress) onProgress(0.5 + p * 0.5, "Finalizing...");
        }, abortSignal);
    }

    return result;
};

async function executeStrategy(arrayBuffer, strategy, params, onProgress, abortSignal) {
    if (abortSignal?.aborted) throw new Error("AbortError");

    switch (strategy) {
        case 'lossless':
            return await compressLossless(arrayBuffer);
        case 'hybrid':
            return await compressHybrid(arrayBuffer, params, onProgress, abortSignal);
        case 'aggressive':
            return await compressAggressive(arrayBuffer, params, onProgress, abortSignal);
        default:
            return await compressLossless(arrayBuffer);
    }
}
