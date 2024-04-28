import { isAddress } from 'ethers/lib/utils';
import { callbackQuery, message } from 'telegraf/filters';
import { InlineKeyboardButton, Message } from 'telegraf/typings/core/types/typegram';

import { NATIVE_CURRENCY as NATIVE_CURRENCY } from '@/libs/constants';
import { ENavAction, EOrderType, ESwapAction } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { IWizContractProp } from '@/modules/bot/interfaces/bot-prop.interface';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { formatKeyboard, isDCAOrder, isLimitOrder, isSwapOrder, truncateAddress } from '@/utils/common';

export const createBuyAndSellScene = composeWizardScene(
  async (ctx) => {
    const state = ctx.wizard.state;
    const msg = state[EWizardProp.Msg] as Message.TextMessage | undefined;
    const { name, symbol } = state[EWizardProp.Contract] as IWizContractProp;

    const shouldDoNothing = state[EWizardProp.DoNothing];

    const action = state[EWizardProp.Action];
    const swapModeWithDefault = action || ESwapAction.BuyMode;
    const isBuyMode = swapModeWithDefault === ESwapAction.BuyMode;

    const { network } = ctx.session.prop[ESessionProp.Chain];
    const wallets = ctx.session.prop[ESessionProp.Wallets][network];
    const activeAddress = state[EWizardProp.ActiveAddress];

    const walletKeyboardData = wallets.reduce(
      (acc, wallet, index) => {
        const isActiveWallet = activeAddress === wallet.address;
        const truncatedAddress = truncateAddress(wallet.address);
        const button = { text: isActiveWallet ? `${truncatedAddress} ❎` : truncatedAddress, callback_data: wallet.address };

        if (index % 3 === 0) {
          acc.push([button]);
        } else {
          acc[acc.length - 1].push(button);
        }
        return acc;
      },
      [] as { text: string; callback_data: string }[][],
    );
    if (!activeAddress) {
      walletKeyboardData[0][0].text = `${walletKeyboardData[0][0].text} ❎`;
      ctx.wizard.state[EWizardProp.ActiveAddress] = walletKeyboardData[0][0].callback_data;
    }

    const currency = NATIVE_CURRENCY[network];
    const buyKeyboardData = [
      [
        { text: `Buy 0.01 ${currency}`, callback_data: ESwapAction.Buy_0_01 },
        { text: `Buy 0.2 ${currency}`, callback_data: ESwapAction.Buy_0_2 },
      ],
      [
        { text: `Buy 0.5 ${currency}`, callback_data: ESwapAction.Buy_0_5 },
        { text: `Buy 1 ${currency}`, callback_data: ESwapAction.Buy_1 },
      ],
      [
        { text: `Buy 3 ${currency}`, callback_data: ESwapAction.Buy_3 },
        { text: `Buy X ${currency}`, callback_data: ESwapAction.Buy_X },
      ],
    ];
    const sellKeyboardData = [
      [
        { text: 'Sell 10%', callback_data: ESwapAction.Sell_10 },
        { text: 'Sell 20%', callback_data: ESwapAction.Sell_20 },
        { text: 'Sell 30%', callback_data: ESwapAction.Sell_30 },
      ],
      [
        { text: 'Sell 40%', callback_data: ESwapAction.Sell_40 },
        { text: 'Sell 50%', callback_data: ESwapAction.Sell_50 },
        { text: 'Sell 60%', callback_data: ESwapAction.Sell_60 },
      ],
      [
        { text: 'Sell 70%', callback_data: ESwapAction.Sell_70 },
        { text: 'Sell 80%', callback_data: ESwapAction.Sell_80 },
        { text: 'Sell 90%', callback_data: ESwapAction.Sell_90 },
      ],
      [
        { text: 'Sell all', callback_data: ESwapAction.Sell_100 },
        { text: 'Sell X token', callback_data: ESwapAction.Sell_X },
      ],
    ];

    // order type
    console.log('state[EWizardProp.OrderType]', ctx.wizard.state[EWizardProp.OrderType]);
    const orderType = ctx.wizard.state[EWizardProp.OrderType] || EOrderType.SwapOrderType;
    console.log('orderType', orderType);

    const keyboardData = [
      [
        { text: isBuyMode ? `${ESwapAction.BuyMode} ❎` : ESwapAction.BuyMode, callback_data: ESwapAction.BuyMode },
        { text: !isBuyMode ? `${ESwapAction.SellMode} ❎` : ESwapAction.SellMode, callback_data: ESwapAction.SellMode },
      ],
      [
        { text: isSwapOrder(orderType) ? `${EOrderType.SwapOrderType} ❎` : EOrderType.SwapOrderType, callback_data: EOrderType.SwapOrderType },
        { text: isLimitOrder(orderType) ? `${EOrderType.LimitOrderType} ❎` : EOrderType.LimitOrderType, callback_data: EOrderType.LimitOrderType },
        { text: isDCAOrder(orderType) ? `${EOrderType.DCAOrderType} ❎` : EOrderType.DCAOrderType, callback_data: EOrderType.DCAOrderType },
      ],
      [{ text: ESwapAction.Wallets, callback_data: ESwapAction.Wallets }],
      ...walletKeyboardData,
      [{ text: ESwapAction.Actions, callback_data: ESwapAction.Actions }],
      ...(isBuyMode ? buyKeyboardData : sellKeyboardData),
      [{ text: ENavAction.Cancel, callback_data: ENavAction.Cancel }],
    ];

    if (msg && (action || activeAddress)) {
      if (shouldDoNothing) {
        ctx.wizard.state[EWizardProp.DoNothing] = undefined;
        ctx.wizard.next();
      } else {
        ctx.telegram.editMessageReplyMarkup(msg.chat.id, msg.message_id, undefined, {
          inline_keyboard: keyboardData,
        });
        ctx.wizard.next();
      }
    } else {
      ctx.reply(
        `${name} (${symbol})\n----------------------------------------------------------------------------------------------------`,
        formatKeyboard(keyboardData),
      );
      ctx.wizard.next();
    }
  },
  async (ctx, done) => {
    const state = ctx.wizard.state;

    if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.Cancel)) {
      ctx.wizard.state[EWizardProp.Msg] = undefined;
      ctx.deleteMessage(ctx.callbackQuery.message?.message_id);
      done();
    } else if (ctx.has(callbackQuery('data'))) {
      const cbData = ctx.callbackQuery.data;
      console.log('cbData', cbData);
      const isWalletAddress = isAddress(cbData);
      console.log('isWalletAddress', isWalletAddress);
      console.log('Object.values(ESwapAction)', Object.values(ESwapAction));
      console.log('Object.values(EOrderType)', Object.values(EOrderType));
      if ((Object.values(ESwapAction) as string[]).includes(cbData)) {
        ctx.wizard.state[EWizardProp.Action] = cbData;
      } else if ((Object.values(EOrderType) as string[]).includes(cbData)) {
        console.log('setting ORDER TYPE', cbData);
        ctx.wizard.state[EWizardProp.OrderType] = cbData;
      } else if (isWalletAddress) {
        ctx.wizard.state[EWizardProp.ActiveAddress] = cbData;
      }
      if (
        ([ESwapAction.BuyMode, ESwapAction.SellMode, ESwapAction.Actions, ESwapAction.Wallets, ...Object.values(EOrderType)] as string[]).includes(
          cbData,
        ) ||
        isWalletAddress
      ) {
        const contract = state[EWizardProp.Contract] as IWizContractProp;
        console.log('contract', contract);
        const msg = ctx.callbackQuery.message as Message.TextMessage;
        console.log('msg', msg);
        const inlineKb = msg.reply_markup?.inline_keyboard as InlineKeyboardButton.CallbackButton[][];
        console.log('inlinKb', inlineKb);
        const activeButtons = inlineKb.reduce((acc, row) => {
          const activeButton = row.find((col) => col.text.includes('❎'));
          return activeButton ? acc.concat(activeButton.callback_data) : acc;
        }, [] as string[]);
        console.log('activeButtons', activeButtons);
        const isActiveButton = activeButtons.includes(cbData);
        const shouldDoNothing = isActiveButton || ([ESwapAction.Actions, ESwapAction.Wallets] as string[]).includes(cbData);
        console.log('shouldDoNothing', shouldDoNothing);
        console.log('state[EWizardProp.Action]', state[EWizardProp.Action]);
        console.log('ctx.scene.current.id', ctx.scene.current?.id);
        if (ctx.scene.current) {
          ctx.scene.enter(ctx.scene.current.id, {
            [EWizardProp.Msg]: msg,
            [EWizardProp.Contract]: contract,
            [EWizardProp.DoNothing]: shouldDoNothing,
            [EWizardProp.Action]: (Object.values(ESwapAction) as string[]).includes(cbData) ? cbData : state[EWizardProp.Action],
            ...(isWalletAddress && !shouldDoNothing
              ? { [EWizardProp.ActiveAddress]: cbData }
              : { [EWizardProp.ActiveAddress]: state[EWizardProp.ActiveAddress] }),
            [EWizardProp.OrderType]: (Object.values(EOrderType) as string[]).includes(cbData) ? cbData : undefined,
          });
        } else {
          done();
        }
      } else if (([ESwapAction.Buy_X, ESwapAction.Sell_X] as string[]).includes(cbData)) {
        const action = cbData === String(ESwapAction.Buy_X) ? 'buy' : 'sell';

        ctx.reply(`Enter ${action} amount`, { reply_markup: { force_reply: true } });
        ctx.wizard.next();
      } else {
        done();
      }
    } else {
      ctx.wizard.state[EWizardProp.Contract] = undefined;
      ctx.wizard.state[EWizardProp.Action] = undefined;
      ctx.wizard.state[EWizardProp.ActiveAddress] = undefined;
      done();
    }
  },
  async (ctx, done) => {
    if (ctx.has(message('reply_to_message', 'text'))) {
      const action = ctx.wizard.state[EWizardProp.Action] as string;
      const [swapMode] = action.split(/_(.+)/);
      ctx.wizard.state[EWizardProp.Action] = `${swapMode}_${ctx.message.text}`;
      done();
    } else {
      done();
    }
  },
);
