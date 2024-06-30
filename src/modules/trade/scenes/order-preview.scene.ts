import { Token } from '@uniswap/sdk-core';
import { Wallet } from 'ethers';
import log from 'loglevel';
import { callbackQuery } from 'telegraf/filters';

import { placeDcaOrder, placeLimitOrder } from '@/database/queries/common';
import { ELimitOrderMode } from '@/database/queries/order';
import { ICreateTokenParams } from '@/database/queries/token';
import { AppConfig } from '@/libs/config';
import { WRAPPED_NATIVE_TOKEN } from '@/libs/constants';
import { getErc20CommonProps, getErc20Contract } from '@/libs/contracts';
import { toReadableAmount } from '@/libs/conversion';
import { getProvider } from '@/libs/providers';
import { ITargetTokenPrice } from '@/libs/quoting';
import { DEFAULT_TRADE_OPTIONS, ENavAction, EOrderType } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { IContext } from '@/modules/bot/interfaces/bot-context.interface';
import { IWizContractProp } from '@/modules/bot/interfaces/bot-prop.interface';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { IBasicWallet } from '@/types';
import { computeFinalDateFromInterval, computeMinutesFromIntervalString, formatKeyboard, isBuyMode, isNumber, resetScene } from '@/utils/common';
import { decryptPrivateKey } from '@/utils/crypto';

