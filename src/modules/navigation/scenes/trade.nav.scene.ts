import { callbackQuery } from 'telegraf/filters';

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
        { text: 'Active Limit Orders', callback_data: EWizardProp.ActiveLimitOrders },
        { text: 'Active DCA Orders', callback_data: EWizardProp.ActiveDcaOrders },
      ],
      [{ text: ENavAction.Back, callback_data: ENavAction.Back }],
    ];

    ctx.reply('Manage TAPT\n=============================', formatKeyboard(keyboardData));
    ctx.wizard.next();
  },
  async (ctx, done) => {
    if (ctx.has(callbackQuery('data'))) {
      const action = ctx.callbackQuery.data;
      const { network } = ctx.session.prop[ESessionProp.Chain];
      const wallets = ctx.session.prop[ESessionProp.Wallets][network];

      if (action === String(ENavAction.Back)) {
        ctx.wizard.state[EWizardProp.Action] = ENavAction.Back;
        ctx.wizard.state[EWizardProp.Msg] = ctx.callbackQuery.message;
      } else if (!wallets.length) {
        ctx.reply('You need to create a wallet first');
        ctx.wizard.state[EWizardProp.Action] = ENavAction.Back;
        ctx.wizard.state[EWizardProp.Msg] = ctx.callbackQuery.message;
      } else {
        if (action === String(EWizardProp.ActiveLimitOrders)) {
          ctx.wizard.state[EWizardProp.Action] = ENavAction.ActiveOrders;
          ctx.wizard.state[EWizardProp.OrderManagementMode] = EOrderType.Limit;
        } else if (action === String(EWizardProp.ActiveDcaOrders)) {
          ctx.wizard.state[EWizardProp.Action] = ENavAction.ActiveOrders;
          ctx.wizard.state[EWizardProp.OrderManagementMode] = EOrderType.Dca;
        } else {
          ctx.wizard.state[EWizardProp.Action] = action;
        }
      }
      ctx.wizard.state[EWizardProp.Msg] = ctx.callbackQuery.message;
    }
    done();
  },
);
