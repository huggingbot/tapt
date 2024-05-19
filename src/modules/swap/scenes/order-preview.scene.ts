import { Token } from '@uniswap/sdk-core';
import { callbackQuery } from 'telegraf/filters';

import { placeLimitOrder } from '@/database/queries/common';
import { ELimitOrderMode } from '@/database/queries/order';
import { ICreateTokenParams } from '@/database/queries/token';
import { AppConfig } from '@/libs/config';
import { WRAPPED_NATIVE_TOKEN } from '@/libs/constants';
import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { IContext } from '@/modules/bot/interfaces/bot-context.interface';
import { IWizContractProp } from '@/modules/bot/interfaces/bot-prop.interface';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { IBasicWallet } from '@/types';
import { formatKeyboard, isNumber, resetScene } from '@/utils/common';

export const createOrderPreviewScene = composeWizardScene(
  async (ctx: IContext) => {
    const state = ctx.wizard.state;
    const keyboardData = [
      [{ text: ENavAction.SubmitOrder, callback_data: ENavAction.SubmitOrder }],
      [{ text: ENavAction.Back, callback_data: ENavAction.Back }],
      [{ text: ENavAction.Cancel, callback_data: ENavAction.Cancel }],
    ];

    const action = state[EWizardProp.Action] as string;
    const wallet = state[EWizardProp.ActiveAddress] as string;
    const orderType = state[EWizardProp.OrderType] as string;
    const contract = state[EWizardProp.Contract] as IWizContractProp;
    const triggerPrice = (state[EWizardProp.TriggerPrice] as string) || '+1%';
    const orderExpiry = (state[EWizardProp.Expiry] as string) || '1d';

    // const quotedPrice = await quoteTokePrice(contract, network, triggerPrice);
    const quotedPrice = ctx.wizard.state[EWizardProp.TargetPrice] as string;
    console.log('quotedPrice', quotedPrice);
    // ctx.wizard.state[EWizardProp.TargetPrice] = quotedPrice;

    const previewObj = { action, wallet, orderType, targetPrice: `${quotedPrice} (${triggerPrice})`, orderExpiry, amount: 0 };
    const [mode, rawAmount] = action.split(/_(.+)/);
    const amountStr = rawAmount.replace(/_/g, '.');
    if (!isNumber(amountStr)) {
      ctx.reply(`invalid ${mode} amount, ${amountStr}`);
      throw new Error(`invalid ${mode} amount, ${amountStr}`);
    }

    previewObj.action = mode;
    previewObj.amount = Number(amountStr);

    const previewArr = Object.entries(previewObj).map((entry) => {
      const [key, value] = entry;
      return `${key} = ${value}`;
    });

    const contractDetails = Object.entries(contract).map((entry) => {
      const [key, value] = entry;
      return `${key} = ${value}`;
    });

    const previewOrderDetails =
      `Order Preview\n----------------------\n${previewArr.join('\n')}` +
      `\n====================================\nToken Details\n-------------------\n${contractDetails.join('\n')}`;

    console.log('inside preview scene');
    ctx.reply(previewOrderDetails, formatKeyboard(keyboardData));
    ctx.wizard.next();
  },
  async (ctx: IContext, done) => {
    console.log("ctx.has(callbackQuery('data'))", ctx.has(callbackQuery('data')));
    if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.Cancel)) {
      console.log('ctx.callbackQuery.data', ctx.callbackQuery.data);
      ctx.wizard.state[EWizardProp.Contract] = undefined;
      ctx.wizard.state[EWizardProp.Action] = undefined;
      ctx.wizard.state[EWizardProp.OrderType] = undefined;
      ctx.wizard.state[EWizardProp.Msg] = undefined;
    } else if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.Back)) {
      console.log('back button pressed');
      // go back to buy-sell scene
      if (ctx.msg && ctx.msg.message_id) {
        ctx.deleteMessage(ctx.msg.message_id);
      }
      ctx.wizard.state[EWizardProp.ReEnterTheScene] = true;
      ctx.wizard.state[EWizardProp.DoNothing] = true;
    } else if (ctx.has(callbackQuery('data'))) {
      try {
        console.log('submitting order...');
        // submit order
        const state = ctx.wizard.state;
        const action = state[EWizardProp.Action] as string;
        const contract = state[EWizardProp.Contract] as IWizContractProp;
        const activeAddress = state[EWizardProp.ActiveAddress] as string;
        const targetPrice = state[EWizardProp.TargetPrice] as string;
        const [mode, rawAmount] = action.split(/_(.+)/);

        const amountStr = rawAmount.replace(/_/g, '.');
        if (!isNumber(amountStr)) {
          ctx.reply('Invalid amount!');
          ctx.wizard.next();
          return;
        }
        const amount = Number(amountStr);

        const network = ctx.session.prop[ESessionProp.Chain].network;
        const wallets = ctx.session.prop[ESessionProp.Wallets][network];
        const wallet = wallets.find((w) => w.address === activeAddress);
        const chainId = AppConfig[network].chainId;
        if (!wallet) {
          ctx.reply('Wallet not found!');
          ctx.wizard.next();
          return;
        }
        const walletParam: IBasicWallet = { walletAddress: activeAddress, chainId, network };

        const _isBuyMode = mode.trim().toLowerCase() === 'buy';
        // the input amount, should be the amount i am selling,
        // which is the amount that will leave my wallet.
        // From the point of view of a router, it's the input amount of X token that
        // you are giving to the router in exchange for another output amount of Y token.
        const amountIn = amount;
        // On the otherhand, amountOut is the output amount, should be the amount i am buying,
        // which is the amount that will enter my wallet.
        const amountOut = 0;
        const orderMode = _isBuyMode ? ELimitOrderMode.BUY : ELimitOrderMode.SELL;
        const tradeParam = { sellAmount: amountIn, buyAmount: amountOut, targetPrice, orderMode };

        const { name, address, decimals, symbol } = contract;
        const targetToken: ICreateTokenParams = { name, contractAddress: address, symbol, decimalPlaces: decimals, chainId };
        // weth
        const WETH_TOKEN = WRAPPED_NATIVE_TOKEN[network] as Required<Token>;
        const baseToken: ICreateTokenParams = {
          name: WETH_TOKEN.name,
          symbol: WETH_TOKEN.symbol,
          decimalPlaces: WETH_TOKEN.decimals,
          chainId,
          contractAddress: WETH_TOKEN.address,
        };
        // In 'buy' mode, we are buying 'X' token and give out 'WETH' as exchange
        // In 'sell' mode, we are selling 'X' token and get back 'WETH' in return
        const tokenToBuy = _isBuyMode ? targetToken : baseToken;
        const tokenToSell = _isBuyMode ? baseToken : targetToken;

        // save limit order details in db
        await placeLimitOrder({ tokenToBuy, tokenToSell, tradeParam, wallet: walletParam });
        await ctx.reply('Limit order submitted successfully!');
        resetScene(ctx);
      } catch (e: unknown) {
        ctx.reply(`error submitting limit order: ${(e as Error).message}`);
        ctx.wizard.next();
      }
    }
    done();
  },
  // To handle validation errors
  async (ctx: IContext, done) => {
    console.log('validation error handler');
    ctx.wizard.state[EWizardProp.ReEnterTheScene] = true;
    ctx.wizard.state[EWizardProp.DoNothing] = true;
    done();
  },
);
