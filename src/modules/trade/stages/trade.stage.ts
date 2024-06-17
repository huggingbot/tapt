import { message } from 'telegraf/filters';

import { ENavAction, EOrderType } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { EScene } from '@/modules/bot/constants/bot-scene.constant';
import { IWizContractProp } from '@/modules/bot/interfaces/bot-prop.interface';

import { createActiveOrdersScene } from '../scenes/active-orders.scene';
import { createBuyAndSellScene } from '../scenes/buy-and-sell.scene';
import { createExecuteSwapScene } from '../scenes/execute-swap.scene';
import { createGetSwapTokenScene } from '../scenes/get-swap-token';
import { createOrderPreviewScene } from '../scenes/order-preview.scene';

export const tradeStage = [
  createGetSwapTokenScene(EScene.GetTradeToken, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);
    const contract = state[EWizardProp.Contract];

    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else if (contract) {
      ctx.scene.enter(EScene.BuyAndSell, state);
    } else {
      ctx.scene.enter(EScene.TradeNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
  createBuyAndSellScene(EScene.BuyAndSell, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);
    const contract = state[EWizardProp.Contract] as IWizContractProp;
    const action = state[EWizardProp.Action];
    const activeAddress = state[EWizardProp.ActiveAddress];
    const orderType = state[EWizardProp.OrderType];
    const reenterTheScene = state[EWizardProp.ReEnterTheScene];

    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else if (reenterTheScene) {
      ctx.scene.enter(EScene.BuyAndSell, state);
    } else if (contract && action && activeAddress) {
      switch (orderType) {
        case EOrderType.LimitOrderType:
        case EOrderType.DCAOrderType:
          ctx.scene.enter(EScene.PreviewOrder, state);
          break;
        case EOrderType.SwapOrderType:
          ctx.scene.enter(EScene.ExecuteSwap, state);
          break;
        default:
          ctx.scene.enter(EScene.TradeNav, state);
      }
    } else {
      ctx.scene.enter(EScene.TradeNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
  createExecuteSwapScene(EScene.ExecuteSwap, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);

    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else {
      ctx.scene.enter(EScene.TradeNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
  createOrderPreviewScene(EScene.PreviewOrder, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);
    const contract = state[EWizardProp.Contract] as IWizContractProp;
    const action = state[EWizardProp.Action];
    const activeAddress = state[EWizardProp.ActiveAddress];
    const orderType = state[EWizardProp.OrderType];
    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else if (contract && action && activeAddress && orderType) {
      ctx.scene.enter(EScene.BuyAndSell, state);
    } else {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
  createActiveOrdersScene(EScene.ActiveOrders, async (ctx) => {
    const state = ctx.wizard.state;
    const action = state[EWizardProp.Action];
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);
    if (isStart || action === String(ENavAction.Back)) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else if (action === String(ENavAction.ActiveOrders)) {
      ctx.scene.reenter();
    } else {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
];
