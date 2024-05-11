import { callbackQuery } from 'telegraf/filters';

import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { formatKeyboard } from '@/utils/common';

export const createBridgeEthToZkLinkScene = composeWizardScene(
  async (ctx) => {
    const keyboardData = [[{ text: 'Cancel', callback_data: ENavAction.Cancel }]];
    ctx.reply('TODO: Implement bridge eth to zklink', formatKeyboard(keyboardData));
    ctx.wizard.next();
  },
  async (ctx, done) => {
    if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.Cancel)) {
      ctx.deleteMessage(ctx.callbackQuery.message?.message_id);
    }
    done();
  },
);
