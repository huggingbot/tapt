import log from 'loglevel';
import { callbackQuery, message } from 'telegraf/filters';

import { cancelOrder, getActiveOrders } from '@/database/queries/common';
import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { formatOrderOverview, formatOrderOverviewHeader } from '@/modules/bot/utils/trade-keyboard-data';
import { EOrderType, ILimitOrder } from '@/types';
import { formatKeyboard, isNumber } from '@/utils/common';

export const createActiveOrdersScene = composeWizardScene(
  async (ctx) => {
    let keyboardData = [[{ text: ENavAction.Back, callback_data: ENavAction.Back }]];
    const orderType = ctx.wizard.state[EWizardProp.OrderManagementMode] || EOrderType.Dca;

    let ordersData = `No active '${String(orderType).toUpperCase()}' orders found`;

    if (orderType === String(EOrderType.Limit)) {
      const activeLimitOrders = ctx.wizard.state[EWizardProp.ActiveLimitOrders] as ILimitOrder[];
      if (activeLimitOrders.length > 0) {
        keyboardData = [[{ text: ENavAction.Delete, callback_data: ENavAction.Delete }], ...keyboardData];
        const header = formatOrderOverviewHeader();
        const formattedOrderData = activeLimitOrders.map(formatOrderOverview);
        ordersData = `${header}${formattedOrderData.join('\n')}`;
      }
    } else if (orderType === String(EOrderType.Dca)) {
      const activeDcaOrders = ctx.wizard.state[EWizardProp.ActiveDcaOrders] as ILimitOrder[];
      if (activeDcaOrders.length > 0) {
        keyboardData = [[{ text: ENavAction.Delete, callback_data: ENavAction.Delete }], ...keyboardData];
        const header = formatOrderOverviewHeader();
        const formattedOrderData = activeDcaOrders.map(formatOrderOverview);
        ordersData = `${header}${formattedOrderData.join('\n')}`;
      }
    }

    ctx.reply(`Active '${String(orderType).toUpperCase()}' Orders\n====================\n\n${ordersData}`, formatKeyboard(keyboardData));
    ctx.wizard.next();
  },
  async (ctx, done) => {
    if (ctx.has(callbackQuery('data'))) {
      const action = ctx.callbackQuery.data;
      if (action === String(ENavAction.Delete)) {
        // cancel the order
        ctx.wizard.state[EWizardProp.OrderManagementAction] = EWizardProp.OrderManagementActionCancel;
        ctx.reply('Please enter the Order Id to cancel', { reply_markup: { force_reply: true } });
        ctx.wizard.next();
      } else {
        ctx.wizard.state[EWizardProp.Action] = ENavAction.Back;
        ctx.wizard.state[EWizardProp.Msg] = undefined;
        done();
      }
    } else {
      done();
    }
  },
  async (ctx, done) => {
    try {
      if (ctx.has(message('reply_to_message', 'text'))) {
        const action = ctx.wizard.state[EWizardProp.OrderManagementAction] as string;
        const actionItem = ctx.message.text.toString();
        const orderType = (ctx.wizard.state[EWizardProp.OrderManagementMode] as EOrderType) || EOrderType.Dca;

        if (!isNumber(actionItem)) {
          throw new Error(`Invalid order_id: ${actionItem}`);
        }
        if (action === String(EWizardProp.OrderManagementActionCancel)) {
          await ctx.reply(`Cancelling order id, ${actionItem}`);
          await cancelOrder(Number(actionItem), orderType);
          ctx.reply(`Order id, ${actionItem} has been successfully cancelled`);
          ctx.reply('Refreshing Order Management Scene...');
          if (orderType === EOrderType.Limit) {
            const activeLimitOrders = await getActiveOrders(EOrderType.Limit);
            ctx.wizard.state[EWizardProp.ActiveLimitOrders] = activeLimitOrders;
          } else if (orderType === EOrderType.Dca) {
            const activeDcaOrders = await getActiveOrders(EOrderType.Dca);
            ctx.wizard.state[EWizardProp.ActiveDcaOrders] = activeDcaOrders;
          }
        }
      }
    } catch (e: unknown) {
      ctx.wizard.state[EWizardProp.ReEnterTheScene] = true;
      ctx.wizard.state[EWizardProp.DoNothing] = true;
      ctx.wizard.state[EWizardProp.OrderManagementAction] = undefined;
      const errMsg = (e as Error).message || 'Something went wrong!';
      log.error(`Error processing active ordres, ${errMsg}`);
      ctx.reply(errMsg);
    } finally {
      done();
    }
  },
);
