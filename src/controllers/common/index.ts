import express from 'express';
import log from 'loglevel';

export interface IBaseControllerOptions {}

interface ILogContext {
  request: {
    params: unknown;
    query: unknown;
    body: unknown;
  };
  metadata: {
    requestId: string;
    sourceIp: string;
  };
  data: unknown;
}

export class BaseController {
  protected name: string;
  protected options: IBaseControllerOptions;

  public constructor(name: string, options?: IBaseControllerOptions) {
    this.name = name;
    this.options = options || {};
  }

  protected logSuccess(req: express.Request, metadata?: unknown): void {
    log.info(`[SUCCESS] ${this.name}`, this.generateLogContext(req, metadata));
  }

  protected logFailure(req: express.Request, metadata?: unknown): void {
    log.error(`[FAILURE] ${this.name}`, this.generateLogContext(req, metadata));
  }

  protected generateLogContext(req: express.Request, metadata?: unknown): ILogContext {
    return {
      request: {
        params: req.params,
        query: req.query,
        body: req.body,
      },
      metadata: {
        requestId: req.context.requestId,
        sourceIp: req.context.sourceIp,
      },
      data: metadata,
    };
  }
}
