import { generateResponseLoop } from '../src/service/ai-service.js';
import { connectDB, disconnectDB } from '../src/db.js';
import chatHistoryRepository from '../src/repository/chatHistoryRepository.js';

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import embeddingRepository from '../src/repository/embeddingRepository.js';



// function printMemory(){
//     const { rss, heapUsed } = process.memoryUsage();
//     console.log(`\t\t[MONITOR] RSS: ${(rss / 1024 / 1024).toFixed(2)} MB | Heap Used: ${(heapUsed / 1024 / 1024).toFixed(2)} MB`);
// }
// const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// takes text references formatted as  \\["...", DOC#\\_CHUNK#]  
async function getRefs(text){
    const regex = /\[".*?", (DOC\d+_CHUNK\d+)]/g;     // captures "DOC#_CHUNK#"

    let ids = [...text.matchAll(regex)].map(match => match[1]);
    if (!ids || ids.length === 0) return "no refs";

    const refs = await embeddingRepository.getByChunkId(ids, {projection: {_id: true, metadata: true}});  // refs is { _id: { _id: ObjectId, metadata:{...} } }

    // replace inline citations with [url]
    return text.replace(regex, (citation, id) =>
            `[${refs[id]?.metadata?.url  || id}]`
        );
}   

// TESTING
console.log("begin test\n");
console.time("runtime");

// monitor 
function startMonitor(){
    return setInterval(() => {
            const { rss, heapUsed } = process.memoryUsage();
            console.log(`\t\t[MONITOR] RSS: ${(rss / 1024 / 1024).toFixed(2)} MB | Heap Used: ${(heapUsed / 1024 / 1024).toFixed(2)} MB`);
        }, 15000); // Runs every 15 seconds
}

let monitor = startMonitor();
console.log("\t\tTotal heap size: ", (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2));
console.log(`\t\tRSS: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB \n`);

await connectDB("test");

// create chat 
const chatId = await chatHistoryRepository.create();
console.log(`Chat created at id: ${chatId}\n\n`);

// input for testing 
const rl = readline.createInterface({ input, output });

const history = [];

await (async function inputLoop(){
    clearInterval(monitor);
    const input = await rl.question("Input: ");
    if (input == "exit") return;
    monitor = startMonitor();
    
    console.log("\nGenerating response...")
    const response = await generateResponseLoop(input, history);

    // console.log("\n\nRESPONSE DIR: ");
    // console.dir(response);

    if (!response.output.find(item => item.type === "message")) return; 
    
    const report = response.output.find(item => item.type === "message").content[0].text;
    console.log("\nREPORT: ");
    console.log(report);
    console.log("\n\n");
    
    // name chat 
    if (await chatHistoryRepository.getName(chatId) == "New chat"){ 
        const headings = report.match(/^#{1,2}\s(.+?)\n/m);   // # or ## + whitespace + (text) + \n
        if (headings[1]){
            await chatHistoryRepository.updateName(chatId, headings[1]);
        }
    }

    // add messages 
    await chatHistoryRepository.addMessage(chatId, "user", input);
    history.push({role: "user", content: input});

    await chatHistoryRepository.addMessage(chatId, "assistant", report);
    history.push({role: "assistant", content: report});
    
    await inputLoop();
})();

console.log(`\nProgram Exit \nReturn to chat at id: ${chatId}\n`);

rl.close();

disconnectDB();

console.timeEnd("runtime");
console.log("end test");

process.exit(0);
