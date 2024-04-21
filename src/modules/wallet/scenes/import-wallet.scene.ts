import { Wallet } from 'ethers';
import { message } from 'telegraf/filters';

import { createWallets } from '@/database/queries/wallet';
import { AppConfig, ENetwork } from '@/libs/config';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { ExtendedSession } from '@/modules/bot/interfaces/bot-context.interface';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { encryptPrivateKey } from '@/utils/crypto';

export const createImportWalletScene = composeWizardScene(
  async (ctx) => {
    if (ctx.wizard.state[EWizardProp.Reentering]) {
      ctx.wizard.state[EWizardProp.Reentering] = false;
      ctx.wizard.next();
    } else {
      ctx.reply('Enter private keys separated by comma', { reply_markup: { force_reply: true } });
      ctx.wizard.next();
    }
  },
  async (ctx, done) => {
    if (ctx.has(message('reply_to_message', 'text'))) {
      const wallets: ExtendedSession['prop'][ESessionProp.Wallets][ENetwork] = [];

      const rawPrivateKeys = ctx.message.text;
      const privateKeys = rawPrivateKeys.split(/,\s?/);

      try {
        const { network } = ctx.session.prop[ESessionProp.Chain];

        const addresses: string[] = [];

        privateKeys.forEach((key) => {
          const privateKeyHex = key.startsWith('0x') ? key : `0x${key}`;
          const { address, privateKey } = new Wallet(privateKeyHex);
          addresses.push(address);
          wallets.push({ encryptedPrivateKey: encryptPrivateKey(privateKey), address: address, chainId: AppConfig[network].chainId });
        });
        await createWallets(String(ctx.session.user.id), wallets);

        ctx.session.prop[ESessionProp.Wallets][network] = ctx.session.prop[ESessionProp.Wallets][network].concat(wallets);

        ctx.reply(`✅ **Wallets imported!**\n\`${addresses.join('\n')}\``, {
          parse_mode: 'Markdown',
        });

        done();
      } catch (err) {
        ctx.reply('Invalid private key(s)');
        done();
      }
    } else {
      done();
    }
  },
);
