import { isAddress } from 'ethers/lib/utils';
import log from 'loglevel';
import { callbackQuery, message } from 'telegraf/filters';
import { InlineKeyboardButton, Message } from 'telegraf/typings/core/types/typegram';

import { quoteTargetTokenPrice } from '@/libs/quoting';
import { EDcaOrderKeyboardData, ENavAction, EOrderDetails, EOrderType, ESwapAction } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { IWizContractProp } from '@/modules/bot/interfaces/bot-prop.interface';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { addTradeRelatedKeyboardData, getWalletKeyboardData } from '@/modules/bot/utils/trade-keyboard-data';
import {
  getDcaOrderOptionDataFromUserReply,
  getLimitOrderOptionDataFromUserReply,
  presentCustomTradeAmountQuestion,
  presentDcaOrderDetailsQuestion,
  presentLimitOrderDetailsQuestion,
} from '@/modules/bot/utils/trade-scene-factory';
import { formatKeyboard, isBuyMode, isDCAOrder, isLimitOrder, isNumber, isSwapOrder, populateBuyModeKeyboardData } from '@/utils/common';

export const createBuyAndSellScene = composeWizardScene(
  async (ctx) => {
    const state = ctx.wizard.state;
    const msg = state[EWizardProp.Msg] as Message.TextMessage | undefined;
    const contract = state[EWizardProp.Contract] as IWizContractProp;
    const tokenPriceInUSD = (state[EWizardProp.TokenPriceInUSD] as string) || '_unknown_';

    const shouldDoNothing = state[EWizardProp.DoNothing];

    const action = state[EWizardProp.Action];

    const { network } = ctx.session.prop[ESessionProp.Chain];
    const wallets = ctx.session.prop[ESessionProp.Wallets][network];
    const activeAddress = state[EWizardProp.ActiveAddress];

    const walletKeyboardData = getWalletKeyboardData(wallets, activeAddress);
    if (!activeAddress) {
      walletKeyboardData[0][0].text = `${walletKeyboardData[0][0].text} ❎`;
      ctx.wizard.state[EWizardProp.ActiveAddress] = walletKeyboardData[0][0].callback_data;
    }

    // order type
    const orderType = ctx.wizard.state[EWizardProp.OrderType] || EOrderType.SwapOrderType;

    const keyboardData = [
      [
        { text: isBuyMode(action) ? `${ESwapAction.BuyMode} ❎` : ESwapAction.BuyMode, callback_data: ESwapAction.BuyMode },
        { text: !isBuyMode(action) ? `${ESwapAction.SellMode} ❎` : ESwapAction.SellMode, callback_data: ESwapAction.SellMode },
      ],
      [
        { text: isSwapOrder(orderType) ? `${EOrderType.SwapOrderType} ❎` : EOrderType.SwapOrderType, callback_data: EOrderType.SwapOrderType },
        { text: isLimitOrder(orderType) ? `${EOrderType.LimitOrderType} ❎` : EOrderType.LimitOrderType, callback_data: EOrderType.LimitOrderType },
        { text: isDCAOrder(orderType) ? `${EOrderType.DCAOrderType} ❎` : EOrderType.DCAOrderType, callback_data: EOrderType.DCAOrderType },
      ],
      [{ text: ESwapAction.Wallets, callback_data: ESwapAction.Wallets }],
      ...walletKeyboardData,
      [{ text: ESwapAction.Actions, callback_data: ESwapAction.Actions }],
      ...populateBuyModeKeyboardData(action as string, network),
      [{ text: ENavAction.PreviewOrder, callback_data: ENavAction.PreviewOrder }],
      [{ text: ENavAction.Cancel, callback_data: ENavAction.Cancel }],
    ];

    // add trade related options to the keyboard data
    addTradeRelatedKeyboardData(state, keyboardData);

    if (msg && (action || activeAddress)) {
      if (shouldDoNothing) {
        ctx.wizard.state[EWizardProp.DoNothing] = undefined;
        ctx.wizard.next();
      } else if (msg.message_id && msg.chat.id) {
        try {
          ctx.telegram.editMessageReplyMarkup(msg.chat.id, msg.message_id, undefined, {
            inline_keyboard: keyboardData,
          });
        } catch (e) {
          log.error('error editing message', e);
        } finally {
          ctx.wizard.next();
        }
      }
    } else {
      ctx.reply(
        `${contract?.name} ($${tokenPriceInUSD})\n----------------------------------------------------------------------------------------------------`,
        formatKeyboard(keyboardData),
      );
      ctx.wizard.next();
    }
  },
  async (ctx, done) => {
    try {
      const state = ctx.wizard.state;

      if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.Cancel)) {
        ctx.wizard.state[EWizardProp.Msg] = undefined;
        ctx.deleteMessage(ctx.callbackQuery.message?.message_id);
        done();
      } else if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.PreviewOrder)) {
        const action = state[EWizardProp.Action] as string;
        if (!action || ([ESwapAction.BuyMode, ESwapAction.SellMode] as string[]).includes(action)) {
          ctx.wizard.state[EWizardProp.Action] = isBuyMode(action) ? ESwapAction.Buy_0_01 : ESwapAction.Sell_10;
        }
        ctx.wizard.state[EWizardProp.ReEnterTheScene] = false;
        const orderType = state[EWizardProp.OrderType] as string;
        if (orderType === String(EOrderType.LimitOrderType)) {
          const contract = state[EWizardProp.Contract] as IWizContractProp;
          const triggerPrice = (state[EWizardProp.TriggerPrice] as string) || (isBuyMode(action) ? '-1%' : '+1%');
          const network = ctx.session.prop[ESessionProp.Chain].network;
          const quotedTargetPrice = await quoteTargetTokenPrice(contract, network, triggerPrice);
          ctx.wizard.state[EWizardProp.TargetPrice] = quotedTargetPrice;
        }
        done();
      } else if (ctx.has(callbackQuery('data'))) {
        const cbData = ctx.callbackQuery.data;
        const isWalletAddress = isAddress(cbData);
        if ((Object.values(ESwapAction) as string[]).includes(cbData)) {
          ctx.wizard.state[EWizardProp.Action] = cbData;
        } else if ((Object.values(EOrderType) as string[]).includes(cbData)) {
          ctx.wizard.state[EWizardProp.OrderType] = cbData;
        } else if (isWalletAddress) {
          ctx.wizard.state[EWizardProp.ActiveAddress] = cbData;
        }
        if (
          cbData !== String(ENavAction.PreviewOrder) &&
          !([ESwapAction.Buy_X, ESwapAction.Sell_X, ...Object.values(EOrderDetails), ...Object.values(EDcaOrderKeyboardData)] as string[]).includes(
            cbData,
          )
        ) {
          const contract = state[EWizardProp.Contract] as IWizContractProp;
          const msg = ctx.callbackQuery.message as Message.TextMessage;

          const inlineKb = msg.reply_markup?.inline_keyboard as InlineKeyboardButton.CallbackButton[][];
          const activeButtons = inlineKb.reduce((acc, row) => {
            const activeButton = row.find((col) => col.text.includes('❎'));
            return activeButton ? acc.concat(activeButton.callback_data) : acc;
          }, [] as string[]);

          const isActiveButton = activeButtons.includes(cbData);
          const shouldDoNothing = isActiveButton || ([ESwapAction.Actions, ESwapAction.Wallets] as string[]).includes(cbData);

          if (ctx.scene.current) {
            ctx.scene.enter(ctx.scene.current.id, {
              ...state,
              [EWizardProp.Msg]: msg,
              [EWizardProp.Contract]: contract,
              [EWizardProp.DoNothing]: shouldDoNothing,
              [EWizardProp.Action]: (Object.values(ESwapAction) as string[]).includes(cbData) ? cbData : state[EWizardProp.Action],
              ...(isWalletAddress && !shouldDoNothing
                ? { [EWizardProp.ActiveAddress]: cbData }
                : { [EWizardProp.ActiveAddress]: state[EWizardProp.ActiveAddress] }),
              [EWizardProp.OrderType]: (Object.values(EOrderType) as string[]).includes(cbData) ? cbData : state[EWizardProp.OrderType],
            });
          } else {
            done();
          }
        } else if (([ESwapAction.Buy_X, ESwapAction.Sell_X] as string[]).includes(cbData)) {
          presentCustomTradeAmountQuestion(ctx, cbData);
        } else if ((Object.values(EOrderDetails) as string[]).includes(cbData)) {
          presentLimitOrderDetailsQuestion(ctx, cbData);
        } else if ((Object.values(EDcaOrderKeyboardData) as string[]).includes(cbData)) {
          presentDcaOrderDetailsQuestion(ctx, cbData);
        } else {
          done();
        }
      } else {
        ctx.wizard.state[EWizardProp.Contract] = undefined;
        ctx.wizard.state[EWizardProp.Action] = undefined;
        ctx.wizard.state[EWizardProp.ActiveAddress] = undefined;
        done();
      }
    } catch (e: unknown) {
      const errMsg = (e as Error)?.message || 'Unexpected error';
      log.error(`error processing 'buy-sell-scene', ${errMsg}`);
      ctx.reply('Unexpected erorr: failed to process trading scene. Please try again!');
      done();
    }
  },
  async (ctx, done) => {
    if (ctx.has(message('reply_to_message', 'text'))) {
      const orderDetailsAction = ctx.wizard.state[EWizardProp.OrderDetailsAction] as string;
      const action = (ctx.wizard.state[EWizardProp.Action] as ESwapAction) || ESwapAction.BuyMode;
      if (orderDetailsAction) {
        try {
          if ((Object.values(EOrderDetails) as string[]).includes(orderDetailsAction)) {
            getLimitOrderOptionDataFromUserReply(ctx, action, orderDetailsAction);
          } else if ((Object.values(EDcaOrderKeyboardData) as string[]).includes(orderDetailsAction)) {
            getDcaOrderOptionDataFromUserReply(ctx, action, orderDetailsAction);
          }
        } catch (e: unknown) {
          const errMsg = (e as Error).message || 'Something went wrong!';
          ctx.reply(errMsg);
          done();
          return;
        }
      } else {
        const action = ctx.wizard.state[EWizardProp.Action] as string;
        const customBuySellAmount = ctx.message.text.toLowerCase();
        if (!isNumber(customBuySellAmount)) {
          ctx.reply(`Invalid amount, ${customBuySellAmount} entered.`);
          done();
          return;
        } else {
          const [swapMode] = action.split(/_(.+)/);
          ctx.wizard.state[EWizardProp.Action] = `${swapMode}_${ctx.message.text.toLowerCase()}`;
        }
      }
      ctx.wizard.state[EWizardProp.ReEnterTheScene] = true;
      ctx.wizard.state[EWizardProp.OrderDetailsAction] = undefined;
      ctx.wizard.state[EWizardProp.DoNothing] = undefined;
      // delete the question message and reply after getting details
      ctx.deleteMessage(ctx.message.reply_to_message.message_id);
      ctx.deleteMessage(ctx.message.message_id);
      done();
    } else {
      done();
    }
  },
);
