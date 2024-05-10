import { composeWizardScene } from '@/modules/bot/utils/scene-factory';

export const createBridgeNavScene = composeWizardScene(async (ctx, done) => {
  ctx.reply('Manage bridges');
  done();
});
