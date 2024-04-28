import { callbackQuery } from 'telegraf/filters';

import { ELimitOptions, ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { formatKeyboard } from '@/utils/common';

export const createSubmitLimitOrderScene = composeWizardScene(
  async (ctx) => {
    const keyboardData = [
      [{ text: 'Preview Limit Order', callback_data: ELimitOptions.PreviewOrder }],
      [{ text: 'Submit Limit Order', callback_data: ELimitOptions.SubmitOrder }],
      [{ text: 'Cancel', callback_data: ENavAction.Cancel }],
    ];

    ctx.reply('Please confirm your limit order', formatKeyboard(keyboardData));
    ctx.wizard.next();
  },
  async (ctx, done) => {
    const state = ctx.wizard.state;
    if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.Cancel)) {
      ctx.wizard.state[EWizardProp.Contract] = undefined;
      ctx.wizard.state[EWizardProp.Action] = undefined;
      ctx.wizard.state[EWizardProp.OrderType] = undefined;
      done();
    } else if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ELimitOptions.PreviewOrder)) {
      // display preview of the limit order
      const action = state[EWizardProp.Action] as string;
      const contract = state[EWizardProp.Contract];
      const wallet = state[EWizardProp.ActiveAddress];
      const orderType = state[EWizardProp.OrderType];
      const [mode, rawSwapAmount] = action.split(/_(.+)/);

      console.log('preview', { mode, contract, wallet, orderType, rawSwapAmount });

      ctx.reply(`Order Preview\n${JSON.stringify({ mode, contract, wallet, orderType, rawSwapAmount })}`);

      done();
    } else if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ELimitOptions.SubmitOrder)) {
      // submit the order
      const action = state[EWizardProp.Action] as string;
      const contract = state[EWizardProp.Contract];
      const wallet = state[EWizardProp.ActiveAddress];
      const orderType = state[EWizardProp.OrderType];
      const [mode, rawSwapAmount] = action.split(/_(.+)/);

      done();
    }
  },
);
