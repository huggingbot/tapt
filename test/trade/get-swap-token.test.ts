import { ENetwork } from '@/libs/config';
import { getProvider } from '@/libs/providers';
import { computeTokenPriceInUSD } from '@/libs/quoting';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { EScene } from '@/modules/bot/constants/bot-scene.constant';
import { ExtendedSession, IContext } from '@/modules/bot/interfaces/bot-context.interface';
import { tradeStage } from '@/modules/trade/stages/trade.stage';
import { Contract } from 'ethers';
import _ from 'lodash';
import { Context, Scenes, Telegram } from 'telegraf';
import { Update, UserFromGetMe } from 'telegraf/types';
import { Deunionize } from 'telegraf/typings/core/helpers/deunionize';
import { populateWallets } from '../utils';

jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  ethers: {
    ...jest.requireActual('ethers').ethers,
    providers: {
      JsonRpcProvider: jest.fn(),
    },
  },
  Contract: jest.fn(),
}));

jest.mock('@/libs/providers', () => ({
  getProvider: jest.fn(),
}));

jest.mock('@/libs/quoting', () => ({
  computeTokenPriceInUSD: jest.fn(),
}));

describe('Get swap token scene', function () {
  let scene: Scenes.WizardScene<IContext>;
  let ctx: Partial<IContext>;
  let sessionCtx: Omit<ExtendedSession, 'user'>;
  let sceneCtx: Partial<IContext['scene']>;

  let replySpy: jest.SpyInstance;

  beforeEach(() => {
    // Get swap token scene
    scene = tradeStage[0];

    sessionCtx = {
      prop: {
        chain: { network: ENetwork.Mainnet },
        wallets: populateWallets(),
      },
    };
    sceneCtx = { session: { cursor: 0 }, state: {}, enter: jest.fn(), leave: jest.fn() };

    ctx = new Context({ message: 'message' } as unknown as Deunionize<Update>, {} as Telegram, {} as UserFromGetMe);
    ctx.session = sessionCtx as IContext['session'];
    ctx.scene = sceneCtx as IContext['scene'];

    replySpy = jest.spyOn(ctx, 'reply').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it('should ask for token contract to begin buy and sell', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());
    expect(ctx.reply).toHaveBeenCalledWith('Enter token contract to begin buy and sell', { reply_markup: { force_reply: true } });
  });

  it('should do nothing if there is no reply message', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(1);
    replySpy.mockClear();

    const update = { message: { text: 'hello world' } };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    expect(replySpy).not.toHaveBeenCalled();
  });

  it('should reply if reply message is not an address', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(1);
    replySpy.mockClear();

    const update = {
      message: {
        text: 'this is a fake address',
        reply_to_message: {},
      },
    };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledWith('Address is not valid');
  });

  it('should reply if reply message is not a contract address', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(1);
    replySpy.mockClear();

    (getProvider as jest.Mock).mockImplementationOnce(() => ({
      // resolve to non-contract code
      getCode: jest.fn().mockResolvedValueOnce('0x'),
    }));

    (Contract as unknown as jest.Mock).mockImplementationOnce(() => ({
      name: jest.fn().mockResolvedValueOnce('name'),
      symbol: jest.fn().mockResolvedValueOnce('symbol'),
      decimals: jest.fn().mockResolvedValueOnce(18),
      balanceOf: jest.fn().mockResolvedValueOnce(0),
    }));

    const update = {
      message: {
        text: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        reply_to_message: {},
      },
    };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledWith('Address is not a contract');
  });

  it('should reply if reply message is a contract address', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(1);
    replySpy.mockClear();

    const contractAddress = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

    (getProvider as jest.Mock).mockImplementationOnce(() => ({
      // resolve to contract code
      getCode: jest.fn().mockResolvedValueOnce('0xContractCode'),
    }));

    (Contract as unknown as jest.Mock).mockImplementationOnce(() => ({
      address: contractAddress,
      name: jest.fn().mockResolvedValueOnce('token1'),
      symbol: jest.fn().mockResolvedValueOnce('TKN1'),
      decimals: jest.fn().mockResolvedValueOnce(18),
      balanceOf: jest.fn().mockResolvedValueOnce(0),
    }));

    (computeTokenPriceInUSD as jest.Mock).mockResolvedValueOnce({ priceInUSD: '100', priceInETH: '0.1' });

    const update = {
      message: {
        text: contractAddress,
        reply_to_message: {},
      },
    };
    const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
    await scene.middleware()(updatedCtx as IContext, jest.fn());

    expect(replySpy).toHaveBeenCalledTimes(2);
    expect(replySpy).toHaveBeenCalledWith('Reterieving token info...');
    expect(replySpy).toHaveBeenCalledWith('Computing token price...');
    expect(sceneCtx.leave).toHaveBeenCalledTimes(1);
    expect(sceneCtx.enter).toHaveBeenCalledWith(EScene.BuyAndSell, {
      [EWizardProp.Contract]: { address: contractAddress, decimals: 18, name: 'token1', symbol: 'TKN1' },
      [EWizardProp.Msg]: update.message,
      [EWizardProp.TokenPrice]: { priceInUSD: '100', priceInETH: '0.1' },
    });
  });
});
