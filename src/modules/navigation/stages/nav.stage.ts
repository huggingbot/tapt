import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { EScene } from '@/modules/bot/constants/bot-scene.constant';

import { createChainNavScene } from '../scenes/chain.nav.scene';
import { createFundingNavScene } from '../scenes/funding.nav.scene';
import { createMainNavScene } from '../scenes/main-nav.scene';
import { createSwapNavScene } from '../scenes/swap.nav.scene';
import { createWalletNavScene } from '../scenes/wallet.nav.scene';

export const navStage = [
  createMainNavScene(EScene.MainNav, async (ctx) => {
    const state = ctx.wizard.state;

    switch (state[EWizardProp.Action]) {
      case ENavAction.Wallet:
        ctx.scene.enter(EScene.WalletNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      case ENavAction.Funding:
        ctx.scene.enter(EScene.FundingNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      case ENavAction.Swap:
        ctx.scene.enter(EScene.SwapNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      case ENavAction.Chain:
        ctx.scene.enter(EScene.ChainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      default: {
        ctx.scene.reenter();
      }
    }
  }),
  createWalletNavScene(EScene.WalletNav, async (ctx) => {
    const state = ctx.wizard.state;

    switch (state[EWizardProp.Action]) {
      case ENavAction.WalletCount:
        ctx.scene.enter(EScene.CountWallet, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      case ENavAction.WalletList:
        ctx.scene.enter(EScene.ListWallet, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      case ENavAction.WalletCreate:
        ctx.scene.enter(EScene.CreateWallet, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      case ENavAction.WalletImport:
        ctx.scene.enter(EScene.ImportWallet, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      case ENavAction.Back:
        ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      default: {
        ctx.scene.enter(EScene.MainNav);
      }
    }
  }),
  createFundingNavScene(EScene.FundingNav, async (ctx) => {
    const state = ctx.wizard.state;

    switch (state[EWizardProp.Action]) {
      case ENavAction.FundFromSingleWallet:
        ctx.scene.enter(EScene.FundFromSingleWallet, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      case ENavAction.Back:
        ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      default: {
        ctx.scene.enter(EScene.MainNav);
      }
    }
  }),
  createSwapNavScene(EScene.SwapNav, async (ctx) => {
    const state = ctx.wizard.state;

    switch (state[EWizardProp.Action]) {
      case ENavAction.GetSwapToken:
        ctx.scene.enter(EScene.GetSwapToken, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      case ENavAction.Back:
        ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      default: {
        ctx.scene.enter(EScene.MainNav);
      }
    }
  }),
  createChainNavScene(EScene.ChainNav, async (ctx) => {
    const state = ctx.wizard.state;

    switch (state[EWizardProp.Action]) {
      case ENavAction.GetCurrentChain:
        ctx.scene.enter(EScene.GetCurrentChain, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      case ENavAction.SwitchChain:
        ctx.scene.enter(EScene.SwitchChain, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      case ENavAction.Back:
        ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
        break;
      default: {
        ctx.scene.enter(EScene.MainNav);
      }
    }
  }),
];
