import express from 'express'; 
import chatHistoryRepository from '../repository/chatHistoryRepository.js';

// chat history:
// /chat/            GET-->get all chats    POST-->new chat --> res=id
// /chat/:chatID     DELETE-->del chat      PATCH--> rename
// /chat/:chatID/messages    GET-->get all [messages]     POST-->new message
// /chat/:chatID/messages/message   DELETE-->message by index 

const router = express.Router();

router.route("/")
    // get all chats as array of {_ids, names} 
    .get( async (req, res) => {
        const result = await chatHistoryRepository.getChats();
        res.status(result.length > 0 ? 200 : 204).json(result);
    })
    // create a new chat, name optional
    .post( async (req, res) => {
        const id = await chatHistoryRepository.create(req.body?.name);
        res.status(200).send(id);
    } );

router.route("/:id")
    // delete a chat by id 
    .delete( async (req, res) => {
        const {id} = req.params;
        const result = await chatHistoryRepository.deleteChat(id);
        res.sendStatus(200);
    })
    // rename a chat by id, cannot be blank          params: name,  checkNew: true --> rename only new chats
    .patch( async (req, res) => {
        if (!Object.hasOwn(req.body, 'name') || !req.body.name.trim()) return res.status(400).send("Field 'name' cannot be blank");
        await chatHistoryRepository.updateName(req.params.id, req.body.name, req.body?.checkNew);
        res.sendStatus(200);
    })

router.route("/:id/messages")
    // get a chat's messages
    .get( async (req, res) => {
        const {id} = req.params;
        const result = await chatHistoryRepository.getHistory(id);
        res.status(result.length > 0 ? 200 : 204).json(result);

    })
    // pushes a chat message into chat 
    .post( async (req, res) => {
        await chatHistoryRepository.addMessage(req.params.id, req.body?.role, req.body?.content);
        res.sendStatus(200);
    })

router.route("/:id/messages/:index")
    // deletes a message  (index is affected)
    .delete( async (req, res) => {
        const {id, index} = req.params;
        await chatHistoryRepository.deleteMessage(id, index);
        res.sendStatus(200);
    })

export default router;