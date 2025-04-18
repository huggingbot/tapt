import { walletStage } from '@/modules/wallet/stages/wallet.stage';
import { ExtendedSession, IContext } from '@/modules/bot/interfaces/bot-context.interface';
import { Context, Scenes, Telegram } from 'telegraf';
import { AppConfig, ENetwork } from '@/libs/config';
import { Deunionize } from 'telegraf/typings/core/helpers/deunionize';
import { Update, UserFromGetMe } from 'telegraf/types';
import { Wallet } from 'ethers';
import { encryptPrivateKey } from '@/utils/crypto';

describe('List wallet scene', function () {
  let scene: Scenes.WizardScene<IContext>;
  let ctx: Partial<IContext>;
  let sessionCtx: Omit<ExtendedSession, 'user'>;
  let sceneCtx: Partial<IContext['scene']>;

  beforeEach(() => {
    // List wallet scene
    scene = walletStage[1];

    sessionCtx = {
      prop: {
        chain: { network: ENetwork.Mainnet },
        wallets: { [ENetwork.Local]: [], [ENetwork.Mainnet]: [], [ENetwork.Polygon]: [] },
      },
    };
    sceneCtx = { session: { cursor: 0 }, state: {}, enter: jest.fn(), leave: jest.fn() };

    ctx = new Context({ message: 'message' } as unknown as Deunionize<Update>, {} as Telegram, {} as UserFromGetMe);
    ctx.session = sessionCtx as IContext['session'];
    ctx.scene = sceneCtx as IContext['scene'];
    ctx.reply = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should not list any wallets by default', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());
    expect(ctx.reply).toHaveBeenCalledWith('You have no wallets');
  });

  it('should list wallets present in the current chain', async function () {
    const walletCount = 3;
    const network = ENetwork.Mainnet;
    sessionCtx.prop.chain.network = network;

    for (let i = 0; i < walletCount; i++) {
      const wallet = Wallet.createRandom();
      const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey);
      sessionCtx.prop.wallets[network].push({
        encryptedPrivateKey,
        address: wallet.address,
        chainId: AppConfig[network].chainId,
      });
    }

    await scene.middleware()(ctx as IContext, jest.fn());

    const wallets = sessionCtx.prop.wallets[network].map((wallet) => wallet.address).join('\n');
    expect(ctx.reply).toHaveBeenCalledWith(`Your wallets are:\n${wallets}`);
  });

  it('should list no wallets present in another chain', async function () {
    const network = ENetwork.Mainnet;
    sessionCtx.prop.chain.network = ENetwork.Polygon; // Different chain

    const wallet = Wallet.createRandom();
    const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey);
    sessionCtx.prop.wallets[network].push({ encryptedPrivateKey, address: wallet.address, chainId: AppConfig[network].chainId });

    await scene.middleware()(ctx as IContext, jest.fn());
    expect(ctx.reply).toHaveBeenCalledWith('You have no wallets');
  });
});
