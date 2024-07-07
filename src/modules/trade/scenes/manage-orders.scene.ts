import { callbackQuery } from 'telegraf/filters';

import { getActiveOrders } from '@/database/queries/common';
import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { EOrderType, ILimitOrder } from '@/types';
import { formatKeyboard } from '@/utils/common';

export const createManageOrdersScene = composeWizardScene(
  async (ctx) => {
    const keyboardData = [
      [{ text: ENavAction.ActiveLimitOrders, callback_data: ENavAction.ActiveLimitOrders }],
      [{ text: ENavAction.ActiveDcaOrders, callback_data: ENavAction.ActiveDcaOrders }],
      [{ text: ENavAction.Back, callback_data: ENavAction.Back }],
    ];

    ctx.reply('Manage Orders\n=============================', formatKeyboard(keyboardData));
    ctx.wizard.next();
  },
  async (ctx, done) => {
    try {
      if (ctx.has(callbackQuery('data'))) {
        const action = ctx.callbackQuery.data;
        if (action === String(ENavAction.Back)) {
          ctx.wizard.state[EWizardProp.Action] = ENavAction.Back;
          ctx.wizard.state[EWizardProp.Msg] = ctx.callbackQuery.message;
        } else if (action === String(ENavAction.ActiveLimitOrders)) {
          ctx.wizard.state[EWizardProp.Action] = ENavAction.ActiveOrders;
          ctx.wizard.state[EWizardProp.OrderManagementMode] = EOrderType.Limit;

          // fetch active LIMIT orders
          const activeLimitOrders = (await getActiveOrders(EOrderType.Limit)) as ILimitOrder[];
          ctx.wizard.state[EWizardProp.ActiveLimitOrders] = activeLimitOrders;
        } else if (action === String(ENavAction.ActiveDcaOrders)) {
          ctx.wizard.state[EWizardProp.Action] = ENavAction.ActiveOrders;
          ctx.wizard.state[EWizardProp.OrderManagementMode] = EOrderType.Dca;

          // fetch active DCA orders
          const activeDcaOrders = (await getActiveOrders(EOrderType.Dca)) as ILimitOrder[];
          ctx.wizard.state[EWizardProp.ActiveDcaOrders] = activeDcaOrders;
        }
      }
      done();
    } catch (e: unknown) {
      ctx.reply('Something went wrong please try again!');
      done();
    }
  },
);
