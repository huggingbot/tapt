import { message } from 'telegraf/filters';

import { ENavAction } from '@/modules/bot/constants/bot-action.constant';
import { EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { EScene } from '@/modules/bot/constants/bot-scene.constant';

import { createCountWalletScene } from '../scenes/count-wallet.scene';
import { createCreateWalletScene } from '../scenes/create-wallet.scene';
import { createImportWalletScene } from '../scenes/import-wallet.scene';
import { createListWalletScene } from '../scenes/list-wallet.scene';

export const walletStage = [
  createCountWalletScene(EScene.CountWallet, async (ctx) => {
    const state = ctx.wizard.state;

    ctx.scene.enter(EScene.WalletNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
  }),
  createListWalletScene(EScene.ListWallet, async (ctx) => {
    const state = ctx.wizard.state;

    ctx.scene.enter(EScene.WalletNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
  }),
  createCreateWalletScene(EScene.CreateWallet, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);

    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else {
      ctx.scene.enter(EScene.WalletNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
  createImportWalletScene(EScene.ImportWallet, async (ctx) => {
    const state = ctx.wizard.state;
    const isStart = ctx.has(message('text')) && ctx.message?.text === String(ENavAction.Start);

    if (isStart) {
      ctx.scene.enter(EScene.MainNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    } else {
      ctx.scene.enter(EScene.WalletNav, { [EWizardProp.Msg]: state[EWizardProp.Msg] });
    }
  }),
];
