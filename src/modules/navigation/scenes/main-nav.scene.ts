import { callbackQuery } from 'telegraf/filters';

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

    ctx.reply('Manage TAPT\n=============================', formatKeyboard(keyboardData));
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
