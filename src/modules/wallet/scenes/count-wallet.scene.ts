import { ESessionProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';

export const createCountWalletScene = composeWizardScene(async (ctx, done) => {
  const { network } = ctx.session.prop[ESessionProp.Chain];
  const walletCount = ctx.session.prop[ESessionProp.Wallets][network].length;
  ctx.reply(`Your number of wallets is:\n${walletCount}`);
  done();
});
