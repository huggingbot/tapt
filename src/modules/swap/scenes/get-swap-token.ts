import { isAddress } from 'ethers/lib/utils';
import log from 'loglevel';
import { message } from 'telegraf/filters';

import { getErc20CommonProps, getErc20Contract } from '@/libs/contracts';
import { getProvider } from '@/libs/providers';
import { computeTokenPriceInUSD } from '@/libs/quoting';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { IWizContractProp } from '@/modules/bot/interfaces/bot-prop.interface';
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
        const contractAddress = ctx.message.text.toLowerCase();
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
            ctx.reply('Reterieving token info...');
            const erc20Contract = getErc20Contract(contractAddress, provider);
            const { name, symbol, decimals, address } = await getErc20CommonProps(erc20Contract);
            const contract: IWizContractProp = { name, symbol, decimals, address };
            ctx.reply('Computing token price...');
            const tokenPrice = await computeTokenPriceInUSD(contract, network);

            ctx.wizard.state[EWizardProp.Contract] = contract;
            ctx.wizard.state[EWizardProp.Msg] = ctx.message;
            ctx.wizard.state[EWizardProp.TokenPriceInUSD] = tokenPrice.quotedAmountInUSDCStr;
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
