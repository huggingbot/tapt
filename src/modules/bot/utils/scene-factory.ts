import { Scenes } from 'telegraf';

import { IContext } from '../interfaces/bot-context.interface';

const unwrapCallback = async (ctx: IContext, nextScene: (ctx: IContext) => Promise<string | void>): Promise<void> => {
  const nextSceneId = await Promise.resolve(nextScene(ctx));
  if (nextSceneId) {
    return void ctx.scene.enter(nextSceneId, ctx.scene.state);
  }
  return ctx.scene.leave();
};

/**
 * Takes steps as arguments and returns a sceneFactory
 *
 * Additionally does the following things:
 * 1. Makes sure next step only triggers on `message` or `callbackQuery`
 * 2. Passes second argument - doneCallback to each step to be called when scene is finished
 */
export const composeWizardScene = (...advancedSteps: ((ctx: IContext, next: () => Promise<void>) => Promise<void>)[]) =>
  /**
   * Branching extension enabled sceneFactory
   * @param sceneType {string}
   * @param nextScene {function} - async func that returns nextSceneType
   */
  function createWizardScene(sceneType: string, nextScene: (ctx: IContext) => Promise<string | void>): Scenes.WizardScene<IContext> {
    return new Scenes.WizardScene<IContext>(
      sceneType,
      ...advancedSteps.map((stepFn) => async (ctx: IContext) => {
        /** ignore user action if it is neither message, nor callbackQuery */
        if (!ctx.message && !ctx.callbackQuery) return;
        return stepFn(ctx, () => unwrapCallback(ctx, nextScene));
      }),
    );
  };
