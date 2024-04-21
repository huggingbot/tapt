import { Markup } from 'telegraf';

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
