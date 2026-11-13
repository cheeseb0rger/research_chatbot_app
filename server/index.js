import { connectDB, disconnectDB } from './src/db.js';
import chatRouter from './src/routes/chat.js';
import generateRouter from './src/routes/generate.js';
import logger from './src/logger.js';

import cors from 'cors';
import express from 'express';

const PORT = process.env.PORT || 3000;
const app = express();

const runtimeStart = Date.now();

await connectDB("test");

app.use(cors());
app.use(express.json());

// http logger middleware
app.use( (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode < 400) {
      if (req.originalUrl.split("/").at(-1) === "poll") return;
      logger.info({ method: req.method, url: req.originalUrl, statusCode: res.statusCode, durationMs: duration }, 'HTTP request completed');
    } else {
      logger.warn({ method: req.method, url: req.originalUrl, statusCode: res.statusCode, durationMs: duration }, 'HTTP request completed with error');
    }
  });

  next();
});

// routes 
app.use("/chat", chatRouter);
app.use("/generate", generateRouter);

// error handling middleware
app.use((err, req, res, next) => {
    logger.error({ err }, 'Server error');

    res.status(err.cause.errorCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});

const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server started');
});


const exitHandler = () => {
    logger.info({ runtimeMs: Date.now() - runtimeStart }, 'Shutting down server');
    disconnectDB().then(() => server.close()).then(() => process.exit(0));
}
process.on('SIGTERM', exitHandler);
process.on('SIGINT', exitHandler);
export {exitHandler, server};  // for testing
