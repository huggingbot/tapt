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

describe('Wallet nav scene', function () {
  let scene: Scenes.WizardScene<IContext>;
  let ctx: Partial<IContext>;
  let sessionCtx: ExtendedSession;
  let sceneCtx: Partial<IContext['scene']>;

  let replySpy: jest.SpyInstance;
  let editMsgSpy: jest.SpyInstance;

  beforeEach(() => {
    // Wallet nav scene
    scene = navStage[1];

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

  it('should show the wallet navigation', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledWith('Manage wallets', {
      reply_markup: {
        inline_keyboard: [
          [{ callback_data: ENavAction.WalletCount, hide: false, text: ENavAction.WalletCount }],
          [{ callback_data: ENavAction.WalletList, hide: false, text: ENavAction.WalletList }],
          [{ callback_data: ENavAction.WalletCreate, hide: false, text: ENavAction.WalletCreate }],
          [{ callback_data: ENavAction.WalletImport, hide: false, text: ENavAction.WalletImport }],
          [{ callback_data: ENavAction.Back, hide: false, text: ENavAction.Back }],
        ],
      },
    });
  });

  test.each`
    action                     | expectedScene
    ${ENavAction.WalletCount}  | ${EScene.CountWallet}
    ${ENavAction.WalletList}   | ${EScene.ListWallet}
    ${ENavAction.WalletCreate} | ${EScene.CreateWallet}
    ${ENavAction.WalletImport} | ${EScene.ImportWallet}
    ${ENavAction.Back}         | ${EScene.MainNav}
  `('should navigate to the $expectedScene scene when action is $action', async ({ action, expectedScene }) => {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(1);
    replySpy.mockClear();

    const update = { message: { text: '' }, callback_query: { data: action } };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    expect(replySpy).not.toHaveBeenCalled();
    expect(sceneCtx.leave).toHaveBeenCalledTimes(1);
    expect(sceneCtx.enter).toHaveBeenCalledWith(expectedScene, { msg: undefined });
  });

  it('should edit inline keyboard to the wallet nav when there is a message state', async function () {
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
        [{ callback_data: ENavAction.WalletCount, text: ENavAction.WalletCount }],
        [{ callback_data: ENavAction.WalletList, text: ENavAction.WalletList }],
        [{ callback_data: ENavAction.WalletCreate, text: ENavAction.WalletCreate }],
        [{ callback_data: ENavAction.WalletImport, text: ENavAction.WalletImport }],
        [{ callback_data: ENavAction.Back, text: ENavAction.Back }],
      ],
    });
  });
});
