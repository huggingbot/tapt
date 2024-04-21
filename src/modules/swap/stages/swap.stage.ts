import { message } from 'telegraf/filters';

import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { EScene } from '@/modules/bot/constants/bot-scene.constant';
import { IWizContractProp } from '@/modules/bot/interfaces/bot-prop.interface';

import { createBuyAndSellScene } from '../scenes/buy-and-sell.scene';
import { createExecuteSwapScene } from '../scenes/execute-swap.scene';
import { createGetSwapTokenScene } from '../scenes/get-swap-token';

export const swapStage = [
  createGetSwapTokenScene(EScene.GetSwapToken, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);
    const contract = state[EWizardProp.Contract];

    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else if (contract) {
      ctx.scene.enter(EScene.BuyAndSell, { [EWizardProp.Msg]: state[EWizardProp.Msg], [EWizardProp.Contract]: state[EWizardProp.Contract] });
    } else {
      ctx.scene.enter(EScene.SwapNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
  createBuyAndSellScene(EScene.BuyAndSell, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);

    const contract = state[EWizardProp.Contract] as IWizContractProp;
    const action = state[EWizardProp.Action];
    const activeAddress = state[EWizardProp.ActiveAddress];

    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else if (contract && action && activeAddress) {
      ctx.scene.enter(EScene.ExecuteSwap, {
        [EWizardProp.Msg]: state[EWizardProp.Msg],
        [EWizardProp.Contract]: contract,
        [EWizardProp.Action]: action,
        [EWizardProp.ActiveAddress]: activeAddress,
      });
    } else {
      ctx.scene.enter(EScene.SwapNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
  createExecuteSwapScene(EScene.ExecuteSwap, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);

    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else {
      ctx.scene.enter(EScene.SwapNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
];
