import { ESessionProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';

export const createListWalletScene = composeWizardScene(async (ctx, done) => {
  const { network } = ctx.session.prop[ESessionProp.Chain];
  const wallets = ctx.session.prop[ESessionProp.Wallets][network];
  if (!wallets.length) {
    ctx.reply('You have no wallets');
  } else {
    const addresses = wallets.map((wallet) => wallet.address);
    ctx.reply(`Your wallets are:\n${addresses.join('\n')}`);
  }
  done();
});
