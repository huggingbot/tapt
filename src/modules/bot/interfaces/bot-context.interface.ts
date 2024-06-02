import { Context, Scenes } from 'telegraf';
import type { Update } from 'telegraf/types';
import { User } from 'telegraf/typings/core/types/typegram';

import { ENetwork } from '@/libs/config';

import { ESessionProp } from '../constants/bot-prop.constant';

export interface SceneSession extends Scenes.WizardSessionData {
  // will be available under `ctx.scene.session.<prop>`
}

export type TWallet = { encryptedPrivateKey: string; address: string; chainId: number };

export interface ExtendedSession extends Scenes.WizardSession<SceneSession> {
  // will be available under `ctx.session.<prop>`
  prop: {
    [ESessionProp.Wallets]: {
      [ENetwork.Local]: TWallet[];
      [ENetwork.Mainnet]: TWallet[];
      [ENetwork.EthereumSepolia]: TWallet[];
      [ENetwork.Polygon]: TWallet[];
      [ENetwork.ZkLink]: TWallet[];
    };
    [ESessionProp.Chain]: { network: ENetwork };
  };
  user: Pick<User, 'id' | 'username'>;
}

export interface IContext extends Context<Update> {
  // will be available under `ctx.<prop>`, e.g. `ctx.session`, `ctx.wizard`
  session: ExtendedSession;
  scene: Scenes.SceneContextScene<IContext, SceneSession>;
  wizard: Scenes.WizardContextWizard<IContext> & { state: Record<string, unknown> };
}
