import pino from 'pino';

const logger = pino({
    level: 'debug',  // debug / info / warn
    base: undefined,
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
        },
    },
});

export default logger;
