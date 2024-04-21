import { IAppContext } from '.';

declare global {
  namespace Express {
    export interface Request {
      context: IAppContext;
    }
  }
}
