import _ from 'lodash';
import { callbackQuery } from 'telegraf/filters';
import { Message } from 'telegraf/typings/core/types/typegram';

import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { formatKeyboard } from '@/utils/common';

export const createSwapNavScene = composeWizardScene(
  async (ctx) => {
    const keyboardData = [
      [{ text: 'Swap tokens', callback_data: ENavAction.GetSwapToken }],
      [{ text: ENavAction.Back, callback_data: ENavAction.Back }],
    ];

    const msg = ctx.wizard.state[EWizardProp.Msg] as Message.TextMessage | undefined;
    const hasSameContent = _.isEqual(msg?.reply_markup?.inline_keyboard, keyboardData);

    if (msg && msg?.reply_markup) {
      // Do nothing if the content is the same
      if (!hasSameContent) {
        ctx.telegram.editMessageReplyMarkup(msg.chat.id, msg.message_id, undefined, { inline_keyboard: keyboardData });
      }
    } else {
      ctx.reply('Manage swaps', formatKeyboard(keyboardData));
    }
    ctx.wizard.next();
  },
  async (ctx, done) => {
    if (ctx.has(callbackQuery('data'))) {
      const action = ctx.callbackQuery.data;
      const { network } = ctx.session.prop[ESessionProp.Chain];
      const wallets = ctx.session.prop[ESessionProp.Wallets][network];

      if (action === String(ENavAction.GetSwapToken) && !wallets.length) {
        ctx.reply('You need to create a wallet first');
        ctx.wizard.state[EWizardProp.Action] = ENavAction.Back;
        ctx.wizard.state[EWizardProp.Msg] = ctx.callbackQuery.message;
      } else {
        ctx.wizard.state[EWizardProp.Action] = action;
        ctx.wizard.state[EWizardProp.Msg] = ctx.callbackQuery.message;
      }
    }
    done();
  },
);
