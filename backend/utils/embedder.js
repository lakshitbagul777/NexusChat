let embedder;

const loadEmbedder = async () => {
    if (!embedder) {
        const { pipeline } = await import('@xenova/transformers'); // Dynamic import for ESM
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
};

const generateEmbedding = async (text) => {
    console.log(text);
    await loadEmbedder();
    const embedding = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(embedding.data);
};

module.exports = { generateEmbedding };
