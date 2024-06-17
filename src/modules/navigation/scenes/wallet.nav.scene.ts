import _ from 'lodash';
import { callbackQuery } from 'telegraf/filters';
import { Message } from 'telegraf/typings/core/types/typegram';

import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { formatKeyboard } from '@/utils/common';

export const createWalletNavScene = composeWizardScene(
  async (ctx) => {
    const keyboardData = [
      [{ text: ENavAction.WalletCount, callback_data: ENavAction.WalletCount }],
      [{ text: ENavAction.WalletList, callback_data: ENavAction.WalletList }],
      [{ text: ENavAction.PeekBalance, callback_data: ENavAction.PeekBalance }],
      [{ text: ENavAction.WalletCreate, callback_data: ENavAction.WalletCreate }],
      [{ text: ENavAction.WalletImport, callback_data: ENavAction.WalletImport }],
      [{ text: ENavAction.Back, callback_data: ENavAction.Back }],
    ];

    const msg = ctx.wizard.state[EWizardProp.Msg] as Message.TextMessage | undefined;
    const hasSameContent = _.isEqual(msg?.reply_markup?.inline_keyboard, keyboardData);

    if (msg) {
      // Do nothing if the content is the same
      if (!hasSameContent) {
        ctx.telegram.editMessageReplyMarkup(msg.chat.id, msg.message_id, undefined, { inline_keyboard: keyboardData });
      }
    } else {
      ctx.reply('Manage wallets', formatKeyboard(keyboardData));
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
