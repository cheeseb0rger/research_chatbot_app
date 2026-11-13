import { useEffect, useState } from 'react';
import { Spinner, Button} from 'react-bootstrap';
import ChatTab from './chatTab';
import './chatTab.css';
import axios from 'axios';

const URL = "http://localhost:3000";

// requestNewChat, setRequestNewChat - used by other componets to request a new chat, which is handled here 
// currentChatId, setCurrentChatId - controls active chat in the main chat window 
// requestGetTabs, setRequestGetTabs - used by other components to request a reload of this component 
export default function ChatTabsList( {requestNewChat, setRequestNewChat, currentChatId, setCurrentChatId, currentChatName, setCurrentChatName, requestGetTabs, setRequestGetTabs } ) {
    const [tabs, setTabs] = useState([]);   // array of chats as {_id, name, createdAt, updatedAt} sorted by 'updatedAt'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [selectedDropdown, setSelectedDropdown] = useState(null);     // tracks id of the chat tab with an open dropdown menu

    // get tabs from server, triggered by requestGetTabs=true
    useEffect(() => {
        if (!requestGetTabs) return;


        setRequestGetTabs(false);
        setLoading(true);
        setError(false);
        
        console.log("Fetching chat tabs from server");
        
        axios.get(`${URL}/chat/`)
            .then((response) => {
                setTabs(response.data);
            })
            .catch((error) => {
                console.error("Error fetching chat tabs:", error);
                setError(true);
            })
            .finally(() => { 
                setLoading(false);
            });
        
    }, [requestGetTabs]);

    // handle renaming 
    const handleTabRename = (tab, newName) => {
        console.log("Renaming tab " + tab._id + " to " + newName);

        if (!newName.trim()) return;
        
        setLoading(true);
        axios.patch(`${URL}/chat/${tab._id}`, { name: newName, checkNew: false })
        .then(() => {
            console.log("Tab renamed successfully");
            if (currentChatId === tab._id) setCurrentChatName(newName);
            // setTabs(tabs.map(t => t._id === tab._id ? { ...t, name: newName } : t));
        })
        .catch((error) => {
            console.error("Error renaming chat tab:", error);
        })
        .finally(() => {
            setRequestGetTabs(true);
        });
    }

    // handle deleting
    const handleTabDelete = (tab) => {
        console.log("Deleting tab " + tab._id);

        setLoading(true);
        axios.delete(`${URL}/chat/${tab._id}`)
            .then(() => {
                console.log("Tab deleted successfully");
                // setTabs(tabs.filter(t => t._id !== tab._id));
                if (currentChatId === tab._id) {
                    setCurrentChatId(null);
                    setCurrentChatName(null);
                }
            })
            .catch((error) => {
                console.error("Error deleting chat tab:", error);
            })
            .finally(() => {
                setRequestGetTabs(true);
            });
    } 

    // handle creating a new chat, called whenever requestNewChat is true
    const handleNewChat = () => {
        console.log("Creating a new chat");

        setLoading(true);
        axios.post(`${URL}/chat/`)
            .then((response) => {
                console.log("New chat created successfully");
                
                setCurrentChatId(response.data);
                setCurrentChatName("New chat");
            })
            .catch((error) => {
                console.error("Error creating new chat:", error);
            }).finally(() => {
                setRequestGetTabs(true);
            });
    };
    useEffect(() => {
        if (requestNewChat) {
            handleNewChat();
            setRequestNewChat(false);
        }
    }, [requestNewChat]);

    return (
        <>
            <div className={`chat-tab-container ${loading ? "loading-state" : ""}`}>
                {loading && (
                    <div className="loading-overlay">
                        <Spinner animation="border" />
                        <p>Loading...</p>
                    </div>
                )}
                {error && (
                    <div className="loading-overlay">
                        <p>Failed to load.</p>
                        
                        <Button size="sm" variant="outline-secondary" onClick={() => setRequestGetTabs(true)}>Retry</Button>
                    </div>
                )}
                {tabs.map(tab => (
                    <ChatTab
                        key={tab._id}
                        id={tab._id}
                        name={tab.name}
                        isActive={currentChatId === tab._id}
                        onClick={() => {
                            console.log("clicked:" + JSON.stringify(tab));
                            setCurrentChatId(tab._id);
                            setCurrentChatName(tab.name);
                        }}
                        selectedDropdown={selectedDropdown}
                        setSelectedDropdown={setSelectedDropdown}
                        onRename={(newName) => handleTabRename(tab, newName)}
                        onDelete={() => handleTabDelete(tab)}
                    />
                ))}
            </div>
        </>
    );

}