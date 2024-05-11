import { message } from 'telegraf/filters';

import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { EScene } from '@/modules/bot/constants/bot-scene.constant';

import { createBridgeEthToZkLinkScene } from '../scenes/bridge-eth-to-zk-link.scene';

export const bridgeStage = [
  createBridgeEthToZkLinkScene(EScene.BridgeEthToZkLink, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);

    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else {
      ctx.scene.enter(EScene.BridgeNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
];
