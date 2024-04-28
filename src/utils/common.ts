import { Markup } from 'telegraf';

import { EOrderType } from '../modules/bot/constants/bot-action.constant';

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
