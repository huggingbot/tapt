// this file includes functions related to the trade scene

import { message } from 'telegraf/filters';

import { isOrderExpiryValid, isTargetPriceValid } from '@/utils/common';

import { EDcaOrderKeyboardData, EOrderDetails, ESwapAction } from '../constants/bot-action.constant';
import { EWizardProp } from '../constants/bot-prop.constant';
import { ORDER_EXPIRY_UNITS_TEXT } from '../constants/bot-reply-constant';
import { IContext } from '../interfaces/bot-context.interface';

// Reply user to enter custom trade amount
export function presentCustomTradeAmountQuestion(ctx: IContext, callbackData: string) {
  const action = callbackData === String(ESwapAction.Buy_X) ? 'buy' : 'sell';

  ctx.reply(`Enter ${action} amount`, { reply_markup: { force_reply: true } });
  ctx.wizard.next();
}

// Reply user to enter selected trade option
export function presentLimitOrderDetailsQuestion(ctx: IContext, callbackData: string) {
  const action = callbackData || ESwapAction.BuyMode;
  const mode = action === String(ESwapAction.Buy_X) ? 'buy' : 'sell';
  let txt = '';
  if (callbackData === String(EOrderDetails.TriggerPrice)) {
    txt = `Enter the trigger price of your limit ${mode} order. Valid options are % change (e.g. -5% or 5%) or a specific price.`;
  } else if (callbackData === String(EOrderDetails.Expiry)) {
    txt = `Enter the expiry of your limit ${mode} order. ${ORDER_EXPIRY_UNITS_TEXT}`;
  }
  ctx.reply(txt, { reply_markup: { force_reply: true } });
  ctx.wizard.state[EWizardProp.OrderDetailsAction] = callbackData;
  ctx.wizard.next();
}

// Reply user to enter selected trade option
export function presentDcaOrderDetailsQuestion(ctx: IContext, callbackData: string) {
  // Receive DCA Order details from user
  const action = callbackData || ESwapAction.BuyMode;
  const mode = action === String(ESwapAction.Buy_X) ? 'buy' : 'sell';
  let txt = '';
  switch (callbackData) {
    case String(EDcaOrderKeyboardData.Duration):
      txt = `Enter the duration of DCA Plan (${mode}). Valid options are m (minutes), h (hours), and d (days). E.g. 30m or 2h.`;
      break;
    case String(EDcaOrderKeyboardData.Interval):
      txt = `Enter the interval at which to ${mode} the token. Valid options are m (minutes), h (hours), and d (days). E.g. 30m or 2h.`;
      break;
    case String(EDcaOrderKeyboardData.MinPrice):
      txt = `Enter the minimum price threshold at which to ${mode} the token.`;
      txt += 'Valid options are % of current price (e.g. -5% or 5%) or a specific price or market cap (e.g. 5.5M mc or 15000 mcap).';
      break;
    case String(EDcaOrderKeyboardData.MaxPrice):
      txt = `Enter the maximum price threshold at which to ${mode} the token.`;
      txt += 'Valid options are % of current price (e.g. -5% or 5%) or a specific price or market cap (e.g. 5.5M mc or 15000 mcap).';
      break;
    default:
      throw new Error(`Invalid DCA Order option: ${callbackData}`);
  }

  ctx.reply(txt, { reply_markup: { force_reply: true } });
  ctx.wizard.state[EWizardProp.OrderDetailsAction] = callbackData;
  ctx.wizard.next();
}

export async function getLimitOrderOptionDataFromUserReply(ctx: IContext, action: ESwapAction, orderDetailsAction: unknown) {
  if (!ctx.has(message('reply_to_message', 'text'))) {
    return;
  }
  if (orderDetailsAction === String(EOrderDetails.Expiry)) {
    const orderExpiry = ctx.message.text.toString();
    if (!isOrderExpiryValid(orderExpiry)) {
      throw new Error(`Invalid order expiry, ${orderExpiry}`);
    } else {
      ctx.wizard.state[EWizardProp.Expiry] = ctx.message.text.toString();
    }
  } else if (orderDetailsAction === String(EOrderDetails.TriggerPrice)) {
    // validate input
    const targetPrice = ctx.message.text.toString();
    if (!isTargetPriceValid(action, targetPrice)) {
      throw new Error(`Invalid target price, ${targetPrice}, for ${action as string}`);
    } else {
      ctx.wizard.state[EWizardProp.TriggerPrice] = targetPrice;
    }
  }
}

export async function getDcaOrderOptionDataFromUserReply(ctx: IContext, action: ESwapAction, orderDetailsAction: unknown) {
  if (!ctx.has(message('reply_to_message', 'text'))) {
    return;
  }
  const repliedData = ctx.message.text.toString();
  switch (orderDetailsAction as string) {
    case String(EDcaOrderKeyboardData.Duration):
      ctx.wizard.state[EWizardProp.DcaDuration] = repliedData;
      break;
    case String(EDcaOrderKeyboardData.Interval):
      ctx.wizard.state[EWizardProp.DcaInterval] = repliedData;
      break;
    case String(EDcaOrderKeyboardData.MinPrice):
      ctx.wizard.state[EWizardProp.DcaMinPrice] = repliedData;
      break;
    case String(EDcaOrderKeyboardData.MaxPrice):
      ctx.wizard.state[EWizardProp.DcaMaxPrice] = repliedData;
      break;
    default:
      throw new Error(`Invalid Dca Order Option: ${orderDetailsAction as string}`);
  }
}
