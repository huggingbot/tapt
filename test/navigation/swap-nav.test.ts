import { ENetwork } from '@/libs/config';
import { ExtendedSession, IContext } from '@/modules/bot/interfaces/bot-context.interface';
import { navStage } from '@/modules/navigation/stages/nav.stage';
import _ from 'lodash';
import { Context, Scenes, Telegram } from 'telegraf';
import { Update, UserFromGetMe } from 'telegraf/types';
import { Deunionize } from 'telegraf/typings/core/helpers/deunionize';

import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { EScene } from '@/modules/bot/constants/bot-scene.constant';
import { populateWallets } from '../utils';

describe('Swap nav scene', function () {
  let scene: Scenes.WizardScene<IContext>;
  let ctx: Partial<IContext>;
  let sessionCtx: ExtendedSession;
  let sceneCtx: Partial<IContext['scene']>;

  let replySpy: jest.SpyInstance;
  let editMsgSpy: jest.SpyInstance;

  beforeEach(() => {
    // Swap nav scene
    scene = navStage[3];

    sessionCtx = {
      prop: {
        chain: { network: ENetwork.Mainnet },
        wallets: populateWallets(),
      },
      user: { id: 1 },
    };
    sceneCtx = { session: { cursor: 0 }, state: {}, enter: jest.fn(), leave: jest.fn() };

    ctx = new Context(
      { message: 'message' } as unknown as Deunionize<Update>,
      { editMessageReplyMarkup: jest.fn() } as unknown as Telegram,
      {} as UserFromGetMe,
    );
    ctx.session = sessionCtx as IContext['session'];
    ctx.scene = sceneCtx as IContext['scene'];

    replySpy = jest.spyOn(ctx, 'reply').mockImplementation(jest.fn());
    editMsgSpy = jest.spyOn(ctx.telegram!, 'editMessageReplyMarkup');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should show the swap navigation', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledWith('Manage swaps', {
      reply_markup: {
        inline_keyboard: [
          [{ callback_data: ENavAction.GetSwapToken, hide: false, text: 'Swap tokens' }],
          [{ callback_data: ENavAction.Back, hide: false, text: ENavAction.Back }],
        ],
      },
    });
  });

  test.each`
    action                     | scenario                 | expectedScene
    ${ENavAction.GetSwapToken} | ${'wallets not created'} | ${EScene.MainNav}
    ${ENavAction.GetSwapToken} | ${'wallets created'}     | ${EScene.GetSwapToken}
    ${ENavAction.Back}         | ${null}                  | ${EScene.MainNav}
  `('should navigate to the $expectedScene scene when action is $action and scenario is "$scenario"', async ({ action, expectedScene, scenario }) => {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(1);
    replySpy.mockClear();

    if (scenario === 'wallets created') {
      sessionCtx.prop.wallets[ENetwork.Mainnet].push({ encryptedPrivateKey: 'encryptedPrivateKey', address: 'address', chainId: 1 });
    }

    const update = { message: { text: '' }, callback_query: { data: action } };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    if (scenario === 'wallets not created') {
      expect(replySpy).toHaveBeenCalledWith('You need to create a wallet first');
    } else {
      expect(replySpy).not.toHaveBeenCalled();
    }
    expect(sceneCtx.leave).toHaveBeenCalledTimes(1);
    expect(sceneCtx.enter).toHaveBeenCalledWith(expectedScene, { msg: undefined });
  });

  it('should edit inline keyboard to the swap nav when there is a message state', async function () {
    const message_id = 1;
    const chat = { id: 1 };
    sceneCtx.state = { [EWizardProp.Msg]: { chat, message_id, reply_markup: { inline_keyboard: [] } } };

    const update = { message: { text: '' } };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    expect(replySpy).not.toHaveBeenCalled();
    expect(sceneCtx.leave).not.toHaveBeenCalled();
    expect(sceneCtx.enter).not.toHaveBeenCalled();
    expect(editMsgSpy).toHaveBeenCalledWith(chat.id, message_id, undefined, {
      inline_keyboard: [
        [{ callback_data: ENavAction.GetSwapToken, text: 'Swap tokens' }],
        [{ callback_data: ENavAction.Back, text: ENavAction.Back }],
      ],
    });
  });
});
