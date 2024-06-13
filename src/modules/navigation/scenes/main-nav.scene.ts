import _ from 'lodash';
import { callbackQuery, message } from 'telegraf/filters';
import { Message } from 'telegraf/typings/core/types/typegram';

import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { formatKeyboard } from '@/utils/common';

export const createMainNavScene = composeWizardScene(
  async (ctx) => {
    const keyboardData = [
      [{ text: ENavAction.Wallet, callback_data: ENavAction.Wallet }],
      [{ text: ENavAction.Funding, callback_data: ENavAction.Funding }],
      [{ text: ENavAction.Trade, callback_data: ENavAction.Trade }],
      [{ text: ENavAction.Bridge, callback_data: ENavAction.Bridge }],
      [{ text: ENavAction.Chain, callback_data: ENavAction.Chain }],
    ];

    const msg = ctx.wizard.state[EWizardProp.Msg] as Message.TextMessage | undefined;
    const hasSameContent = _.isEqual(msg?.reply_markup?.inline_keyboard, keyboardData);
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);

    if (msg && !isStart && msg?.reply_markup) {
      // Do nothing if the content is the same
      if (!hasSameContent) {
        ctx.telegram.editMessageReplyMarkup(msg.chat.id, msg.message_id, undefined, { inline_keyboard: keyboardData });
      }
    } else {
      ctx.reply('Manage TAPT', formatKeyboard(keyboardData));
    }
    ctx.wizard.next();
  },
  async (ctx, done) => {
    if (ctx.has(callbackQuery('data'))) {
      ctx.wizard.state[EWizardProp.Action] = ctx.callbackQuery.data;
      ctx.wizard.state[EWizardProp.Msg] = ctx.callbackQuery.message;
    }
    done();
  },
);
