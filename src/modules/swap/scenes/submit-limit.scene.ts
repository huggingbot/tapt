import { Token } from '@uniswap/sdk-core';
import { callbackQuery } from 'telegraf/filters';

import { placeLimitOrder } from '@/database/queries/common';
import { AppConfig } from '@/libs/config';
import { WRAPPED_NATIVE_TOKEN } from '@/libs/constants';
import { ELimitOptions, ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { IWizContractProp } from '@/modules/bot/interfaces/bot-prop.interface';
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
      const wallet = state[EWizardProp.ActiveAddress] as string;
      const orderType = state[EWizardProp.OrderType] as string;

      console.log('preview', { wallet, orderType, action });

      const previewObj = { action, wallet, orderType };
      const previewArr = Object.entries(previewObj).map((entry) => {
        const [key, value] = entry;
        return `${key} = ${value}`;
      });

      const contract = state[EWizardProp.Contract] as IWizContractProp;
      const contractDetails = Object.entries(contract).map((entry) => {
        const [key, value] = entry;
        return `${key} = ${value}`;
      });

      ctx.reply(
        `Order Preview\n----------------------\n${previewArr.join('\n')}` +
          `\n====================================\nToken Details\n-------------------\n${contractDetails.join('\n')}`,
      );

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
      } finally {
        // clean up
        ctx.wizard.state[EWizardProp.Contract] = undefined;
        ctx.wizard.state[EWizardProp.Action] = undefined;
        ctx.wizard.state[EWizardProp.OrderType] = undefined;
        done();
      }
    }
  },
);
