import { MongoClient, MongoServerError, ObjectId } from 'mongodb'; 
import { connectDB } from '../db.js';
import embeddingRepository from './embeddingRepository.js'; 

const required = () => { throw new Error("chatHistory missing required function parameter", {cause: {errorCode: 400}} ); };
const convertId = (id) => {return (typeof id ===  "string") ? new ObjectId(id) : id};

// create an empty chat history, returns mongo id
async function create(name){
    const db = await connectDB();
    const chatHistory = db.collection('chatHistory');

    const result = await chatHistory.insertOne({ 
        name: name || "New chat", 
        content: [],
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    if (!result.acknowledged) throw new Error(`DB: chatHistory CREATE not acknowledged`);

    return result.insertedId;
}

// retruns all chats as array of {_id, name, createdAt, updatedAt}, sorted by last updated
async function getChats(){
    const db = await connectDB();
    const chatHistory = db.collection('chatHistory');
    
    return await chatHistory.find({}, {projection: {_id: true, name: true, createdAt: true, updatedAt: true}}).sort({updatedAt: -1}).toArray();
}

// returns full chat history array as [{role, content}]
async function getHistory(id=required()){
    id = convertId(id);
    const db = await connectDB();
    const chatHistory = db.collection('chatHistory');

    const {content} = await chatHistory.findOne({_id: id}, {projection: {content: true}});
    if (!content) throw new Error(`DB: chathistory id [${id}] not found`, {cause: {errorCode: 404}});
    const result = await Promise.all(content.map(async (message) => {
        if (message.role === "assistant") return {role: message.role, content: await embeddingRepository.getRefs(message.content)};
        return message;
    }));

    return result;
}

// add a new message to chat history, also updates the updatedAt timestamp
async function addMessage(id=required(), role=required(), content=required()){
    id = convertId(id);
    const db = await connectDB();
    const chatHistory = db.collection('chatHistory');

    if (!["user", "assistant", "tool"].includes(role)) throw new Error(`DB: chathistory message role cannot be "${role}"`, {cause: {errorCode: 400}});

    const result = await chatHistory.updateOne(
        { _id: id },
        { 
            $push: { content: { role: role, content: content } },
            $set: { updatedAt: new Date() } 
        }
    );

    if (!result.acknowledged) throw new Error(`DB: chatHistory UPDATE add message not acknowledged`);
    if (result.modifiedCount == 0) throw new Error(`DB: chathistory id [${id}] not found`, {cause: {errorCode: 404}});

    return result;
}

// remove message by index 
async function deleteMessage(id=required(), index=required()){
    id = convertId(id);
    const db = await connectDB();
    const chatHistory = db.collection('chatHistory');

    let history = await getHistory(id);
    if (index >= history.length) throw new Error(`DB: deleteMessage index ${index} is out of bounds for chat history of length ${history.length}.`, {cause: {errorCode: 400}});
    
    history.splice(index, 1);                         // option 1 -> remove
    //chatHistory[index] = {role: "deleted", content: null};  // option 2 -> mark as deleted 

    let result = await chatHistory.updateOne(
        { _id: id },
        { $set: { 
                content: history,
                updatedAt: new Date()
            }},
    );
    if (!result.acknowledged) throw new Error(`DB: chatHistory UPDATE delete message not acknowledged`);
    if (result.modifiedCount == 0) throw new Error(`DB: chathistory id [${id}] not found`, {cause: {errorCode: 404}});

    return result;
}

async function deleteChat(id=required()){
    id = convertId(id);
    const db = await connectDB();
    const chatHistory = db.collection('chatHistory');

    const result = await chatHistory.deleteOne({ _id: id });

    if (!result.acknowledged) throw new Error(`DB: chatHistory DELETE chat not acknowledged`);
    if (result.deletedCount === 0) throw new Error(`DB: chathistory id [${id}] not found`, {cause: {errorCode: 404}});
    return result;
}

async function getName(id=required()){
    id = convertId(id);
    const db = await connectDB();
    const chatHistory = db.collection('chatHistory');

    const { name: result } = await chatHistory.findOne({_id: id}, {projection: {name: true}});
    return result;
}

async function updateDate(id=required()) {
    id = convertId(id);
    const db = await connectDB();
    const chatHistory = db.collection('chatHistory');

    const result = await chatHistory.updateOne(
        {_id: id}, 
        {$set: {
            updatedAt: new Date()
        }}
    );

    if (!result.acknowledged) throw new Error(`DB: chatHistory UPDATE  date not acknowledged`);
    if (result.modifiedCount == 0) throw new Error(`DB: chathistory id [${id}] not found or failed to update date`, {cause: {errorCode: 404}});
    return result;
}

async function updateName(id=required(), newName=required(), newChatOnly=false) {   // newChatOnly: updates name only if the current name is "New chat"
    id = convertId(id);
    const db = await connectDB();
    const chatHistory = db.collection('chatHistory');

    if (newChatOnly && await getName(id)!=="New chat") return; 

    const result = await chatHistory.updateOne(
        {_id: id}, 
        {$set: {
            name: newName,
            updatedAt: new Date()
        }}
    );

    if (!result.acknowledged) throw new Error(`DB: chatHistory UPDATE  name not acknowledged`);
    if (result.modifiedCount == 0) throw new Error(`DB: chathistory id [${id}] not found or failed to update name`, {cause: {errorCode: 404}});
    return result;
}

export default { create, getChats, getHistory, addMessage, deleteMessage, deleteChat, getName, updateDate, updateName };     // import as import chatHistoryRepository from "..."   --> chatHistoryRepository.create(...)