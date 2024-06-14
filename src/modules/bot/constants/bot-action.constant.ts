export enum ENavAction {
  // Main navigation
  Wallet = 'Wallet',
  Funding = 'Funding',
  Trade = 'Trade',
  Bridge = 'Bridge',
  Chain = 'Chain',

  // Common navigation
  Start = '/start',
  Back = 'Back',
  Cancel = 'Cancel',
  Delete = 'Delete',

  // Wallet navigation
  WalletCount = 'Count',
  WalletList = 'List',
  WalletCreate = 'Create',
  WalletImport = 'Import',

  // Funding navigation
  FundFromSingleWallet = 'Fund from wallet',

  // Trade navigation
  GetTradeToken = 'Get trade token',
  ActiveOrders = 'Active Orders',
  PreviewOrder = 'Preview Order',
  SubmitOrder = 'Submit Order',

  // Bridge navigation
  BridgeEthToZkLink = 'Bridge ETH to ZkLink',

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
}

export enum EOrderDetails {
  TriggerPrice = 'Trigger Price',
  Expiry = 'Expiry',
}

export enum EDcaOrderKeyboardData {
  Interval = 'Interval',
  Duration = 'Duration',
  MinPrice = 'Min Price',
  MaxPrice = 'Max Price',
}

export enum EOrderType {
  SwapOrderType = 'Swap',
  LimitOrderType = 'Limit',
  DCAOrderType = 'DCA',
}

// default value for trading options (e.g. Expiry, MinPrice, MaxPrice, Duration)
export const DEFAULT_TRADE_OPTIONS = {
  DcaDuration: '4d',
  DcaInterval: '1d',
  DcaMinPrice: '-1%',
  DcaMaxPrice: '+1%',
  LimitExpiry: '1d',
  LimitBuyTriggerPrice: '-1%',
  LimitSellTriggerPrice: '+1%',
};
