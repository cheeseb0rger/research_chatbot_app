import express from 'express';
import { generateResponseLoop } from "../service/ai-service.js";
import chatHistoryRepository from '../repository/chatHistoryRepository.js';
import logger from '../logger.js';

const router = express.Router();

// taskId : {status, progress, message, userRequest}
// status = "in_progress" | "completed" | "failed"                                 
const taskMap = new Map();

// starts report generation task, and immediately responds with status.  
// once finished, taskMap and db is updated 
// userRequest:str  
router.post("/:id/request", async (req, res) => {
    const { id } = req.params;
    const {userRequest} = req.body;
    
    // create task
    if (taskMap.get(id)?.status === "in_progress") return res.status(400).send("Task already in progress");
    const task = { status: "in_progress", progress: 0, message: "loading...", userRequest };
    taskMap.set(id, task);
    
    await chatHistoryRepository.updateDate(id); 
    const history = await chatHistoryRepository.getHistory(id);

    generateResponseLoop(userRequest, history, task)
        .then(async (report) => {
            await chatHistoryRepository.addMessage(id, "user", userRequest);
            await chatHistoryRepository.addMessage(id, "assistant", report);

            const [ , title] = report.match(/^#{1,2}\s(.+?)\n/m) || [];   // get title for md format
            if (title) await chatHistoryRepository.updateName(id, title, true);

            task.status = "completed";
        }).catch((error) => {
            logger.error({ err: error }, 'Report generation failed');
            task.status = "failed";
            task.message = error.message;
        });

    res.sendStatus(200);
})

// get task 
router.get("/:id/poll", async (req, res) => {
    const { id } = req.params;
    const task = taskMap.get(id);

    if (!task) return res.sendStatus(204);
    res.status(200).json(task);
});


export default router;
