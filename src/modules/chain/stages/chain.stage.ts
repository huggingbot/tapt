import { message } from 'telegraf/filters';

import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { EScene } from '@/modules/bot/constants/bot-scene.constant';

import { createGetCurrentChainScene } from '../scenes/get-current-chain.scene';
import { createSwitchChainScene } from '../scenes/switch-chain.scene';

export const chainStage = [
  createGetCurrentChainScene(EScene.GetCurrentChain, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);

    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else {
      ctx.scene.enter(EScene.ChainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
  createSwitchChainScene(EScene.SwitchChain, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);

    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else {
      ctx.scene.enter(EScene.ChainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
];
