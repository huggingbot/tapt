export interface IBaseServiceOptions {}

export class BaseService {
  protected name: string;
  protected options: IBaseServiceOptions;

  public constructor(name: string, options?: IBaseServiceOptions) {
    this.name = name;
    this.options = options ?? {};
  }
}
