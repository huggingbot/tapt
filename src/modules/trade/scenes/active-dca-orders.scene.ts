import { isEqual } from 'lodash';
import { callbackQuery } from 'telegraf/filters';
import { Message } from 'telegraf/types';

import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { IDcaOrder } from '@/types';
import { formatKeyboard } from '@/utils/common';

export const createActiveDcaOrdersScene = composeWizardScene(
  async (ctx) => {
    let keyboardData = [[{ text: ENavAction.Back, callback_data: ENavAction.Back }]];

    const activeDcaOrders = ctx.wizard.state[EWizardProp.ActiveDcaOrders] as IDcaOrder[];
    if (activeDcaOrders.length > 0) {
      keyboardData = [[{ text: ENavAction.Update, callback_data: ENavAction.Update }], ...keyboardData];
    }

    const msg = ctx.wizard.state[EWizardProp.Msg] as Message.TextMessage | undefined;
    const hasSameContent = isEqual(msg?.reply_markup?.inline_keyboard, keyboardData);

    if (msg && msg?.reply_markup) {
      // Do nothing if the content is the same
      if (!hasSameContent) {
        ctx.telegram.editMessageReplyMarkup(msg.chat.id, msg.message_id, undefined, { inline_keyboard: keyboardData });
      }
    } else {
      ctx.reply('Active Limit Orders', formatKeyboard(keyboardData));
    }
    ctx.wizard.next();
  },
  async (ctx, done) => {
    if (ctx.has(callbackQuery('data'))) {
      ctx.wizard.state[EWizardProp.Action] = ENavAction.Back;
    }
    ctx.wizard.state[EWizardProp.Msg] = undefined;
    done();
  },
);
