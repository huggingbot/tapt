import compression from 'compression';
import dotenv from 'dotenv';
import express, { ErrorRequestHandler, RequestHandler } from 'express';
import helmet from 'helmet';
import { Server } from 'http';
import log from 'loglevel';
import morgan from 'morgan';
import path from 'path';

const envPath = path.resolve('.', '.env');

dotenv.config({
  path: envPath,
});

import apiMiddlewareRouter from './middlewares/api.middleware';
import { BotService } from './modules/bot';
import routes from './routes';
import defaultRoutes from './routes/default';

const nodeEnv = process.env.NODE_ENV || 'development';

export const startServer = async (): Promise<void> => {
  log.setLevel((process.env.LOG_LEVEL as log.LogLevelDesc) || 'INFO');

  const app = express();
  const http = new Server(app);

  const bot = new BotService();
  await bot.init();

  if (nodeEnv !== 'development') {
    const webhook = await bot.createWebhook();
    app.use(webhook as RequestHandler);
  }

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(morgan('tiny')); // http logging
  app.use(compression()); // compresses response
  app.use(helmet()); // adds http headers
  app.use(express.urlencoded({ extended: false })); // parses body
  app.use(express.json()); // parses json

  app.use('/', defaultRoutes);
  app.use('/api', apiMiddlewareRouter);
  app.use('/api', routes);

  app.use(((err, _req, res) => {
    if (err instanceof Error) {
      log.error(err.stack);
    }
    res.status(500).send('Something went wrong.');
  }) as ErrorRequestHandler);

  const port = process.env.PORT || 4040;

  http.listen(port, () => {
    log.info(`Node env: ${nodeEnv}`);
    log.info(`Server running on port: ${port}`);
  });
};
