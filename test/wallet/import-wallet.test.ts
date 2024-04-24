import { AppConfig, ENetwork } from '@/libs/config';
import { ExtendedSession, IContext } from '@/modules/bot/interfaces/bot-context.interface';
import { walletStage } from '@/modules/wallet/stages/wallet.stage';
import _ from 'lodash';
import { Context, Scenes, Telegram } from 'telegraf';
import { Update, UserFromGetMe } from 'telegraf/types';
import { Deunionize } from 'telegraf/typings/core/helpers/deunionize';

import * as walletQueries from '@/database/queries/wallet';

describe('Import wallet scene', function () {
  let scene: Scenes.WizardScene<IContext>;
  let ctx: Partial<IContext>;
  let sessionCtx: ExtendedSession;
  let sceneCtx: Partial<IContext['scene']>;

  let replySpy: jest.SpyInstance;
  let createWalletsSpy: jest.SpyInstance;

  beforeEach(() => {
    // Import wallet scene
    scene = walletStage[3];

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

  it('should ask for the wallets to be imported', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());
    expect(replySpy).toHaveBeenCalledWith('Enter private keys separated by comma', { reply_markup: { force_reply: true } });
  });

  it('should import the wallets specified', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(1);
    replySpy.mockClear();

    // Import 2 private keys
    const update = {
      message: {
        text: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80,0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        reply_to_message: {},
      },
    };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    const chainId = AppConfig[sessionCtx.prop.chain.network].chainId;

    expect(createWalletsSpy).toHaveBeenCalledWith(String(sessionCtx.user.id), [
      { address: expect.any(String), chainId, encryptedPrivateKey: expect.any(String) },
      { address: expect.any(String), chainId, encryptedPrivateKey: expect.any(String) },
    ]);
    expect(replySpy.mock.calls[0][0]).toContain(`✅ **Wallets imported!**\n\`0x`);
  });

  it('should not import any wallets for any invalid private keys', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(1);
    replySpy.mockClear();

    // Import 1 private key and 1 address
    const update = {
      message: {
        text: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80,0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        reply_to_message: {},
      },
    };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    const chainId = AppConfig[sessionCtx.prop.chain.network].chainId;

    expect(createWalletsSpy).not.toHaveBeenCalled();
    expect(replySpy.mock.calls[0][0]).toEqual('Invalid private key(s)');
  });
});
