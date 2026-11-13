import { useRef, useState } from 'react';
import Button from 'react-bootstrap/Button';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';
import './chatWindow.css';

export default function MessageBar({ onSend, disableSendButton }) {
    const [value, setValue] = useState('');     // user input 
    const textareaRef = useRef(null);

    const submit = (event) => {
        event.preventDefault();

        const message = value.trim();
        if (!message) return;

        onSend(message);
        setValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };



    return (
        <form className="chat-message-form" onSubmit={submit}>
            <textarea
                ref={textareaRef}
                placeholder="Type a message..."
                rows={1}
                value={value}
                onChange={(event) => { 
                    setValue(event.target.value); 
                    // resize(); 
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form.requestSubmit();
                    }
                }}
            />
            <Button variant="outline-light" type="submit" className="custom-btn" disabled={!value.trim() || disableSendButton}>Send</Button>
        </form>
    );
}
