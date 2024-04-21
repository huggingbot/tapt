import { Composer } from 'telegraf';

import { EScene } from '../bot/constants/bot-scene.constant';
import { IContext } from '../bot/interfaces/bot-context.interface';
import { BaseService } from '../common';

export class NavService extends BaseService {
  private composer: Composer<IContext>;

  constructor() {
    super('NavigationService');
    this.composer = new Composer();
  }

  get module(): Composer<IContext> {
    return this.composer;
  }

  async init(): Promise<void> {
    this.composer.start((ctx) => {
      ctx.scene.enter(EScene.MainNav);
    });
  }
}
