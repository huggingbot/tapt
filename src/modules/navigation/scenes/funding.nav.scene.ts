import _ from 'lodash';
import { callbackQuery } from 'telegraf/filters';
import { Message } from 'telegraf/typings/core/types/typegram';

import { NATIVE_CURRENCY } from '@/libs/constants';
import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { formatKeyboard } from '@/utils/common';

export const createFundingNavScene = composeWizardScene(
  async (ctx) => {
    const { network } = ctx.session.prop[ESessionProp.Chain];
    const keyboardData = [
      [{ text: `Fund ${NATIVE_CURRENCY[network]} from wallet`, callback_data: ENavAction.FundFromSingleWallet }],
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
      ctx.reply('Manage funding', formatKeyboard(keyboardData));
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
