import { Token } from '@uniswap/sdk-core';
import { callbackQuery } from 'telegraf/filters';

import { placeLimitOrder } from '@/database/queries/common';
import { AppConfig } from '@/libs/config';
import { WRAPPED_NATIVE_TOKEN } from '@/libs/constants';
import { ELimitOptions, ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { IBasicWallet } from '@/types';
import { formatKeyboard, isNumber } from '@/utils/common';

export const createSubmitLimitOrderScene = composeWizardScene(
  async (ctx) => {
    const keyboardData = [
      [{ text: 'Preview Limit Order', callback_data: ELimitOptions.PreviewOrder }],
      [{ text: 'Submit Limit Order', callback_data: ELimitOptions.SubmitOrder }],
      [{ text: 'Cancel', callback_data: ENavAction.Cancel }],
    ];

    ctx.reply('Please confirm your limit order', formatKeyboard(keyboardData));
    ctx.wizard.next();
  },
  async (ctx, done) => {
    const state = ctx.wizard.state;
    if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.Cancel)) {
      ctx.wizard.state[EWizardProp.Contract] = undefined;
      ctx.wizard.state[EWizardProp.Action] = undefined;
      ctx.wizard.state[EWizardProp.OrderType] = undefined;
      done();
    } else if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ELimitOptions.PreviewOrder)) {
      // display preview of the limit order
      const action = state[EWizardProp.Action] as string;
      const contract = state[EWizardProp.Contract];
      const wallet = state[EWizardProp.ActiveAddress];
      const orderType = state[EWizardProp.OrderType];
      const [mode, rawSwapAmount] = action.split(/_(.+)/);

      console.log('preview', { mode, contract, wallet, orderType, rawSwapAmount });

      ctx.reply(`Order Preview\n${JSON.stringify({ mode, contract, wallet, orderType, rawSwapAmount })}`);

      done();
    } else if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ELimitOptions.SubmitOrder)) {
      try {
        // submit the order
        const action = state[EWizardProp.Action] as string;
        const contract = state[EWizardProp.Contract] as Token;
        const activeAddress = state[EWizardProp.ActiveAddress] as string;
        const [mode, rawAmount] = action.split(/_(.+)/);

        const amountStr = rawAmount.replace(/_/g, '.');
        if (!isNumber(amountStr)) {
          ctx.reply('Invalid amount!');
          ctx.wizard.next();
          return;
        }

        let amount = 0;
        const isBuyMode = mode.toLowerCase() === 'buy';
        if (isBuyMode) {
          amount = parseFloat(amountStr);
          amount = Math.max(Math.min(amount, 1), 0);
        } else {
          amount = parseFloat(amountStr);
          amount = Math.max(Math.min(amount, Number.MAX_SAFE_INTEGER), 0);
        }

        const network = ctx.session.prop[ESessionProp.Chain].network;
        const wallets = ctx.session.prop[ESessionProp.Wallets][network];
        const wallet = wallets.find((w) => w.address === activeAddress);
        if (!wallet) {
          ctx.reply('Wallet not found!');
          ctx.wizard.next();
          return;
        }
        const chainId = AppConfig[network].chainId;
        const walletParam: IBasicWallet = { walletAddress: activeAddress, chainId, network };
        const { address, decimals, symbol, name } = contract;
        const input = WRAPPED_NATIVE_TOKEN[network] as Required<Token>;
        const tokenIn = { name: input.name, symbol: input.symbol, contractAddress: input.address, decimalPlaces: input.decimals, chainId };
        const tokenOut = { name: name || address, symbol: symbol || '', contractAddress: address, decimalPlaces: decimals, chainId };
        const tradeParam = { targetPrice: amount };

        await placeLimitOrder({ tokenIn, tokenOut, wallet: walletParam, tradeParam });
        await ctx.reply('Limit order submitted successfully!');
      } catch (e: unknown) {
        await ctx.reply('Failed to create Limit order. Please try again');
      }
    }
  },
  // clean up
  async (ctx, done) => {
    ctx.wizard.state[EWizardProp.Contract] = undefined;
    ctx.wizard.state[EWizardProp.Action] = undefined;
    ctx.wizard.state[EWizardProp.OrderType] = undefined;
    done();
  },
);
