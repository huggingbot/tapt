import _ from 'lodash';
import { callbackQuery, message } from 'telegraf/filters';
import { Message } from 'telegraf/typings/core/types/typegram';

import { getActiveOrders } from '@/database/queries/common';
import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { EOrderType } from '@/types';
import { formatKeyboard } from '@/utils/common';

export const createTradeNavScene = composeWizardScene(
  async (ctx) => {
    const keyboardData = [
      [{ text: ENavAction.GetTradeToken, callback_data: ENavAction.GetTradeToken }],
      [
        { text: ENavAction.ActiveLimitOrders, callback_data: ENavAction.ActiveLimitOrders },
        { text: ENavAction.ActiveDcaOrders, callback_data: ENavAction.ActiveDcaOrders },
      ],
      [{ text: ENavAction.Back, callback_data: ENavAction.Back }],
    ];

    // const msg = ctx.wizard.state[EWizardProp.Msg] as Message.TextMessage | undefined;
    // const hasSameContent = _.isEqual(msg?.reply_markup?.inline_keyboard, keyboardData);
    // const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);
    // console.log("trade.nav::msg", msg);
    // if (msg && !isStart && msg?.reply_markup) {
    //   // Do nothing if the content is the same
    //   if (!hasSameContent) {
    //     ctx.telegram.editMessageReplyMarkup(msg.chat.id, msg.message_id, undefined, { inline_keyboard: keyboardData });
    //   }
    // } else {
    //   ctx.reply('Manage TAPT\n=============================', formatKeyboard(keyboardData));
    // }
    ctx.reply('Manage TAPT\n=============================', formatKeyboard(keyboardData));
    ctx.wizard.next();
  },
  async (ctx, done) => {
    if (ctx.has(callbackQuery('data'))) {
      const action = ctx.callbackQuery.data;
      const { network } = ctx.session.prop[ESessionProp.Chain];
      const wallets = ctx.session.prop[ESessionProp.Wallets][network];
      console.log('trade.nav::action', action);
      if (action === String(ENavAction.Back) && !wallets.length) {
        ctx.reply('You need to create a wallet first');
        ctx.wizard.state[EWizardProp.Action] = ENavAction.Back;
        ctx.wizard.state[EWizardProp.Msg] = ctx.callbackQuery.message;
      } else if (action === String(ENavAction.ActiveLimitOrders)) {
        const activeLimitOrders = await getActiveOrders(EOrderType.Limit);
        ctx.wizard.state[EWizardProp.ActiveLimitOrders] = activeLimitOrders;
        ctx.wizard.state[EWizardProp.Action] = action;
      } else if (action === String(ENavAction.ActiveDcaOrders)) {
        const activeDcaOrders = await getActiveOrders(EOrderType.Dca);
        ctx.wizard.state[EWizardProp.ActiveDcaOrders] = activeDcaOrders;
        ctx.wizard.state[EWizardProp.Action] = action;
      } else {
        ctx.wizard.state[EWizardProp.Action] = action;
      }
      ctx.wizard.state[EWizardProp.Msg] = ctx.callbackQuery.message;
    }
    done();
  },
);
