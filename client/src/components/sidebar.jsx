import Button from 'react-bootstrap/Button';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css'
import './sidebar.css'



export default function Sidebar( {children, setRequestNewChat } ) {
    return (
        <>
            <div className="sidebar-header">
                <h1><em>DeepThought</em></h1>

                <hr></hr>

                <Button variant="outline-light" id="new-chat-button" className='custom-btn' onClick={() => setRequestNewChat(true)}>
                + New Chat 
                </Button>
            </div>

            <div className="sidebar-body">
                {children}
            </div>
        </>     
    );
}