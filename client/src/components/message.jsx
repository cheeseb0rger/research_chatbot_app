import { useRef, useState } from 'react';
import Markdown from 'markdown-to-jsx';

import Spinner from 'react-bootstrap/Spinner'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Overlay from 'react-bootstrap/Overlay';
import Popover from 'react-bootstrap/Popover';  

import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';
import './chatWindow.css';


// creates button with popover for sources
function Ref({ title, url, source, refId }){
    if (!url) return `*[${source || refId}]`;

    const [show, setShow] = useState(false);
    const target = useRef(null);

    const popover = (
        <Popover>
            <Popover.Header as="h3">{source || title || "source"}</Popover.Header>
            <Popover.Body>
                <p><strong>"{title || "untitled"}"</strong> (<a href={url} target="_blank">{source || "source"}</a>).</p>
                <p>{refId}</p>
            </Popover.Body>
        </Popover>
    );

    return (
        <>
            <button className={`chat-message-source ${show ? 'active' : ''}`} ref={target} onClick={() => setShow(!show)} onBlur={() => setShow(false)}>{source || title || "source"}</button>
            <Overlay
                target={target.current}
                placement="right"
                delay={{ show: 250, hide: 400 }}
                show={show}
            >
                {popover}
            </Overlay>
        </>
    )
}

export default function Message({ message }) {
    
    // helper, renders the content of a message based on its role
    const renderMessageContent = () => {
        switch (message.role) {
            case 'user':
                return message.content;
            case 'assistant':
                return <Markdown options={{ overrides: { Ref } }}>{message.content}</Markdown>;
            case 'in_progress':
                return (
                    <>
                        <Spinner animation="grow" size="sm" />
                        <span>{message.content}</span>
                    </> );
            case 'failed':
                return (
                    <>
                        <p>An error occurred: </p> 
                        <span className="limit-by-lines" style={{ color: "red" }}>{message.content}</span>
                    </>);
            default:
                return null;
        }
    };
    
    const isUser = message.role === 'user';
    return (
        <article className={`chat-message ${isUser ? 'chat-message-user' : ''}`}>
            <div className="chat-message-role">{isUser ? 'You' : 'Assistant'}</div>
            <div className="chat-message-content">
                {renderMessageContent()}
            </div>
        </article>
    );
}
