import { isAddress } from 'ethers/lib/utils';
import { callbackQuery } from 'telegraf/filters';

import { WRAPPED_NATIVE_TOKEN } from '@/libs/constants';
import { getErc20CommonProps, getErc20Contract } from '@/libs/contracts';
import { toReadableAmount } from '@/libs/conversion';
import { getProvider } from '@/libs/providers';
import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { getWalletKeyboardData } from '@/modules/bot/utils/trade-keyboard-data';
import { formatKeyboard } from '@/utils/common';

export const createGetWalletBalanceScene = composeWizardScene(
  async (ctx) => {
    const { network } = ctx.session.prop[ESessionProp.Chain];
    const wallets = ctx.session.prop[ESessionProp.Wallets][network];
    if (!wallets.length) {
      ctx.reply('You have no wallets');
      return;
    }
    const activeAddress = ctx.wizard.state[EWizardProp.ActiveAddress];

    const walletKeyboardData = getWalletKeyboardData(wallets, activeAddress);
    if (!activeAddress) {
      walletKeyboardData[0][0].text = `${walletKeyboardData[0][0].text} ❎`;
      ctx.wizard.state[EWizardProp.ActiveAddress] = walletKeyboardData[0][0].callback_data;
    }

    const keyboardData = [
      ...walletKeyboardData,
      [
        { text: ENavAction.PeekBalance, callback_data: ENavAction.PeekBalance },
        { text: ENavAction.Back, callback_data: ENavAction.Back },
      ],
    ];

    ctx.reply('Manage Wallets\n============================', formatKeyboard(keyboardData));
    ctx.wizard.next();
  },
  async (ctx, done) => {
    if (ctx.has(callbackQuery('data'))) {
      const action = ctx.callbackQuery.data;
      const isWalletAddress = isAddress(action);
      if (action === String(ENavAction.Back)) {
        ctx.wizard.state[EWizardProp.Action] = ENavAction.Back;
        ctx.wizard.state[EWizardProp.Msg] = ctx.callbackQuery.message;
      } else if (isWalletAddress) {
        ctx.wizard.state[EWizardProp.ActiveAddress] = action;
      } else if (action === String(ENavAction.PeekBalance)) {
        const { network } = ctx.session.prop[ESessionProp.Chain];
        const provider = getProvider(network);
        const activeAddress = ctx.wizard.state[EWizardProp.ActiveAddress] as string;
        const USDC_CONTRACT = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const WBTC_CONTRACT = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';

        const usdcContract = getErc20Contract(USDC_CONTRACT, provider);
        const wbtcContract = getErc20Contract(WBTC_CONTRACT, provider);

        const [rawBalance, usdcProps, wbtcProps] = await Promise.all([
          provider.getBalance(activeAddress),
          getErc20CommonProps(usdcContract, activeAddress),
          getErc20CommonProps(wbtcContract, activeAddress),
        ]);

        let balance = rawBalance.toBigInt();
        balance = BigInt(toReadableAmount(balance.toString(), WRAPPED_NATIVE_TOKEN[network].decimals));

        const { balance: _usdcBalance, decimals: usdcDecimals } = usdcProps;
        let usdcBalance = BigInt(_usdcBalance);
        usdcBalance = BigInt(toReadableAmount(usdcBalance.toString(), usdcDecimals));

        const { balance: _wbtcBalance, decimals: wbtcDecimals } = wbtcProps;
        let wbtcBalance = BigInt(_wbtcBalance);
        wbtcBalance = BigInt(toReadableAmount(wbtcBalance.toString(), wbtcDecimals));

        const balanceStr = `
        Wallet address: ${activeAddress}
        Balance (ETH): ${balance} ETH
        Tokens:
        ----------
        USDC: ${usdcBalance} USDC
        WBTC: ${wbtcBalance} WBTC\n
        `;

        ctx.reply(balanceStr);
      }
    }
    done();
  },
);
