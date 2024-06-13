import { callbackQuery } from 'telegraf/filters';

import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { ILimitOrder } from '@/types';
import { formatKeyboard } from '@/utils/common';

export const createActiveLimitOrdersScene = composeWizardScene(
  async (ctx) => {
    let keyboardData = [[{ text: ENavAction.Back, callback_data: ENavAction.Back }]];

    const activeLimitOrders = ctx.wizard.state[EWizardProp.ActiveLimitOrders] as ILimitOrder[];
    if (activeLimitOrders.length > 0) {
      keyboardData = [[{ text: ENavAction.Update, callback_data: ENavAction.Update }], ...keyboardData];
    }

    ctx.reply('Active Limit Orders', formatKeyboard(keyboardData));
    ctx.wizard.next();
  },
  async (ctx, done) => {
    if (ctx.has(callbackQuery('data'))) {
      ctx.wizard.state[EWizardProp.Action] = ENavAction.Back;
      ctx.wizard.state[EWizardProp.Msg] = undefined;
    }
    done();
  },
);
