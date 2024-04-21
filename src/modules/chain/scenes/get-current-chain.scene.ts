import { AppConfig } from '@/libs/config';
import { ESessionProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';

export const createGetCurrentChainScene = composeWizardScene(async (ctx, done) => {
  const { network } = ctx.session.prop[ESessionProp.Chain];
  ctx.reply(`name: ${network}\nchainId: ${AppConfig[network].chainId}`);
  done();
});
