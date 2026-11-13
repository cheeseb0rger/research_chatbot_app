import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import MessageBar from "./messageBar.jsx"
import Message from "./message.jsx"

import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner'
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';
import './chatWindow.css';

const URL = "http://localhost:3000";

export default function ChatWindow({ setRequestNewChat, currentChatId, currentChatName, setRequestGetTabs }) {
    const [messages, setMessages] = useState([]);       // messages as array  [ { role: str, content: str } ]
    const messageListRef = useRef(null);
    const [chatName, setChatName] = useState(null);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);    // signals retry (triggers getMessages)     not meant to actually count retries

    const [requestSendMsg, setRequestSendMsg] = useState(null); // stores message to be sent. triggers send when requestSendMsg && currentChatId 
    const [progress, setProgress] = useState(null);     // tracks llm response {status, progress, message, userRequest}  status: "pending" | "in_progress" | "completed" | "failed"
    const isTrackingProgress = useRef(false);           // prevents unnecessary rerender 
    const [requestPoll, setRequestPoll] = useState(null); // stores chatId for polling, triggers server polling when not null

    const [darkMode, setDarkMode] = useState(true);
    useEffect(() => {
        document.documentElement.setAttribute("data-bs-theme", darkMode ? "dark" : "light");
    }, [darkMode]);

    // gets messages
    // triggered when entering a chat or retryCount
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        if (!currentChatId) { 
            setMessages([]);
            setError(false);
            setLoading(false);
            return;
        }
        
        setMessages([]);
        setLoading(true);
        setError(false);
        
        console.log("debug: triggered get message with currentChatId:", currentChatId);
        axios.get(`${URL}/chat/${currentChatId}/messages`, {signal})
            .then((response) => {
                setMessages(response.data);
            })
            .catch((error) => {
                if (error.name !== 'AbortError'){
                    console.error("Error fetching messages:", error);
                    setError(true);
                } 
            })
            .finally(() => {
                if (!signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [currentChatId, retryCount]);
    
    // poll request progress
    // triggered when requestPoll contains an id === currentChatId
    useEffect(() => {
        setRequestPoll(null);
        console.log(`debug: polling chat. polling id ${requestPoll}, current chat id ${currentChatId}`);
        if (!requestPoll || requestPoll != currentChatId) return;
        
        
        axios.get(`${URL}/generate/${requestPoll}/poll`)
            .then((response) => {
                if (response.status === 204) {
                    setProgress(null);
                    return;
                }

                const task = response.data;
                setProgress(task);

                switch (task.status) {
                    case "in_progress":
                        isTrackingProgress.current = true;
                        setTimeout(() => setRequestPoll(currentChatId), 1000); // poll again after delay
                        return;
                    case "completed":
                        if (isTrackingProgress.current) {
                            isTrackingProgress.current = false;
                            setRequestGetTabs(true);
                            setRetryCount(count => count + 1);    // trigger get messages 
                        }
                        return;
                    case "failed":
                        isTrackingProgress.current = false;
                        return;
                    default:
                        // do nothing  
                }
            })
            .catch((error) => {
                console.error(`Error polling request progress for chat ${requestPoll}:`, error);
                setProgress({ status: "failed", message: `Error polling request progress for chat ${requestPoll}.` });
            });
    }, [requestPoll]);

    // resets and polls
    // triggered when entering a chat 
    useEffect(() => {
        setProgress(null);
        isTrackingProgress.current = false;
        if (currentChatId) setRequestPoll(currentChatId);
    }, [currentChatId]);
    

    // post request
    // triggered when a message is provided in requestSEndMsg && chatId exists
    useEffect(() => {
        if (!requestSendMsg || !currentChatId) return;

        setProgress({ status: "pending", userRequest: requestSendMsg });

        axios.post(`${URL}/generate/${currentChatId}/request`, { userRequest: requestSendMsg, history: messages })
            .then(() => {
                console.log("Request sent successfully");        
                setRequestPoll(currentChatId);
            })
            .catch((error) => {
                console.error("Error sending request:", error);
                setProgress({ status: "failed", message: "Failed to send request" });
            });
        
        setRequestGetTabs(true);
        setRequestSendMsg(null);
    }, [requestSendMsg, currentChatId]);

    function sendMsg (userRequest) {
        if (!currentChatId) setRequestNewChat(true);    // if not currently in a chat, creates a new chat first 
        setRequestSendMsg(userRequest);
    }

    // helper, renders additional messages based on the request status 
    function renderProgressMessage() {
        if (!progress) return null;

        const {status, message, userRequest} = progress;
        switch (status) {
            case "pending":
                return (
                    <>
                        <Message message={{ role: "user", content: userRequest }} />
                        <Message message={{ role: "in_progress", content: "Connecting..." }} />
                    </>
                );
            case "in_progress":
                return (
                    <>
                        <Message message={{ role: "user", content: userRequest }} />
                        <Message message={{ role: "in_progress", content: ` ${message || "..."}` }} />
                        {/* <Message message={{ role: "in_progress", content: ` ${message || "..."} ${progress.progress || "-"}%` }} /> */}
                    </>
                );
            case "failed":
                return (
                    <>
                        <Message message={{ role: "failed", content: message || "Unknown error" }} />
                        <Button variant="danger" size="sm" onClick={() => sendMsg(userRequest)}>Retry</Button>
                        <Button variant="secondary" size="sm" onClick={() => setProgress(null)}>Cancel</Button>
                    </>
                );
            default:
                return null;
        }
    }

    // sets the scroll position to the bottom 
    // triggered by message rerender, or a request being sent 
    useEffect(() => {
        if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }, [messages, requestSendMsg]);

    // chat considered empty if there is no chat Id or no messages, errors, or running requests.
    const hasRunningRequest = progress && progress.status !== "completed";
    const isEmpty = !currentChatId || (!loading && !error && messages.length === 0 && !hasRunningRequest);
    return (
        <div className="chat-window-container">

            <header className="chat-window-header">
                <div className="d-flex d-sm-none">
                    <Button variant="outline-light" size="sm" className="custom-btn" onClick={() => setRequestNewChat?.(true)}>+ New Chat</Button>
                </div>

                <span className="chat-current-id">{currentChatName ? currentChatName : 'Start a conversation'}</span>

                <Button variant="outline-light" className="custom-btn" size="sm" onClick={() => setDarkMode(!darkMode)}>
                    {darkMode ? 'Light mode' : 'Dark mode'}
                </Button>
            </header>


            <div className={`chat-window ${isEmpty ? 'chat-window-empty' : ''}`} ref={messageListRef}>
                {isEmpty ? (
                <div className="chat-empty-state">
                    <h1>What would you like to explore?</h1>
                    <p>The answer to life, the universe and everything.</p>
                    <MessageBar onSend={(message) => sendMsg(message)} />
                </div>
                ) : (
                <div>
                    {messages && messages.map((message, index) => <Message key={`${currentChatId}-${index}`} message={message} />)}
                    
                    {renderProgressMessage()}

                    {loading && 
                        <div className="chat-status" role="status">
                            <Spinner animation="border" size="sm" />
                            <span> &nbsp;Loading... </span>
                        </div>}

                    {error && 
                        <div className="chat-error" role="alert">
                            <span>An error has occurred.</span>
                            <Button size="sm" variant="outline-secondary" onClick={() => setRetryCount((count) => count + 1)}>Retry</Button>
                        </div>}
                </div>
                )}
            </div>

            {!isEmpty && 
                <div className="chat-composer">
                    <MessageBar onSend={(message) => sendMsg(message)} disableSendButton={progress?.status === "in_progress"} />
                </div>}

        </div>
    );
}
