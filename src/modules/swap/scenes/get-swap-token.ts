import { isAddress } from 'ethers/lib/utils';
import log from 'loglevel';
import { message } from 'telegraf/filters';

import { getErc20CommonProps, getErc20Contract } from '@/libs/contracts';
import { getProvider } from '@/libs/providers';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';

export const createGetSwapTokenScene = composeWizardScene(
  async (ctx) => {
    if (ctx.wizard.state[EWizardProp.Reentering]) {
      ctx.wizard.state[EWizardProp.Reentering] = false;
      ctx.wizard.next();
    } else {
      ctx.reply(`Enter token contract to begin buy and sell`, { reply_markup: { force_reply: true } });
      ctx.wizard.next();
    }
  },
  async (ctx, done) => {
    if (ctx.has(message('reply_to_message', 'text'))) {
      try {
        const contractAddress = ctx.message.text;
        const isValidAddress = isAddress(contractAddress);

        if (!isValidAddress) {
          ctx.reply('Address is not valid');
          done();
        } else {
          const { network } = ctx.session.prop[ESessionProp.Chain];
          const provider = getProvider(network);
          const code = await provider.getCode(contractAddress);
          const isContract = code !== '0x';

          if (!isContract) {
            ctx.reply('Address is not a contract');
            done();
          } else {
            const contract = getErc20Contract(contractAddress, provider);
            const { name, symbol, decimals, address } = await getErc20CommonProps(contract);

            ctx.wizard.state[EWizardProp.Contract] = { name, symbol, decimals, address };
            ctx.wizard.state[EWizardProp.Msg] = ctx.message;
            done();
          }
        }
      } catch (err) {
        log.error(`Error occurred in createGetSwapTokenScene: ${String(err)}`);
        ctx.reply('Something went wrong. Please try again');
        done();
      }
    } else {
      done();
    }
  },
);
