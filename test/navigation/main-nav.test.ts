import { ENetwork } from '@/libs/config';
import { ExtendedSession, IContext } from '@/modules/bot/interfaces/bot-context.interface';
import { navStage } from '@/modules/navigation/stages/nav.stage';
import _ from 'lodash';
import { Context, Scenes, Telegram } from 'telegraf';
import { Update, UserFromGetMe } from 'telegraf/types';
import { Deunionize } from 'telegraf/typings/core/helpers/deunionize';

import * as walletQueries from '@/database/queries/wallet';
import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EScene } from '@/modules/bot/constants/bot-scene.constant';

describe('Main nav scene', function () {
  let scene: Scenes.WizardScene<IContext>;
  let ctx: Partial<IContext>;
  let sessionCtx: ExtendedSession;
  let sceneCtx: Partial<IContext['scene']>;

  let replySpy: jest.SpyInstance;
  let createWalletsSpy: jest.SpyInstance;

  beforeEach(() => {
    // Main nav scene
    scene = navStage[0];

    sessionCtx = {
      prop: {
        chain: { network: ENetwork.Mainnet },
        wallets: { [ENetwork.Local]: [], [ENetwork.Mainnet]: [], [ENetwork.Polygon]: [] },
      },
      user: { id: 1 },
    };
    sceneCtx = { session: { cursor: 0 }, state: {}, enter: jest.fn(), leave: jest.fn() };

    ctx = new Context({ message: 'message' } as unknown as Deunionize<Update>, {} as Telegram, {} as UserFromGetMe);
    ctx.session = sessionCtx as IContext['session'];
    ctx.scene = sceneCtx as IContext['scene'];

    replySpy = jest.spyOn(ctx, 'reply').mockImplementation(jest.fn());
    createWalletsSpy = jest.spyOn(walletQueries, 'createWallets').mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should show the module navigation', async function () {
    const update = { message: { text: '/start' } };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledWith('Manage TAPT', {
      reply_markup: {
        inline_keyboard: [
          [{ callback_data: ENavAction.Wallet, hide: false, text: ENavAction.Wallet }],
          [{ callback_data: ENavAction.Funding, hide: false, text: ENavAction.Funding }],
          [{ callback_data: ENavAction.Swap, hide: false, text: ENavAction.Swap }],
          [{ callback_data: ENavAction.Chain, hide: false, text: ENavAction.Chain }],
        ],
      },
    });
  });

  test.each`
    moduleNav            | action
    ${EScene.WalletNav}  | ${ENavAction.Wallet}
    ${EScene.FundingNav} | ${ENavAction.Funding}
    ${EScene.SwapNav}    | ${ENavAction.Swap}
    ${EScene.ChainNav}   | ${ENavAction.Chain}
  `('should navigate to the $moduleNav navigation', async ({ moduleNav, action }) => {
    const update1 = { message: { text: '/start' } };
    const updatedCtx1 = _.merge(_.cloneDeep(ctx), { update: update1 });
    await scene.middleware()(updatedCtx1 as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(1);
    replySpy.mockClear();

    const update2 = { message: { text: '' }, callback_query: { data: action } };
    const updatedCtx2 = _.merge(_.cloneDeep(updatedCtx1), { update: update2 });
    await scene.middleware()(updatedCtx2 as IContext, jest.fn());

    expect(replySpy).not.toHaveBeenCalled();
    expect(sceneCtx.leave).toHaveBeenCalledTimes(1);
    expect(sceneCtx.enter).toHaveBeenCalledWith(moduleNav, { msg: undefined });
  });
});
