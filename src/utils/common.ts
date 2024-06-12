import { Markup } from 'telegraf';

import { ENetwork } from '@/libs/config';
import { NATIVE_CURRENCY } from '@/libs/constants';
import { EOrderExpiryUnit, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { IContext } from '@/modules/bot/interfaces/bot-context.interface';

import { EOrderType, ESwapAction } from '../modules/bot/constants/bot-action.constant';

export const formatKeyboard = (keyboard: { text: string; callback_data: string }[][]) => {
  return Markup.inlineKeyboard(
    keyboard.map((kb) => {
      return kb.map((btn) => Markup.button.callback(btn.text, btn.callback_data));
    }),
  );
};

export const truncateAddress = (address: string, length = 4) => {
  if (!address || address.length <= length * 2 + '0x'.length) {
    return address;
  }
  return `${address.substring(0, length + 2)}...${address.substring(address.length - length)}`;
};

export const isNumber = (val: unknown): boolean => {
  const n = Number(val);
  return !isNaN(n);
};

export const isSwapOrder = (order: unknown): boolean => order === EOrderType.SwapOrderType;

export const isLimitOrder = (order: unknown): boolean => order === EOrderType.LimitOrderType;

export const isDCAOrder = (order: unknown): boolean => order === EOrderType.DCAOrderType;

export const isBuyMode = (value: unknown): boolean => {
  const action = (value as string) || ESwapAction.BuyMode;
  const mode = action.replace(/_/g, ' ');
  return mode.split(' ')[0].toLowerCase() === 'buy';
};

export const populateBuyModeKeyboardData = (action: string, network: ENetwork) => {
  const currency = NATIVE_CURRENCY[network];

  let keyboardData = [];
  const _isBuyMode = isBuyMode(action);
  if (_isBuyMode) {
    keyboardData = [
      [
        { text: `Buy 0.01 ${currency}`, callback_data: ESwapAction.Buy_0_01 },
        { text: `Buy 0.2 ${currency}`, callback_data: ESwapAction.Buy_0_2 },
      ],
      [
        { text: `Buy 0.5 ${currency}`, callback_data: ESwapAction.Buy_0_5 },
        { text: `Buy 1 ${currency}`, callback_data: ESwapAction.Buy_1 },
      ],
      [
        { text: `Buy 3 ${currency}`, callback_data: ESwapAction.Buy_3 },
        { text: `Buy X ${currency}`, callback_data: ESwapAction.Buy_X },
      ],
    ];
  } else {
    keyboardData = [
      [
        { text: 'Sell 10%', callback_data: ESwapAction.Sell_10 },
        { text: 'Sell 20%', callback_data: ESwapAction.Sell_20 },
        { text: 'Sell 30%', callback_data: ESwapAction.Sell_30 },
      ],
      [
        { text: 'Sell 40%', callback_data: ESwapAction.Sell_40 },
        { text: 'Sell 50%', callback_data: ESwapAction.Sell_50 },
        { text: 'Sell 60%', callback_data: ESwapAction.Sell_60 },
      ],
      [
        { text: 'Sell 70%', callback_data: ESwapAction.Sell_70 },
        { text: 'Sell 80%', callback_data: ESwapAction.Sell_80 },
        { text: 'Sell 90%', callback_data: ESwapAction.Sell_90 },
      ],
      [
        { text: 'Sell all', callback_data: ESwapAction.Sell_100 },
        { text: 'Sell X token', callback_data: ESwapAction.Sell_X },
      ],
    ];
  }

  let selectedOption = action;
  if (!selectedOption || ([ESwapAction.BuyMode, ESwapAction.SellMode] as string[]).includes(selectedOption)) {
    // set default selected buy/sell price
    selectedOption = _isBuyMode ? String(ESwapAction.Buy_0_01) : String(ESwapAction.Sell_10);
  }

  const modifiedKeyboardData = keyboardData.map((row) => {
    return row.map((cell) => {
      if (selectedOption === String(cell.callback_data)) {
        return { ...cell, text: `❎ ${cell.text}` };
      } else if (
        // custom value
        !(Object.values(ESwapAction) as string[]).includes(selectedOption) &&
        ((_isBuyMode && cell.callback_data === ESwapAction.Buy_X) || (!_isBuyMode && cell.callback_data === ESwapAction.Sell_X))
      ) {
        // extract the custom value
        const [mode, amount] = selectedOption.split('_');
        return { ...cell, text: `❎ ${mode}_${amount}` };
      }
      return cell;
    });
  });

  return modifiedKeyboardData;
};

export const resetScene = (ctx: IContext) => {
  Object.values(EWizardProp).forEach((prop) => {
    ctx.wizard.state[prop] = undefined;
  });
};

export const isValidPercentageValue = (val: string): boolean => {
  return val.trim().endsWith('%') && isNumber(val.trim().replace('%', ''));
};

// validating target price for limit order
export const isTargetPriceValid = (action: unknown, targetPrice: string): boolean => {
  // check if the input is number of the percentage value
  if (!isValidPercentageValue(targetPrice) && !isNumber(targetPrice)) {
    return false;
  }

  const num = Number(targetPrice.trim().replace('%', ''));
  if (isBuyMode(action)) {
    // buy mode
    return num < 0;
  }
  return num > 0;
};

export const isDcaPriceThresholdValid = (minPrice: string, maxPrice: string) => {
  if (!isValidPercentageValue(minPrice) && !isNumber(minPrice)) {
    return false;
  }

  if (!isValidPercentageValue(maxPrice) && !isNumber(maxPrice)) {
    return false;
  }

  const min = Number(minPrice.trim().replace('%', ''));
  const max = Number(maxPrice.trim().replace('%', ''));
  if (min > max) {
    throw new Error(`Maximum price, ${maxPrice} cannot be lower than minimum price, ${minPrice}`);
  }
  return true;
};

/**
 * verify if the order expiry value from user input is valid
 * valid units
 *  - m (minute)
 *  - h (hour)
 *  - d (day)
 *  - w (week)
 *  - M (month)
 * @param {string} rawOrderExpiry - order expiry raw input
 * @param {RegExp} allowedTimeUnit - regex to validate timeunit
 * @return {boolean}
 */
export const isValidTimeValue = (rawOrderExpiry: string, allowedTimeUnit?: RegExp): boolean => {
  const timeUnitRgx = allowedTimeUnit ?? /(m|h|d|w|M)$/;
  const finalRgx = new RegExp(/^[0-9]+/.source + timeUnitRgx.source);
  // regex pattern to validate the raw input
  return finalRgx.test(rawOrderExpiry.trim());
};

export const computeFinalDateFromInterval = (interval: string): Date => {
  if (!isValidTimeValue(interval)) {
    throw new Error(`Invalid time value, ${interval}`);
  }
  // trim any leading/trailing whitespaces
  const trimmedOrderExpiryShort = interval.trim();
  const timeUnit = trimmedOrderExpiryShort.slice(-1);
  const timeValue = Number(trimmedOrderExpiryShort.replace(/\D/, ''));
  if (isNaN(timeValue)) {
    throw new Error(`Invalid time value, ${interval}`);
  }
  const orderExpiryDate = new Date();

  switch (timeUnit) {
    case String(EOrderExpiryUnit.Minute):
      orderExpiryDate.setMinutes(orderExpiryDate.getMinutes() + timeValue);
      break;
    case String(EOrderExpiryUnit.Hour):
      orderExpiryDate.setHours(orderExpiryDate.getHours() + timeValue);
      break;
    case String(EOrderExpiryUnit.Day):
      orderExpiryDate.setDate(orderExpiryDate.getDate() + timeValue);
      break;
    case String(EOrderExpiryUnit.Week):
      orderExpiryDate.setDate(orderExpiryDate.getDate() + 7 * timeValue);
      break;
    case String(EOrderExpiryUnit.Month):
      orderExpiryDate.setMonth(orderExpiryDate.getMonth() + timeValue);
      break;
    default:
      throw new Error(`Invalid time value, ${interval}`);
  }

  return orderExpiryDate;
};

export const computeMinutesFromIntervalString = (interval: string): number => {
  if (!isValidTimeValue(interval)) {
    throw new Error(`Invalid time value, ${interval}`);
  }

  // trim any leading/trailing whitespaces
  const trimmedOrderExpiryShort = interval.trim();
  const timeUnit = trimmedOrderExpiryShort.slice(-1);
  const timeValue = Number(trimmedOrderExpiryShort.replace(/\D/g, ''));
  if (isNaN(timeValue)) {
    throw new Error(`Invalid time value, ${interval}`);
  }

  switch (timeUnit) {
    case String(EOrderExpiryUnit.Minute):
      return timeValue;
    case String(EOrderExpiryUnit.Hour):
      return timeValue * 60;
    case String(EOrderExpiryUnit.Day):
      return timeValue * 1440;
    default:
      throw new Error(`Invalid time value, ${interval}`);
  }
};

export const compareTimeUnitValue = (val1: string, val2: string): -1 | 0 | 1 => {
  const minuteVal1 = computeMinutesFromIntervalString(val1);
  const minuteVal2 = computeMinutesFromIntervalString(val2);

  if (minuteVal1 === minuteVal2) {
    return 0;
  }
  return minuteVal1 > minuteVal2 ? 1 : -1;
};
