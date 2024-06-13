import { Token } from '@uniswap/sdk-core';
import { SwapRoute } from '@uniswap/smart-order-router';
import { Wallet } from 'ethers';
import log from 'loglevel';
import { callbackQuery } from 'telegraf/filters';

import { placeSwapOrder } from '@/database/queries/common';
import { AppConfig } from '@/libs/config';
import { NATIVE_CURRENCY, WRAPPED_NATIVE_TOKEN } from '@/libs/constants';
import { getErc20CommonProps, getErc20Contract } from '@/libs/contracts';
import { toReadableAmount } from '@/libs/conversion';
import { getProvider } from '@/libs/providers';
import { executeRoute, generateRoute } from '@/libs/routing';
import { wrapNativeToken } from '@/libs/wallet';
import { ENavAction, ESwapAction } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { IWizContractProp } from '@/modules/bot/interfaces/bot-prop.interface';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { formatKeyboard } from '@/utils/common';
import { decryptPrivateKey } from '@/utils/crypto';

export const createExecuteSwapScene = composeWizardScene(
  // confirmation
  async (ctx) => {
    const keyboardData = [
      [{ text: 'Confirm swap', callback_data: ESwapAction.ConfirmSwap }],
      [{ text: ENavAction.Cancel, callback_data: ENavAction.Cancel }],
    ];

    ctx.reply('Please confirm your swap', formatKeyboard(keyboardData));
    ctx.wizard.next();
  },
  // execute swap
  async (ctx, done) => {
    const state = ctx.wizard.state;
    // user cancel the swap
    if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.Cancel)) {
      ctx.wizard.state[EWizardProp.Contract] = undefined;
      ctx.wizard.state[EWizardProp.Action] = undefined;
      done();
    } else if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ESwapAction.ConfirmSwap)) {
      // user confirm and execute the swap
      const contract = state[EWizardProp.Contract] as IWizContractProp;
      const action = state[EWizardProp.Action] as string;
      const activeAddress = state[EWizardProp.ActiveAddress];

      const [swapMode, rawSwapAmount] = action.split(/_(.+)/);
      const isBuyMode = swapMode.toLowerCase() === 'buy';
      const swapAmount = rawSwapAmount.replace(/_/g, '.');

      let amount = Number.NaN;
      let isPercentage = false;

      if (isBuyMode) {
        amount = parseFloat(swapAmount);
        amount = Math.max(Math.min(amount, Number.MAX_SAFE_INTEGER), 0);
      } else {
        isPercentage = swapAmount.endsWith('pct');

        if (isPercentage) {
          amount = parseFloat(swapAmount.replace('pct', '')) / 100;
          amount = Math.max(Math.min(amount, 1), 0);
        } else {
          amount = parseFloat(swapAmount);
          amount = Math.max(Math.min(amount, Number.MAX_SAFE_INTEGER), 0);
        }
      }
      const { network } = ctx.session.prop[ESessionProp.Chain];
      const wallets = ctx.session.prop[ESessionProp.Wallets][network];
      const wallet = wallets.find((wallet) => wallet.address === activeAddress);

      if (!wallet) {
        ctx.reply('No wallet found');
      } else if (Number.isNaN(amount)) {
        ctx.reply('Invalid amount');
      } else {
        try {
          let balance: bigint;
          const privateKey = decryptPrivateKey(wallet.encryptedPrivateKey);
          const selectedWallet = new Wallet(privateKey);
          const provider = getProvider(network);
          const chainId = AppConfig[network].chainId;

          if (isBuyMode) {
            const rawBalance = await provider.getBalance(selectedWallet.address);
            balance = rawBalance.toBigInt();
            balance = BigInt(toReadableAmount(balance.toString(), WRAPPED_NATIVE_TOKEN[network].decimals));
          } else {
            const erc20Contract = getErc20Contract(contract.address, provider);
            const { balance: tokenBalance, decimals } = await getErc20CommonProps(erc20Contract, selectedWallet.address);
            balance = BigInt(tokenBalance);
            balance = BigInt(toReadableAmount(balance.toString(), decimals));
          }

          if (isPercentage) {
            amount = Number(balance) * amount;
          }

          if (amount > balance || balance <= 0) {
            ctx.reply('Insufficient balance');
          } else {
            const { address, decimals, symbol, name } = contract;
            const token = new Token(chainId, address, decimals, symbol, name);

            let route: SwapRoute | null = null;
            if (isBuyMode) {
              ctx.reply(`Wrapping ${NATIVE_CURRENCY[network]}...`);
              // TODO: Separate wrapping native currency from swapping
              await wrapNativeToken(selectedWallet, network, amount);
              ctx.reply(`Generating route...`);
              route = await generateRoute(selectedWallet, network, { tokenIn: WRAPPED_NATIVE_TOKEN[network], tokenOut: token, amount });
            } else {
              ctx.reply(`Generating route...`);
              route = await generateRoute(selectedWallet, network, { tokenIn: token, tokenOut: WRAPPED_NATIVE_TOKEN[network], amount });
            }

            if (route) {
              if (isBuyMode) {
                ctx.reply(
                  `${swapMode}ing ${route.quote.toExact()} of ${route.quote.currency.symbol} with ${amount} ${WRAPPED_NATIVE_TOKEN[network].symbol}...`,
                );
              } else {
                ctx.reply(`${swapMode}ing ${amount} ${token.symbol} for ${route.quote.toExact()} of ${route.quote.currency.symbol}...`);
              }

              const res = await executeRoute(selectedWallet, network, route);

              if (typeof res === 'object') {
                const input = WRAPPED_NATIVE_TOKEN[network] as Required<Token>;
                const tokenIn = { name: input.name, symbol: input.symbol, contractAddress: input.address, decimalPlaces: input.decimals, chainId };
                const tokenOut = { name, symbol, contractAddress: address, decimalPlaces: decimals, chainId };
                const orderParam = { buyAmount: amount, sellAmount: Number(route.quote.toExact()), targetPrice: null, expirationDate: null };
                const transactionParam = { transactionHash: res.hash };

                // TODO: Update tx fee after tx has been mined as currently tx has only been submitted
                // TODO: Run a separate job to check if tx has been mined
                const walletParam = { walletAddress: wallet.address, chainId, network };
                const tradeParam = { tokenIn, tokenOut, orderParam, transactionParam };
                await placeSwapOrder(walletParam, tradeParam);

                ctx.reply(`Trade submitted!\n\nTx hash: ${res.hash}`);
              } else {
                ctx.reply('Trade failed');
              }
            } else {
              ctx.reply('Route not generated');
            }
          }
        } catch (err) {
          log.error(`Error occurred in createExecuteSwapScene: ${err as any} ${err instanceof Error ? err.stack : ''}`);
          ctx.reply('Something went wrong. Please try again');
        }
      }
      ctx.wizard.state[EWizardProp.Contract] = undefined;
      ctx.wizard.state[EWizardProp.Action] = undefined;
      done();
    } else {
      ctx.wizard.state[EWizardProp.Contract] = undefined;
      ctx.wizard.state[EWizardProp.Action] = undefined;
      done();
    }
  },
);
