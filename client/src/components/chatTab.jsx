import { useState, useEffect, useRef } from 'react'
import Dropdown from 'react-bootstrap/Dropdown';
import './chatTab.css';

export default function ChatTab({ id, name, isActive, onClick, selectedDropdown, setSelectedDropdown, onRename, onDelete }) {
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);
    
    const handleRenameSubmit = () => {
        if (inputRef.current?.value.trim() !== name) {
            onRename(inputRef.current?.value.trim());
        }
        setIsEditing(false);
    };

    const handleDropdownToggle = (isOpen) => {
        if (isOpen) {
            requestAnimationFrame(() => {
                window.dispatchEvent(new Event("resize"));    // fixes bug where the dropdown menu is positioned incorrectly
            });
            setSelectedDropdown(id);
        } else {
            setSelectedDropdown(null);
        }
    };

    // focus on input field when editing
    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
        }
    }, [isEditing]);


    return (
        <div className={`chat-tab ${isActive ? 'active' : ''}`} onClick={onClick} role="button" tabIndex={0}>
            {isEditing ? (
                <input
                    type="text"
                    className="chat-tab-name"
                    defaultValue={name}
                    ref={inputRef}
                    onBlur={handleRenameSubmit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit();
                        if (e.key === 'Escape') setIsEditing(false);
                    }}
                /> 
            ) : (
                <span className="chat-tab-name">
                    {name}
                </span>
            )} 

            <Dropdown 
                className="chat-tab-dropdown" size="sm" drop="end" 
                onClick={(e) => e.stopPropagation()}
                onToggle={handleDropdownToggle}
                show={selectedDropdown === id} 
            >
                <Dropdown.Toggle id="dropdown-button">
                    ⋮
                </Dropdown.Toggle>

                <Dropdown.Menu popperConfig={{strategy: "fixed"}}>
                    <Dropdown.Item onClick={() => setIsEditing(true)}>
                        Rename
                    </Dropdown.Item>
                    <Dropdown.Item onClick={onDelete} style={{ color: '#FF5733' }}>
                        Delete
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>
        </div>
    );
}