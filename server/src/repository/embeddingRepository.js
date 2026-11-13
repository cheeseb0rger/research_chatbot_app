import { MongoClient, MongoServerError, ObjectId } from 'mongodb'; 
import { connectDB } from '../db.js';
import logger from '../logger.js';

// content:  [ { _id, embeddings: float[], content: string, metadata } ]
async function create(content){
    const db = await connectDB();
    const embeddings = db.collection('embeddings');

    const result = await embeddings.insertMany(content);

    if (!result.acknowledged) logger.warn('Embedding insert was not acknowledged by the database');

    return result;
}

// *when retrieving many and including projection in options, _id must be included in the results
async function getByChunkId(id, options){
    const db = await connectDB();
    const embeddings = db.collection('embeddings');

    // get many 
    if (id instanceof Array ){
        const results = await embeddings.find( { _id: { $in: [...new Set(id)] } }, options ).toArray(); 

        // return results;                                                                  // return array, might not be in original order 
        // return id.map(item => results.find(obj => obj._id.toString() === item));         // return array in original order 
        return Object.fromEntries(results.map(chunk => [chunk._id.toString(), chunk]));     // return object with keys as the id 
    }

    // get one chunk
    return await embeddings.findOne( { "_id": id }, options );
}

async function getByTopic(topic, options){
    const db = await connectDB();
    const embeddings = db.collection('embeddings');
    return await embeddings.find( { "metadata.topic": topic }, options ).toArray();
}

async function deleteByTopic(topic){
    const db = await connectDB();
    const embeddings = db.collection('embeddings');
    const result = await embeddings.deleteMany( { "metadata.topic": topic } );

    if (!result.acknowledged) logger.warn({ topic }, 'Embedding deletion was not acknowledged by the database');

    return result;
}

// utility function, takes text references formatted as  \\["...", DOC#\\_CHUNK#]  
async function getRefs(text){
    const regex = /\[".*?", (DOC\d+_CHUNK\d+)]/g;     // captures "DOC#_CHUNK#"

    let ids = [...text.matchAll(regex)].map(match => match[1]);     // ids = ["DOC#_CHUNK#"]
    if (!ids || ids.length === 0) return text;

    const refs = await getByChunkId(ids, {projection: {_id: true, metadata: true}});  // refs is { _id: { _id: ObjectId, metadata:{...} } }

    // replace inline citations with <Ref> component 
    return text.replace(regex, (citation, id) => {
        const url = refs[id]?.metadata?.url;
        const title = refs[id]?.metadata?.article;
        const source = refs[id]?.metadata?.source || refs[id]?.metadata?.topic || "[source]";
        return `<Ref url={${url}} title={${title}} source={${source}} refId={${id}} />`;
    });
}   

export default { create, getByChunkId, getByTopic, deleteByTopic, getRefs };     // import as import embeddingRepository from "..."   --> embeddingRepository.create(...)
