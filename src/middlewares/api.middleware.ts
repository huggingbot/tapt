import express from 'express';
import uuid4 from 'uuid4';

const apiMiddlewareRouter = express.Router();

apiMiddlewareRouter.use((req, _, next) => {
  const ipAddress = req.headers && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']) : req.ip;
  req.context = {
    requestId: uuid4(),
    sourceIp: ipAddress || 'undefined',
  };
  next();
});

export default apiMiddlewareRouter;
