import { message } from 'telegraf/filters';

import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { EScene } from '@/modules/bot/constants/bot-scene.constant';

import { createFundFromSingleWalletScene } from '../scenes/fund-from-single-wallet.scene';

export const fundingStage = [
  createFundFromSingleWalletScene(EScene.FundFromSingleWallet, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);

    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else {
      ctx.scene.enter(EScene.FundingNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
];
