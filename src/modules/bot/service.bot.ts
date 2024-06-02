import { Agent } from 'node:https';

import _ from 'lodash';
import { Scenes, session, Telegraf } from 'telegraf';

import { createUser, getUserWithWallets } from '@/database/queries/user';
import { AppConfig, ENetwork } from '@/libs/config';

import { telegrafClient } from '../../database/redis';
import { bridgeStage } from '../bridge';
import { chainStage } from '../chain';
import { BaseService } from '../common';
import { fundingStage } from '../funding';
import { NavService, navStage } from '../navigation';
import { swapStage } from '../swap';
import { walletStage } from '../wallet';
import { ESessionProp } from './constants/bot-prop.constant';
import { ExtendedSession, IContext } from './interfaces/bot-context.interface';

export class BotService extends BaseService {
  private bot: Telegraf<IContext>;

  constructor() {
    super('BotService');
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN as string, {
      telegram: { agent: new Agent({ keepAlive: true, family: 4 }), webhookReply: false },
    });
  }

  async init(): Promise<void> {
    this.bot.use(session({ store: telegrafClient }));
    this.bot.use(async (ctx, next) => {
      ctx.session = await this.loadSession(ctx);
      return next();
    });

    const stages = [...navStage, ...walletStage, ...fundingStage, ...swapStage, ...bridgeStage, ...chainStage];
    const mainStage = new Scenes.Stage(stages);
    this.bot.use(mainStage.middleware());

    const nav = new NavService();
    await nav.init();

    const services = [nav];
    this.bot.use(...services.map((service) => service.module.middleware()));

    void this.bot.launch();
  }

  async createWebhook(): ReturnType<typeof this.bot.createWebhook> {
    return this.bot.createWebhook({ domain: `${process.env.BASE_URL}/webhooks/bot` });
  }

  private getDefaultSession(): ExtendedSession {
    return {
      prop: {
        [ESessionProp.Wallets]: {
          [ENetwork.Local]: [],
          [ENetwork.Mainnet]: [],
          [ENetwork.EthereumSepolia]: [],
          [ENetwork.Polygon]: [],
          [ENetwork.ZkLink]: [],
        },
        [ESessionProp.Chain]: { network: ENetwork.Mainnet },
      },
      user: { id: 0, username: '' },
    };
  }

  private async loadSession(ctx: IContext): Promise<ExtendedSession> {
    if (ctx.session && ctx.session.prop && ctx.session.user) {
      // Read from cache
      return ctx.session;
    }
    const defaultSession = this.getDefaultSession();

    if (ctx.from?.id && ctx.from?.username) {
      // Read from database
      const telegramId = String(ctx.from.id);
      const network = defaultSession.prop[ESessionProp.Chain].network;
      const chainId = AppConfig[network].chainId;

      let userWithWallets = await getUserWithWallets(telegramId, chainId);

      if (!userWithWallets) {
        const user = await createUser(telegramId, ctx.from.username);
        userWithWallets = { ...user, wallets: [] };
      }
      return _.merge(defaultSession, {
        prop: {
          [ESessionProp.Wallets]: { [network]: userWithWallets.wallets },
          [ESessionProp.Chain]: { network },
        },
        user: { id: Number(userWithWallets.telegramId), username: userWithWallets.username },
      } as ExtendedSession);
    }
    throw new Error('Invalid session');
  }
}
