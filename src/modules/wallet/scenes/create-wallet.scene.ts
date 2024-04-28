import { Wallet } from 'ethers';
import { callbackQuery, message } from 'telegraf/filters';

import { createWallets } from '@/database/queries/wallet';
import { AppConfig, ENetwork } from '@/libs/config';
import { NATIVE_CURRENCY } from '@/libs/constants';
import { ENavAction, EWalletAction } from '@/modules/bot/constants/bot-action.constant';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { ExtendedSession } from '@/modules/bot/interfaces/bot-context.interface';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { formatKeyboard } from '@/utils/common';
import { encryptPrivateKey } from '@/utils/crypto';

export const createCreateWalletScene = composeWizardScene(
  async (ctx) => {
    const keyboardData = [
      [{ text: '1', callback_data: EWalletAction.CreateWallet_01 }],
      [{ text: '3', callback_data: EWalletAction.CreateWallet_03 }],
      [{ text: '5', callback_data: EWalletAction.CreateWallet_05 }],
      [{ text: '10', callback_data: EWalletAction.CreateWallet_10 }],
      [{ text: 'Cancel', callback_data: ENavAction.Cancel }],
    ];

    if (ctx.wizard.state[EWizardProp.Reentering]) {
      ctx.wizard.state[EWizardProp.Reentering] = false;
      ctx.wizard.next();
    } else {
      ctx.reply('Select the number of wallets you want to create', formatKeyboard(keyboardData));
      ctx.wizard.next();
    }
  },
  async (ctx, done) => {
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);
    if (isStart) {
      done();
    } else if (ctx.has(callbackQuery('data')) && ctx.callbackQuery.data === String(ENavAction.Cancel)) {
      ctx.deleteMessage(ctx.callbackQuery.message?.message_id);
      done();
    } else if (ctx.has(callbackQuery('data'))) {
      ctx.wizard.state[EWizardProp.Msg] = ctx.callbackQuery.message;

      const wallets: ExtendedSession['prop'][ESessionProp.Wallets][ENetwork] = [];
      const walletsToCreate = Number(ctx.callbackQuery.data.split('_')[1]);

      if (Number.isNaN(walletsToCreate)) {
        ctx.reply('Invalid input');
        if (ctx.scene.current) {
          ctx.scene.enter(ctx.scene.current.id, { [EWizardProp.Msg]: ctx.callbackQuery.message, [EWizardProp.Reentering]: true });
        }
      } else {
        const { network } = ctx.session.prop[ESessionProp.Chain];

        const addresses: string[] = [];
        const privateKeys: string[] = [];

        for (let i = 0; i < walletsToCreate; i++) {
          const { address, privateKey } = Wallet.createRandom();
          const lowerAddress = address.toLowerCase();
          const lowerPrivate = privateKey.toLowerCase();
          addresses.push(`(${i}) ${lowerAddress}`);
          privateKeys.push(`(${i}) ${lowerPrivate}`);
          wallets.push({ encryptedPrivateKey: encryptPrivateKey(lowerPrivate), address: lowerAddress, chainId: AppConfig[network].chainId });
        }
        await createWallets(String(ctx.session.user.id), wallets);

        ctx.session.prop[ESessionProp.Wallets][network] = ctx.session.prop[ESessionProp.Wallets][network].concat(wallets);

        ctx.reply(`✅ **Wallets created!**\nDeposit ${NATIVE_CURRENCY[network]} to these addresses:\n\`${addresses.join('\n')}\``, {
          parse_mode: 'Markdown',
        });
        ctx.reply(`Private keys:\n\`${privateKeys.join('\n')}\``, {
          parse_mode: 'Markdown',
        });
        done();
      }
    } else {
      ctx.reply('Invalid input');
      done();
    }
  },
);
