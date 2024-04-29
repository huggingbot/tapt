import { ENetwork } from '@/libs/config';
import { ExtendedSession, IContext } from '@/modules/bot/interfaces/bot-context.interface';
import { fundingStage } from '@/modules/funding/stages/funding.stage';
import _ from 'lodash';
import { Context, Scenes, Telegram } from 'telegraf';
import { Update, UserFromGetMe } from 'telegraf/types';
import { Deunionize } from 'telegraf/typings/core/helpers/deunionize';
import { getProvider } from '@/libs/providers';
import { Wallet } from 'ethers';
import { parseEther } from 'ethers/lib/utils';

const mockEthersWallet = (address?: string) => ({
  connect: jest.fn().mockImplementation(() => ({
    sendTransaction: jest.fn().mockResolvedValue({
      wait: jest.fn().mockResolvedValue({ transactionHash: 'transactionHash' }),
    }),
  })),
  address: address ?? 'address',
});

jest.mock('ethers', () => ({
  ethers: {
    providers: {
      JsonRpcProvider: jest.fn(),
    },
  },
  Wallet: jest.fn().mockImplementation(() => mockEthersWallet()),
}));

jest.mock('@/utils/crypto', () => ({
  decryptPrivateKey: jest.fn(),
  encryptPrivateKey: jest.fn(),
}));

jest.mock('@/libs/providers', () => ({
  getProvider: jest.fn(),
}));

describe('Fund from single wallet scene', function () {
  const address1 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
  const address2 = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

  let scene: Scenes.WizardScene<IContext>;
  let ctx: Partial<IContext>;
  let sessionCtx: Omit<ExtendedSession, 'user'>;
  let sceneCtx: Partial<IContext['scene']>;

  let replySpy: jest.SpyInstance;

  beforeEach(() => {
    scene = fundingStage[0];

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

    replySpy = jest.spyOn(ctx, 'reply').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it('should request for address to send funds with examples', async function () {
    await scene.middleware()(ctx as IContext, jest.fn());
    expect(replySpy).toHaveBeenCalledWith(
      `Enter the sending wallet address with amount

Note that:
• Leaving the amount blank transfers the entire remaining balance.
• The address and amount are separated by comma

Example:

Address with remaining amount:
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

Address with specified amount:
0x70997970C51812dc3A010C7d01b50e0d17dc79C8,0.001`,
      { reply_markup: { force_reply: true } },
    );
  });

  test.each`
    userInput   | addresses               | balance            | expectedResult
    ${address1} | ${[]}                   | ${parseEther('1')} | ${['Address not found in the list of wallets']}
    ${address1} | ${[address2]}           | ${parseEther('1')} | ${['Address not found in the list of wallets']}
    ${'random'} | ${[address1, address2]} | ${parseEther('1')} | ${['Address not found in the list of wallets']}
    ${address1} | ${[address1]}           | ${parseEther('1')} | ${['No wallets to fund']}
    ${address1} | ${[address1, address2]} | ${parseEther('0')} | ${['Insufficient balance']}
    ${address1} | ${[address1, address2]} | ${parseEther('1')} | ${['✅ **Funding successful!**', { parse_mode: 'Markdown' }]}
  `(
    'should expect "$expectedResult" when userInput is $userInput, balance is $balance, and addresses are "$addresses"',
    async ({ userInput, addresses, balance, expectedResult }) => {
      await scene.middleware()(ctx as IContext, jest.fn());

      expect(replySpy).toHaveBeenCalledTimes(1);
      replySpy.mockClear();

      (getProvider as jest.Mock).mockImplementationOnce(() => ({
        getBalance: jest.fn().mockResolvedValueOnce({ toBigInt: jest.fn().mockReturnValueOnce(balance) }),
        getTransactionCount: jest.fn().mockResolvedValueOnce(1),
      }));
      (Wallet as unknown as jest.Mock).mockImplementationOnce(() => mockEthersWallet(userInput.toLowerCase()));

      for (const address of addresses) {
        sessionCtx.prop.wallets[ENetwork.Mainnet].push({ encryptedPrivateKey: 'encryptedPrivateKey', address: address.toLowerCase(), chainId: 1 });
      }

      const update = {
        message: {
          text: userInput,
          reply_to_message: {},
        },
      };
      const updatedCtx = _.merge(_.cloneDeep(ctx), { update });
      await scene.middleware()(updatedCtx as IContext, jest.fn());

      const replies = expectedResult.map((res: unknown) => (typeof res === 'string' ? expect.stringContaining(res) : res));

      expect(replySpy).toHaveBeenCalledTimes(1);
      expect(replySpy).toHaveBeenCalledWith(...replies);
    },
  );
});
