import { MongoClient } from 'mongodb';
import logger from './logger.js';

const MONGODB_PORT = process.env.MONGODB_PORT || "27017";
let client;
let db;

// connect with db name in index to connect, run connect() to get connection after 
export async function connectDB(databaseName="test"){      // using  'test'  and  'main'  for db names ? 
    if (db) return db;

    try {
        client = new MongoClient(`mongodb://localhost:${MONGODB_PORT}`);
        await client.connect();

        db = client.db(databaseName);
        if (db) logger.info({ databaseName }, 'Connected to database');

        // set up server data 
        try{
            const serverData = db.collection('server_data');
            await serverData.insertOne({_id: "doc_index", value: 0});
            logger.info('Initialized server data collection');
        }catch(e){
            // server data already set up
        }

        return db;
    } catch (e){
        if (e.name === "MongoServerSelectionError") {
            logger.error('Unable to connect to MongoDB  (start up mongodb first)');
            process.exit(1);
        }
    }
}


export async function disconnectDB(){
    if (client){
        try {
            await client.close();
            logger.info('Database connection closed');
        } catch (error) {
            logger.warn({ err: error }, 'Database connection close failed');
        }
    }
}
