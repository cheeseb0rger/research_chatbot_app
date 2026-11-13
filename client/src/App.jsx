import { useState } from 'react'

import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css'

import Sidebar from './components/sidebar.jsx';
import ChatTabsList from './components/chatTabsList.jsx';
import ChatWindow from './components/chatWindow.jsx';



export default function App() {

  const [ requestNewChat, setRequestNewChat] = useState(false);   // to request a new chat thru ChatTabList

  const [currentChatId, setCurrentChatId] = useState(null);   // to track/control the current active chat in ChatWindow
  const [currentChatName, setCurrentChatName] = useState(null);

  const [requestGetTabs, setRequestGetTabs] = useState(true);   // to reload chatTabList 


  return (
    <>
      <Container fluid>
        <Row>

          <Col sm={4} md={3} xl={2} id="sidebar" className="d-none d-sm-block">
            <Sidebar setRequestNewChat={setRequestNewChat}>
              <ChatTabsList 
                requestNewChat={requestNewChat}
                setRequestNewChat={setRequestNewChat}
                currentChatId={currentChatId}
                setCurrentChatId={setCurrentChatId}
                currentChatName={currentChatName}
                setCurrentChatName={setCurrentChatName}
                requestGetTabs={requestGetTabs}
                setRequestGetTabs={setRequestGetTabs}
                />
            </Sidebar>
          </Col>

          <Col sm={8} md={9} xl={10} id="main-window">
            <ChatWindow
              setRequestNewChat={setRequestNewChat}
              currentChatId={currentChatId}
              currentChatName={currentChatName}
              setRequestGetTabs={setRequestGetTabs}
            />
          </Col>

        </Row>
      </Container>
    </>
  )
}