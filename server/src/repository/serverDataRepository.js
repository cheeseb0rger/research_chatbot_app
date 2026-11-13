import { MongoClient, MongoServerError } from 'mongodb'; 
import { connectDB } from '../db.js';
import logger from '../logger.js';

// keys:  "doc_index"

async function set(key, value){
    const db = await connectDB();
    const data = db.collection('server_data');

    const result = await data.updateOne( { _id: key }, {$set: { value: value }} );

    if (!result.acknowledged) logger.warn({ key }, 'Server data update was not acknowledged by the database');

    return result;
}

async function get(key){
    const db = await connectDB();
    const data = db.collection('server_data');

    return await data.findOne( { _id: key } );
}

export default { set, get };
