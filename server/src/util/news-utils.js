import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import logger from '../logger.js';

const NEWS_API_KEY = process.env.NEWS_API_KEY; 
const DEFAULT_PAGE_SIZE_NEWS = 100;
const DEFAULT_PAGE_SIZE_WIKI = 5; 
const TIMEOUT = 15000; // in ms


// helper 
async function promisePool(inputs, n, callback) {
    const result = [];
    let index = 0;
    const worker = async function() {
        while(inputs.length > 0){
            const i = index++;
            const item = inputs.shift();
            result[i] = await callback(item);
        }
    };
    const workers = Array(Math.min(n, inputs.length)).fill(null).map(worker);
    await Promise.all(workers);
    return result; 
}

// returns array of metadata objects  [ { article, source, url, topic } ]
export async function searchNewsArticles(query, pageSize=DEFAULT_PAGE_SIZE_NEWS) {    
    const startTime = performance.now();
    if (!NEWS_API_KEY) throw new Error("NEWS_API_KEY is not set in environment variables.");
    if (!query.trim()) throw new Error("news-utils.fetchNewsArticles: query is empty or whitespace.");
    
    const url = "https://newsapi.org/v2/everything";
    const params = {
        q: query.trim(),
        apiKey: NEWS_API_KEY,
        pageSize: pageSize,
        language: "en",
        sortBy: "popularity",
    };
    const response = await axios.get(url, {params});
    
    if (response.data.status !== "ok") throw new Error(response.data.message || "News API error", {cause: {errorCode: 502}});
    logger.debug({ query, count: response.data.articles.length, available: response.data.totalResults }, 'Searching news articles');
    
    return response.data.articles.map(article => ({
        article: article.title,
        source: article.source.name,     // note  .source also has .id (news api), .name, .url (homepage), .catagory ...
        url: article.url,
        topic: query,
    })); 

    // let result = await promisePoolFetch(response.data.articles, 5, fetchArticleContent);

    // result = result.filter(x => x !== null); 

    // console.log(`\tFetched ${result.length} articles on "${query}" in ${(performance.now() - startTime) / 1000} s\n`)

    // return result || []; 
}

// returns array of metadata objects  [ { article, source, url, *key*, topic } ]
export async function searchWiki(query, pageSize=DEFAULT_PAGE_SIZE_WIKI){
    const startTime = performance.now();
    const url = "https://en.wikipedia.org/w/rest.php/v1/search/page";
    const headers = {'User-Agent': "contextRetrievalAgent/0.1 (ramdomprogamer@gmail.com)"};
    const params = {
        'q': query.trim(), 
        'limit': pageSize,};
    
    const response = await axios.get(url, {headers, params});

    logger.debug({ query, count: response.data.pages.length }, 'Searching Wikipedia articles');
    
    return response.data.pages.map(page => ({
        article: page.title,
        source: "wikipedia",
        url: `https://en.wikipedia.org/wiki/${page.key}`,
        page_key: page.key,
        topic: query,
    })); 

    // let result = await promisePoolFetch(response.data.pages, 5, fetchWikiContent);

    // result = result.filter(x => x !== null); 

    // console.log(`\tFetched ${result.length} wiki articles on "${query}" in ${(performance.now() - startTime) / 1000} s\n`)

    // return result || []; 
}


// param list of metadata objects 
// --> [ { metadata, content} ]
export async function getArticleContent(articlesMetadata){ 
    const startTime = performance.now();
    let result = await promisePool(articlesMetadata, 5, async (metadata) => {
        try{
            // fetches article HTML
            const {data: article} = await axios.get(metadata.url, {
                timeout: TIMEOUT, 
                signal: AbortSignal.timeout(TIMEOUT),
            });   

            // remove css -> then converts to DOM 
            const cleanedArticle = article
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, ''); 
            const dom = new JSDOM(cleanedArticle, {url: metadata.url});
            
            // parses
            let text;
            try{
                text = new Readability(dom.window.document).parse();
                if (!text.textContent) throw new Error(`No content found in article`); 
            }
            finally{
                dom.window.close();
            }

            return {
                metadata, 
                content: text.textContent
                    .trim()
                    .replace(/([.!?])([A-Z])/g, "$1 $2")    // adds missing space after punctuation
                    .replace(/(\s\s+)/g, " "),              // removes extra whitespace 
            };
        } catch(error){
            // console.error(`news-utils.fetchNewsArticles: an error occurred while fetching article from ${metadata.url} . Message: ${error.message} `);
            return null; 
        }
    });
    result = result.filter(x => x != null); 

    logger.debug({ fetched: result.length, durationMs: performance.now() - startTime }, 'News article fetched successfully');
    return result || []; 
}

// param list of metadata objects, inc the page_key property 
// --> [ { metadata, content} ]
export async function getWikiContent (articlesMetadata){
    const startTime = performance.now();

    let result = await promisePool(articlesMetadata, 5, async (metadata) => {
        try{
            const headers = {'User-Agent': "contextRetrievalAgent/0.1 (ramdomprogamer@gmail.com)"};
            const params = {'title': metadata.page_key, 'action': 'raw'};
            const response = await axios.get("https://en.wikipedia.org/w/index.php", {headers, params, timeout:TIMEOUT});

            return {
                metadata, 
                content: response.data
                    .replace(/<ref\b[^>]*>.*?<\/ref\s*>/gi, '')         // remove <ref>...</ref>
                    .replace(/\[\[\s*(?:file|image|media):.*?\]\]/gi, '')   // remove files/images/media:
                    .replace(/\[\[([^\[\]]+?)\]\]/g, "$1")              // remove links but preserves its text 
                    .split(/== References ==/)[0],                      // remove everything after references list 
            };
        }
        catch (error){
            // logger.warn({ err: error, page: metadata.page_key }, 'Failed to fetch Wikipedia content');
            return null;
        }
    });
    result = result.filter(x => x != null); 

    logger.debug({ fetched: result.length, durationMs: performance.now() - startTime }, 'Wikipedia content fetched successfully');
    return result || []; 
}


export default { searchNewsArticles, searchWiki, getArticleContent, getWikiContent };
