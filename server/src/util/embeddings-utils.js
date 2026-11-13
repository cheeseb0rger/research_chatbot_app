import OpenAI from "openai";
import logger from '../logger.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

// helper, articles: [ {metadata: {article, source, topic}, content: string} ]  
//              --> [ [ chunkNumber, {metadata: {article, source, topic}, content: string} ] ]   (GROUPED)
// each chunk is a bit more than "maxLength" give or take
export function chunkText(articles, maxLength=800) {
    const groupedResult = [];
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' }); 
    
    for (const article of articles) {
        let text = article.content;
        if (!text) continue;
        
        // plan: text --> split into sentence --> for each sentence, if prev + current <= maxLength, add prev to chunk;  else push & reset
        // *overlap is one sentence 
        const result = [];
        const sentences = [...segmenter.segment(text.trim())].map(s => s.segment);
        
        text = null;
        const metadata = {...article.metadata};
  
        let currentSize = 0;    // size of current chunk (in chars)
        let currentChunk = [];  // stores sentence indexs for current chunk 
        let chunkNumber = 0;    // count
        for (let i = 0; i < sentences.length; i++) {
            if (sentences[i].length > maxLength * 2) {
                continue;
            }
            if (sentences[i].length === 0){
                continue;
            }
            if (currentSize + sentences[i].length < maxLength) {
                currentChunk.push(i);
                currentSize += sentences[i].length;
            }else{
                currentChunk.push(i);   // 1 sentence overlap, current
                result.push({
                    chunkNumber: ++chunkNumber,
                    content: currentChunk.map(idx => sentences[idx]).join(''),
                    metadata: metadata,
                });
                currentSize = sentences[i].length;
                currentChunk = [i];     // 1 sentence overlap, next
            }
        }
        // push the last chunk (if its not just the overlap sentence) 
        if (currentChunk.length > 1) {
            result.push({
                chunkNumber: ++chunkNumber,
                content: currentChunk.map(idx => sentences[idx]).join(''),
                metadata: metadata,
            });
        }
        groupedResult.push(result);
    }
    return groupedResult;
}

// texts: [ [ { chunkNumber, metadata, content: string } ] ]                            GROUPED 
//    -->  adds property embeddings:float[] to groupedTexts object  (mutates input) 
// embeddings are len 1536 
export async function generateEmbeddings(groupedTexts, model=DEFAULT_EMBEDDING_MODEL) {
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set in environment variables");
    
    // ungroup
    const texts = []
    groupedTexts.forEach((group) => {
        texts.push(...group);
    })

    if (texts.length === 0) {
        logger.warn('No valid texts provided for embedding generation');
        return [];
    }

    const llm = new OpenAI({
        apiKey: OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
        "X-Title": "Server Embeddings"
        }
    });

    // batch into 300 chunks 
    const batchSize = 300;
    const text_batches = Array.from({ length: Math.ceil(texts.length / batchSize) }, 
        (x, i) => texts.slice(i * batchSize, i * batchSize + batchSize) );

    const embeddings = [];
    try{
        for (const batch of text_batches){
            const response = await llm.embeddings.create({
                model: model,
                input: batch.map(({content}) => content),
                encoding_format: "float"
            });
            embeddings.push(...response.data.map(({embedding}) => embedding));
        }
    }catch(error){
        logger.error({ err: error }, 'Embedding generation request failed');
        throw new Error(`OpenAI ${DEFAULT_EMBEDDING_MODEL} embedding error`, {cause: {errorCode: 502, error: error}});
    }
    
    // regroup with embeddings 
    let i =  0;
    for (const group of groupedTexts){
        for (const chunk of group){
            chunk.embeddings = embeddings[i++];
        }
    }
    return groupedTexts;
}

// helper, calculates cosine similarity for semantic search 
// a and b are embeddings float[] 
function cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

// embeddedQuery:  { embeddings, content ... }, embeddedChunks:  [ { embeddings, content, ... } ] 
//      --> array of chunk objects that pass the threshold, references embeddedChunks  
export function semanticSearch(embeddedQuery, embeddedChunks, threshold=0.55, limit=20) {

    // keeps original order with index
    const similarityMap = embeddedChunks.map((chunk, i) => ({
        similarity: cosineSimilarity(embeddedQuery.embeddings, chunk.embeddings), 
        index: i,
        chunk: {
            id: chunk._id,
            content: chunk.content,
            metadata: chunk.metadata,
        },
    }));

    if (threshold == -1) return results;  
    if (threshold > 1 || threshold < 0) throw new Error(`embeddings-utils.semanticSearch: threshold must be between 0 and 1, or -1 for no threshold. Received: ${threshold}`);

    const results = similarityMap.filter(item => item.similarity > threshold)
        .sort((a, b) => b.similarity - a.similarity)//
        .slice(0,limit)//
        .sort((a, b) => a.index - b.index)//
        .map(item => item.chunk);
    
    logger.debug({ query: embeddedQuery.content, resultCount: results.length }, 'Semantic search completed');
    return results;
    // // sorted by similarity score
    // const results = embeddedChunks.map((chunk) => ({
    //     chunk: chunk,
    //     similarity: cosineSimilarity(embeddedQuery.embeddings, chunk.embeddings),
    // }));

    // results.sort((a, b) => b.similarity - a.similarity)//

    // if (threshold == -1) return results;  
    // if (threshold > 1 || threshold < 0) throw new Error(`embeddings-utils.semanticSearch: threshold must be between 0 and 1, or -1 for no threshold. Received: ${threshold}`);

    // const topResults = [];
    // for (let i=0; i < results.length; i++){
    //     if (results[i].similarity < threshold || i >= limit) break; 
    //     topResults.push(results[i].chunk);
    // }
    // return topResults;
}

export default { generateEmbeddings, chunkText, semanticSearch };
