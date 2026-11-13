import { searchNewsArticles, searchWiki, getArticleContent, getWikiContent } from '../util/news-utils.js';
import { generateEmbeddings, chunkText, semanticSearch } from '../util/embeddings-utils.js';
import serverDataRepository from '../repository/serverDataRepository.js';
import embeddingRepository from "../repository/embeddingRepository.js";
import logger from '../logger.js';

import OpenAI from "openai";

import { readFile } from 'fs/promises';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const DEFAULT_MODEL = "openai/gpt-5.6-luna"; 

const SYSTEM_PROMPT = await readFile("./ai-system-prompt.md", "utf-8");
if (!SYSTEM_PROMPT) throw new Error("System prompt not found");

// helper 
function getModel(){
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set in environment variables");
    const llm = new OpenAI({
        apiKey: OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
        "X-Title": "Report generation"
        }
    });
    return llm;
}
const required = () => { throw new Error("ai-service: missing required function parameter", {cause: {errorCode: 400}} ); };

// helper.  task: {status, progress, message, result}  --> updates task object
function progressUpdate(task, status, incrementProgress, message){
    if (!task) return;
    task.status = status;
    task.progress = Math.min(99, task.progress + incrementProgress);
    task.message = message;
}

// toolCalls: array of tool calls --> returns array of call result objects 
async function search(toolCalls=required(), task){  
    const topic = toolCalls[0].arguments.topic;
    progressUpdate(task, "in_progress", 5, `Searching for [${topic}]...`);
    
    let embeddedChunks = await embeddingRepository.getByTopic(topic);
    if (embeddedChunks.length > 0){
        logger.debug({ topic, chunkCount: embeddedChunks.length }, 'Retrieved embeddings from database');
    }
    else{
        // search news 
        const results_news = await searchNewsArticles(topic);
        const articles = await getArticleContent(results_news);
        progressUpdate(task, "in_progress", 10, `Found ${articles.length} sources on [${topic}]...`);

        // search wikipedia
        const results_wiki = await searchWiki(topic);
        const wiki = await getWikiContent(results_wiki);

        articles.push(...wiki);
        progressUpdate(task, "in_progress", 5, `Found ${articles.length} sources on [${topic}]...`);

        // generate embeddings 
        const chunks = chunkText(articles); // grouped 
        await generateEmbeddings(chunks); // grouped 

        // doc numbering --> upgroup 
        let {value} = await serverDataRepository.get("doc_index");
        embeddedChunks = [];
        chunks.forEach( (group) => {
            value++;
            embeddedChunks.push(...group.map((item) => {
                return {
                    _id: `DOC${value}_CHUNK${item.chunkNumber}`,
                    metadata: item.metadata,
                    embeddings: item.embeddings,
                    content: item.content,
                }
            }))
        });

        await embeddingRepository.create(embeddedChunks);
        await serverDataRepository.set("doc_index", value);
        
        logger.debug({ topic: topic, chunkCount: embeddedChunks.length }, 'Embeddings stored into database');
    }

    const queries = toolCalls.map( (call) => [{content: call.arguments.searchQuery, call_id: call.call_id}] );

    await generateEmbeddings(queries); 

    return queries.map(query => ({
        type: "function_call_output",
        call_id: query[0].call_id, 
        output: JSON.stringify(semanticSearch(query[0], embeddedChunks)), 
    }))
}

const toolMappings = {
    "search": search,
    // for other search functions, do not add results to database without reworking .search
};

// search,      to do: broadSearch narrowSearch wikiSearch 
const tools = [
    {
        type: "function",
        name: "search",
        description: "Searches for chunks of relevant information about a topic and search query.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
            topic: {
                type: "string",
                description:
                    "The general research area, expressed as a few concise keywords. " +
                    'Example: "vietnam war"'
            },
            searchQuery: {
                type: "string",
                description:
                    "A specific natural-language question describing what specific information to retrieve. Retrieval uses semantic search. " +
                    'Example: "What events led to the start of the conflict?"'
            }
        },
        required: ["topic", "searchQuery"],
        additionalProperties: false
        }
    },
];


// userInput: string , history: [ { role, content } ] or [] for new chat 
//  --> returns openAI response object 
export async function generateResponseLoop(userInput=required(), history=required(), task) {
    const llm = getModel();

    // initial input
    const input = [
        {role: "system", content: SYSTEM_PROMPT}, 
        ...history, 
        {role: "user", content: userInput}
    ];

    let loopTime, startTime, responseId; 
    loopTime = startTime = performance.now();



    // TOOL LOOP
    for (let i = 0, limit = 8; true; i++) {
        logger.debug({ inputLength: JSON.stringify(input).length }, 'Sending model request');
        progressUpdate(task, "in_progress", 5, `Thinking...`);

        let response = await llm.responses.create({
                model: DEFAULT_MODEL,
                //...(responseId && { previous_response_id: responseId }),
                input,
                tools,
                store: false,
            });
        if (response.status !== "completed") throw new Error(`Response ended with status ${response.status}`, {cause: {errorCode: 502}});
        input.push(...response.output);
        //responseId = response.id;

        // log 
        logger.info({ durationMs: performance.now() - loopTime }, `Tool loop [${i + 1}] completed`);
        loopTime = performance.now();
        

        // EXITS
        // no more calls (successful exit) 
        if (!response.output.find((item) => item.type === "function_call")) {
            const report = response.output.find(item => item.type === "message").content[0].text;
            if (!report) throw new Error("No response generated", {cause: {errorCode: 204}});

            logger.info({ durationMs: performance.now() - startTime }, 'Report generation completed');
            progressUpdate(task, "in_progress", 99, 'Loading response...');

            return report;
        }
        // loop limit (unsuccessful exit) 
        if (i >= limit) {
            logger.warn({ durationMs: performance.now() - startTime, limit: limit + 1 }, 'Maximum tool call iterations reached');
            throw new Error(`tool loop exceeded limit`, {cause: {errorCode: 504}});
            // return response;
        }


        // TOOL CALLING 
        // parse tool calls 
        const rawCalls = response.output.filter((item) => item.type === "function_call");
        const calls = rawCalls.map((call) => ({
            call_id: call.call_id,
            name: call.name,
            arguments: JSON.parse(call.arguments),
        }))
        const groupedCalls = Object.groupBy(calls, (call) => `${call.name}-${call.arguments.topic}`);    // group by function-topic --> object containing array of call objects 

        // tool calls 
        for (const group of Object.values(groupedCalls)){   // group is array of calls 
            if (!toolMappings[group[0].name]) throw new Error(`No tool found for ${group[0].name}.`, {cause: {errorCode: 502}});
            logger.info({ tool: group[0].name, input: group[0].arguments.topic }, 'Calling model tool');

            const toolResults = await toolMappings[group[0].name](group, task);
            input.push(...toolResults); 
        }
    }
}

export default { generateResponseLoop }
