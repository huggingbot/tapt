import { callbackQuery } from 'telegraf/filters';

import { ENetwork } from '@/libs/config';
import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { formatKeyboard } from '@/utils/common';

export const createSwitchChainScene = composeWizardScene(
  async (ctx) => {
    const networks = Object.values(ENetwork).reduce(
      (acc, network) => {
        if (network !== ENetwork.Local) {
          const readableNetwork = network.charAt(0).toUpperCase() + network.slice(1);
          acc.push([{ text: readableNetwork, callback_data: String(network) }]);
        }
        return acc;
      },
      [] as { text: string; callback_data: string }[][],
    );

    const keyboardData = networks.concat([[{ text: 'Cancel', callback_data: ENavAction.Cancel }]]);

    ctx.reply('Select a chain', formatKeyboard(keyboardData));
    ctx.wizard.next();
  },
  async (ctx, done) => {
    if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.Cancel)) {
      ctx.deleteMessage(ctx.callbackQuery.message?.message_id);
      done();
    } else if (ctx.has(callbackQuery('data'))) {
      const newEnv = ctx.callbackQuery.data as ENetwork;
      const isValidNetwork = Object.values(ENetwork).includes(newEnv);

      if (!isValidNetwork) {
        ctx.reply('Invalid chain name');
        done();
      } else {
        ctx.session.prop[ESessionProp.Chain] = { network: newEnv };
        ctx.reply(`Switched to ${newEnv}`);
        done();
      }
    } else {
      done();
    }
  },
);