export const createOrderPreviewScene = composeWizardScene(
  async (ctx: IContext, done) => {
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

    let previewObj;
    if (orderType === String(EOrderType.LimitOrderType)) {
      const triggerPrice =
        (state[EWizardProp.TriggerPrice] as string) ||
        (isBuyMode(action) ? DEFAULT_TRADE_OPTIONS.LimitBuyTriggerPrice : DEFAULT_TRADE_OPTIONS.LimitSellTriggerPrice);
      const orderExpiry = (state[EWizardProp.Expiry] as string) || DEFAULT_TRADE_OPTIONS.LimitExpiry;

      const targetTokenPrice = ctx.wizard.state[EWizardProp.TargetPrice] as ITargetTokenPrice;
      if (!targetTokenPrice) {
        done();
        return;
      }
      const { priceInUSD } = targetTokenPrice;
      previewObj = { action, wallet, orderType, targetPrice: `$${priceInUSD} (${triggerPrice})`, orderExpiry, amount: '0' };
    } else {
      const interval = (state[EWizardProp.DcaInterval] as string) || DEFAULT_TRADE_OPTIONS.DcaInterval;
      const duration = (state[EWizardProp.DcaDuration] as string) || DEFAULT_TRADE_OPTIONS.DcaDuration;
      const { priceInUSD: maxPrice } = state[EWizardProp.DcaMaxPrice] as ITargetTokenPrice;
      const { priceInUSD: minPrice } = state[EWizardProp.DcaMinPrice] as ITargetTokenPrice;
      previewObj = { action, wallet, orderType, maxPrice, minPrice, interval, duration, amount: '0' };
    }

    const [mode, rawAmount] = action.split(/_(.+)/);
    const amountStr = rawAmount.replace(/_/g, '.');
    let amount = NaN;
    if (isBuyMode(action)) {
      amount = parseFloat(amountStr);
      amount = Math.max(Math.min(amount, Number.MAX_SAFE_INTEGER), 0);
      previewObj.amount = `${amount} ETH`;
      ctx.wizard.state[EWizardProp.TradeAmount] = amount.toString();
    } else {
      const isPercentage = amountStr.endsWith('pct');

      if (isPercentage) {
        amount = parseFloat(amountStr.replace('pct', '')) / 100;
        amount = Math.max(Math.min(amount, 1), 0);
        previewObj.amount = amountStr;
        ctx.wizard.state[EWizardProp.TradeAmount] = amountStr;
      } else {
        amount = parseFloat(amountStr);
        amount = Math.max(Math.min(amount, Number.MAX_SAFE_INTEGER), 0);
        previewObj.amount = `${amount} ${contract.symbol}`;
        ctx.wizard.state[EWizardProp.TradeAmount] = amount.toString();
      }
    }
    if (!isNumber(amount)) {
      ctx.reply(`invalid ${mode} amount, ${amountStr}`);
    } else {
      previewObj.action = mode;

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

      ctx.reply(previewOrderDetails, formatKeyboard(keyboardData));
    }
    ctx.wizard.next();
  },
  async (ctx: IContext, done) => {
    if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.Cancel)) {
      ctx.wizard.state[EWizardProp.Contract] = undefined;
      ctx.wizard.state[EWizardProp.Action] = undefined;
      ctx.wizard.state[EWizardProp.OrderType] = undefined;
      ctx.wizard.state[EWizardProp.Msg] = undefined;
    } else if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.Back)) {
      // go back to buy-sell scene
      if (ctx.msg && ctx.msg.message_id) {
        ctx.deleteMessage(ctx.msg.message_id);
      }
      ctx.wizard.state[EWizardProp.ReEnterTheScene] = true;
      ctx.wizard.state[EWizardProp.DoNothing] = true;
    } else if (ctx.has(callbackQuery('data'))) {
      try {
        // submit order
        const state = ctx.wizard.state;
        const action = state[EWizardProp.Action] as string;
        const contract = state[EWizardProp.Contract] as IWizContractProp;
        const activeAddress = state[EWizardProp.ActiveAddress] as string;

        const network = ctx.session.prop[ESessionProp.Chain].network;
        const wallets = ctx.session.prop[ESessionProp.Wallets][network];
        const wallet = wallets.find((w) => w.address === activeAddress);
        const chainId = AppConfig[network].chainId;
        if (!wallet) {
          ctx.reply('Wallet not found!');
          ctx.wizard.next();
          return;
        }

        // check the wallet balance
        const privateKey = decryptPrivateKey(wallet?.encryptedPrivateKey);
        const selectedWallet = new Wallet(privateKey);
        const provider = getProvider(network);
        let balance: bigint;

        if (isBuyMode(action)) {
          const rawBalance = await provider.getBalance(selectedWallet.address);
          balance = rawBalance.toBigInt();
          balance = BigInt(toReadableAmount(balance.toString(), WRAPPED_NATIVE_TOKEN[network].decimals));
        } else {
          const erc20Contract = getErc20Contract(contract.address, provider);
          const { balance: tokenBalance, decimals } = await getErc20CommonProps(erc20Contract, selectedWallet.address);
          balance = BigInt(tokenBalance);
          balance = BigInt(toReadableAmount(balance.toString(), decimals));
        }
        const [mode, rawAmount] = action.split(/_(.+)/);
        let amountStr = rawAmount.replace(/_/g, '.');
        if (amountStr.endsWith('pct')) {
          let pctValue = parseFloat(amountStr.replace('pct', '')) / 100;
          pctValue = Math.max(Math.min(pctValue, 1), 0);
          amountStr = (Number(balance) * pctValue).toString();
        }

        if (!isNumber(amountStr)) {
          ctx.reply(`Invalid trade amount, ${amountStr}`);
          ctx.wizard.next();
          return;
        }
        const amount = Number(amountStr);
        if (amount >= balance || balance <= 0) {
          ctx.reply('Insufficient balance in your wallet!');
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

        const { name, address, decimals, symbol } = contract;
        const targetToken: ICreateTokenParams = { name, contractAddress: address, symbol, decimalPlaces: decimals, chainId };
        // weth
        const wNativeToken = WRAPPED_NATIVE_TOKEN[network] as Required<Token>;
        const baseToken: ICreateTokenParams = {
          name: wNativeToken.name,
          symbol: wNativeToken.symbol,
          decimalPlaces: wNativeToken.decimals,
          chainId,
          contractAddress: wNativeToken.address,
        };
        // In 'buy' mode, we are buying 'X' token and give out 'WETH' as exchange
        // In 'sell' mode, we are selling 'X' token and get back 'WETH' in return
        const tokenToBuy = _isBuyMode ? targetToken : baseToken;
        const tokenToSell = _isBuyMode ? baseToken : targetToken;

        const orderType = state[EWizardProp.OrderType] as string;
        if (orderType === String(EOrderType.LimitOrderType)) {
          const { priceInETH } = state[EWizardProp.TargetPrice] as ITargetTokenPrice;
          const orderExpiry = (state[EWizardProp.Expiry] as string) || DEFAULT_TRADE_OPTIONS.LimitExpiry;
          const orderExpiryDate = computeFinalDateFromInterval(orderExpiry);
          const expirationDate = orderExpiryDate.toISOString();
          const tradeParam = { sellAmount: amountIn, buyAmount: amountOut, targetPrice: priceInETH, orderMode, expirationDate };
          // save limit order details in db
          await placeLimitOrder({ tokenToBuy, tokenToSell, tradeParam, wallet: walletParam });
          await ctx.reply('Limit order submitted successfully!');
        } else {
          const { priceInETH: minPriceInETH } = state[EWizardProp.DcaMinPrice] as ITargetTokenPrice;
          const { priceInETH: maxPriceInETH } = state[EWizardProp.DcaMaxPrice] as ITargetTokenPrice;
          const interval = computeMinutesFromIntervalString((state[EWizardProp.DcaInterval] as string) || DEFAULT_TRADE_OPTIONS.DcaInterval);
          const duration = computeMinutesFromIntervalString((state[EWizardProp.DcaDuration] as string) || DEFAULT_TRADE_OPTIONS.DcaDuration);
          const expirationDate = new Date();
          expirationDate.setMinutes(expirationDate.getMinutes() + duration);
          const tradeParam = {
            sellAmount: amountIn,
            buyAmount: amountOut,
            minPrice: Number(minPriceInETH),
            maxPrice: Number(maxPriceInETH),
            interval,
            duration,
            orderMode,
          };
          // save limit order details in db
          await placeDcaOrder({ tokenToBuy, tokenToSell, tradeParam, wallet: walletParam });
          await ctx.reply('DCA order submitted successfully!');
        }

        resetScene(ctx);
      } catch (e: unknown) {
        log.error(`error submitting limit order: ${(e as Error).message}`);
        ctx.reply('Failed to submit limit order. Please try again!');
        ctx.wizard.next();
      }
    }
    done();
  },
  // To handle validation errors
  async (ctx: IContext, done) => {
    ctx.wizard.state[EWizardProp.ReEnterTheScene] = true;
    ctx.wizard.state[EWizardProp.DoNothing] = true;
    done();
  },
);
