/**
 * Image embedding utility using TensorFlow.js + MobileNet
 * Computes feature vectors for image similarity matching.
 *
 * Used during article verification: take a photo of an article,
 * find the most similar stored photo from the registration.
 */

let modelPromise: Promise<any> | null = null;

/**
 * Lazy-load TensorFlow.js and MobileNet model.
 * Cached after first load (~16MB download, then browser-cached).
 */
async function loadModel(): Promise<any> {
    if (!modelPromise) {
        modelPromise = (async () => {
            await import('@tensorflow/tfjs');
            const mobilenet = await import('@tensorflow-models/mobilenet');
            return mobilenet.load({ version: 2, alpha: 1.0 });
        })();
    }
    return modelPromise;
}

/**
 * Compute a feature embedding (1000-dim) from an HTMLImageElement.
 */
export async function computeEmbedding(imgElement: HTMLImageElement): Promise<Float32Array> {
    const model = await loadModel();
    // infer returns classification, but we want the internal features
    // Use model.infer(img, true) to get the penultimate layer embedding
    const embedTensor = model.infer(imgElement, true);
    const data = await embedTensor.data();
    embedTensor.dispose();
    return new Float32Array(data);
}

/**
 * Compute embedding from an image File (e.g. from camera capture).
 */
export async function computeEmbeddingFromFile(file: File): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = async () => {
            try {
                const emb = await computeEmbedding(img);
                URL.revokeObjectURL(img.src);
                resolve(emb);
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Compute embedding from an image URL.
 */
export async function computeEmbeddingFromUrl(url: string): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = async () => {
            try {
                const emb = await computeEmbedding(img);
                resolve(emb);
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
    });
}

/**
 * Cosine similarity between two vectors.
 * Returns value between -1 and 1, where 1 = identical.
 */
export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
}

/**
 * Find the best matching photos from stored embeddings.
 */
export function findBestMatches(
    queryEmbedding: Float32Array,
    storedEmbeddings: { filename: string; url: string; embedding: number[] }[],
    topK = 5
): { filename: string; url: string; score: number }[] {
    const scored = storedEmbeddings.map((item) => ({
        filename: item.filename,
        url: item.url,
        score: cosineSimilarity(queryEmbedding, item.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
}

/**
 * Check if the model is loading/loaded
 */
export function isModelLoaded(): boolean {
    return modelPromise !== null;
}

/**
 * Preload the model in the background
 */
export function preloadModel(): void {
    void loadModel();
}
