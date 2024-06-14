// this file includes functions related to the trade scene

import { message } from 'telegraf/filters';

import { compareTimeUnitValue, isDcaPriceThresholdValid, isNumber, isTargetPriceValid, isValidTimeValue } from '@/utils/common';

import { DEFAULT_TRADE_OPTIONS, EDcaOrderKeyboardData, EOrderDetails, ESwapAction } from '../constants/bot-action.constant';
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
  const action = ctx.wizard.state[EWizardProp.Action] || ESwapAction.BuyMode;
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
      txt += 'Valid options are % of current price (e.g. -5% or 5%) or a specific price.';
      break;
    case String(EDcaOrderKeyboardData.MaxPrice):
      txt = `Enter the maximum price threshold at which to ${mode} the token.`;
      txt += 'Valid options are % of current price (e.g. -5% or 5%) or a specific price.';
      break;
    default:
      throw new Error(`Invalid DCA Order option: ${callbackData}`);
  }

  ctx.reply(txt, { reply_markup: { force_reply: true } });
  ctx.wizard.state[EWizardProp.OrderDetailsAction] = callbackData;
  ctx.wizard.next();
}

export function getLimitOrderOptionDataFromUserReply(ctx: IContext, action: ESwapAction, orderDetailsAction: unknown) {
  if (!ctx.has(message('reply_to_message', 'text'))) {
    return;
  }
  if (orderDetailsAction === String(EOrderDetails.Expiry)) {
    const orderExpiry = ctx.message.text.toString();
    if (!isValidTimeValue(orderExpiry)) {
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

export function getDcaOrderOptionDataFromUserReply(ctx: IContext, action: ESwapAction, orderDetailsAction: unknown) {
  if (!ctx.has(message('reply_to_message', 'text'))) {
    return;
  }
  const repliedData = ctx.message.text.toString();
  const interval = (ctx.wizard.state[EWizardProp.DcaInterval] as string) || DEFAULT_TRADE_OPTIONS.DcaInterval;
  const duration = (ctx.wizard.state[EWizardProp.DcaDuration] as string) || DEFAULT_TRADE_OPTIONS.DcaDuration;
  const maxPrice = (ctx.wizard.state[EWizardProp.DcaMaxPrice] as string) || DEFAULT_TRADE_OPTIONS.DcaMaxPrice;
  const minPrice = (ctx.wizard.state[EWizardProp.DcaMinPrice] as string) || DEFAULT_TRADE_OPTIONS.DcaMinPrice;
  switch (orderDetailsAction as string) {
    case String(EDcaOrderKeyboardData.Duration):
      if (!isValidTimeValue(repliedData, /(m|h|d)$/)) {
        throw new Error(`Invalid Dca Duration value: ${repliedData}`);
      }
      if (compareTimeUnitValue(repliedData, interval) < 1) {
        throw new Error(`Invalid Dca Interval value: ${repliedData}. Duration value must be larger than DCA interval, ${interval}`);
      }
      ctx.wizard.state[EWizardProp.DcaDuration] = repliedData;
      break;
    case String(EDcaOrderKeyboardData.Interval):
      if (!isValidTimeValue(repliedData, /(m|h|d)$/)) {
        throw new Error(`Invalid Dca Interval value: ${repliedData}`);
      }
      if (compareTimeUnitValue(repliedData, duration) > 0) {
        throw new Error(`Invalid Dca Interval value: ${repliedData}. Interval value cannot be larger than or equal to DCA Duration, ${duration}`);
      }
      ctx.wizard.state[EWizardProp.DcaInterval] = repliedData;
      break;
    case String(EDcaOrderKeyboardData.MinPrice):
      if (!isDcaPriceThresholdValid(repliedData, maxPrice)) {
        throw new Error(`Invalid Dca minimum price: ${repliedData}`);
      }
      ctx.wizard.state[EWizardProp.DcaMinPrice] = repliedData;
      break;
    case String(EDcaOrderKeyboardData.MaxPrice):
      if (!isDcaPriceThresholdValid(minPrice, repliedData)) {
        throw new Error(`Invalid Dca maximum price: ${repliedData}`);
      }
      ctx.wizard.state[EWizardProp.DcaMaxPrice] = repliedData;
      break;
    default:
      throw new Error(`Invalid Dca Order Option: ${orderDetailsAction as string}`);
  }
}

export function getCustomOrderPriceFromUserReply(ctx: IContext) {
  if (!ctx.has(message('reply_to_message', 'text'))) {
    return;
  }
  const action = ctx.wizard.state[EWizardProp.Action] as string;
  const customBuySellAmount = ctx.message.text.toLowerCase();
  if (!isNumber(customBuySellAmount)) {
    throw new Error(`Invalid amount, ${customBuySellAmount} entered.`);
  }
  const [swapMode] = action.split(/_(.+)/);
  ctx.wizard.state[EWizardProp.Action] = `${swapMode}_${customBuySellAmount}`;
}
