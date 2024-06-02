import { ENetwork } from '@/libs/config';
import { ENavAction, EWalletAction } from '@/modules/bot/constants/bot-action.constant';
import { ExtendedSession, IContext } from '@/modules/bot/interfaces/bot-context.interface';
import { walletStage } from '@/modules/wallet/stages/wallet.stage';
import _ from 'lodash';
import { Context, Scenes, Telegram } from 'telegraf';
import { Update, UserFromGetMe } from 'telegraf/types';
import { Deunionize } from 'telegraf/typings/core/helpers/deunionize';
import { AppConfig } from '@/libs/config';

import * as walletQueries from '@/database/queries/wallet';
import { EScene } from '@/modules/bot/constants/bot-scene.constant';
import { populateWallets } from '../utils';

describe('Create wallet scene', function () {
  let scene: Scenes.WizardScene<IContext>;
  let ctx: Partial<IContext>;
  let sessionCtx: ExtendedSession;
  let sceneCtx: Partial<IContext['scene']>;

  let replySpy: jest.SpyInstance;
  let deleteMessageSpy: jest.SpyInstance;
  let createWalletsSpy: jest.SpyInstance;

  beforeEach(() => {
    // Create wallet scene
    scene = walletStage[2];

    sessionCtx = {
      prop: {
        chain: { network: ENetwork.Mainnet },
        wallets: populateWallets(),
      },
      user: { id: 1 },
    };
    sceneCtx = { session: { cursor: 0 }, state: {}, enter: jest.fn(), leave: jest.fn() };

    ctx = new Context({ message: 'message' } as unknown as Deunionize<Update>, {} as Telegram, {} as UserFromGetMe);
    ctx.session = sessionCtx as IContext['session'];
    ctx.scene = sceneCtx as IContext['scene'];

    replySpy = jest.spyOn(ctx, 'reply').mockImplementation(jest.fn());
    deleteMessageSpy = jest.spyOn(ctx, 'deleteMessage').mockImplementation(jest.fn());
    createWalletsSpy = jest.spyOn(walletQueries, 'createWallets').mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should ask for the number of wallets to create', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());
    expect(replySpy).toHaveBeenCalledWith('Select the number of wallets you want to create', {
      reply_markup: {
        inline_keyboard: [
          [{ callback_data: EWalletAction.CreateWallet_01, hide: false, text: '1' }],
          [{ callback_data: EWalletAction.CreateWallet_03, hide: false, text: '3' }],
          [{ callback_data: EWalletAction.CreateWallet_05, hide: false, text: '5' }],
          [{ callback_data: EWalletAction.CreateWallet_10, hide: false, text: '10' }],
          [{ callback_data: ENavAction.Cancel, hide: false, text: 'Cancel' }],
        ],
      },
    });
  });

  it('should create the number of wallets specified', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(1);
    replySpy.mockClear();

    // Select 3 wallets to create
    const update = { message: { text: '' }, callback_query: { data: EWalletAction.CreateWallet_03 } };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    const chainId = AppConfig[sessionCtx.prop.chain.network].chainId;

    expect(createWalletsSpy).toHaveBeenCalledWith(String(sessionCtx.user.id), [
      { address: expect.any(String), chainId, encryptedPrivateKey: expect.any(String) },
      { address: expect.any(String), chainId, encryptedPrivateKey: expect.any(String) },
      { address: expect.any(String), chainId, encryptedPrivateKey: expect.any(String) },
    ]);
    expect(replySpy.mock.calls[0][0]).toContain(`✅ **Wallets created!**\nDeposit ETH to these addresses:\n\`(0)`);
    expect(replySpy.mock.calls[1][0]).toContain(`Private keys:\n\`(0)`);
  });

  it('should be able to cancel the wallet creation process', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(1);
    replySpy.mockClear();

    // Cancel wallet creation
    const update = { message: { text: '' }, callback_query: { data: ENavAction.Cancel } };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    expect(deleteMessageSpy).toHaveBeenCalledTimes(1);
    expect(createWalletsSpy).not.toHaveBeenCalled();
    expect(replySpy).not.toHaveBeenCalled();
  });

  it('should be able to handle the /start command during the wallet creation process', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(1);
    replySpy.mockClear();

    // Cancel wallet creation
    const update = { message: { text: '/start' } };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    expect(deleteMessageSpy).not.toHaveBeenCalled();
    expect(createWalletsSpy).not.toHaveBeenCalled();
    expect(replySpy).not.toHaveBeenCalled();
    expect(sceneCtx.leave).toHaveBeenCalledTimes(1);
    expect(sceneCtx.enter).toHaveBeenCalledWith(EScene.MainNav, { msg: undefined });
  });
});
