export enum ENavAction {
  // Main navigation
  Wallet = 'Wallet',
  Funding = 'Funding',
  Swap = 'Swap',
  Chain = 'Chain',

  // Common navigation
  Start = '/start',
  Back = 'Back',
  Cancel = 'Cancel',

  // Wallet navigation
  WalletCount = 'Count',
  WalletList = 'List',
  WalletCreate = 'Create',
  WalletImport = 'Import',

  // Funding navigation
  FundFromSingleWallet = 'Fund from wallet',

  // Swap navigation
  GetSwapToken = 'Get swap token',

  // Chain navigation
  GetCurrentChain = 'Get current chain',
  SwitchChain = 'Switch chain',
}

export enum EWalletAction {
  CreateWallet_01 = 'CreateWallet_01',
  CreateWallet_03 = 'CreateWallet_03',
  CreateWallet_05 = 'CreateWallet_05',
  CreateWallet_10 = 'CreateWallet_10',
}

export enum ESwapAction {
  BuyMode = 'Buy Mode',
  SellMode = 'Sell Mode',
  Wallets = '------Wallets------',
  Actions = '------Actions------',
  Buy_0_01 = 'Buy_0_01',
  Buy_0_2 = 'Buy_0_2',
  Buy_0_5 = 'Buy_0_5',
  Buy_1 = 'Buy_1',
  Buy_3 = 'Buy_3',
  Buy_X = 'Buy_X',
  Sell_10 = 'Sell_10pct',
  Sell_20 = 'Sell_20pct',
  Sell_30 = 'Sell_30pct',
  Sell_40 = 'Sell_40pct',
  Sell_50 = 'Sell_50pct',
  Sell_60 = 'Sell_60pct',
  Sell_70 = 'Sell_70pct',
  Sell_80 = 'Sell_80pct',
  Sell_90 = 'Sell_90pct',
  Sell_100 = 'Sell_100pct',
  Sell_X = 'Sell_X',
  ConfirmSwap = 'ConfirmSwap',
  SubmitLimitOrder = 'SubmitLimitOrder',
}

export enum EOrderType {
  SwapOrderType = 'Swap',
  LimitOrderType = 'Limit',
  DCAOrderType = 'DCA',
}

export enum ELimitOptions {
  PreviewOrder = 'Preview Limit Order',
  SubmitOrder = 'Submit Limit Order',
}
