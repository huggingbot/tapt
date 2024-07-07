export enum EScene {
  MainNav = 'MainNav',
  WalletNav = 'WalletNav',
  FundingNav = 'FundingNav',
  TradeNav = 'TradeNav',
  BridgeNav = 'BridgeNav',
  ChainNav = 'ChainNav',

  CountWallet = 'CountWallet',
  ListWallet = 'ListWallet',
  CreateWallet = 'CreateWallet',
  ImportWallet = 'ImportWallet',
  PeekBalance = 'PeekBalance',

  FundFromSingleWallet = 'FundFromSingleWallet',

  GetTradeToken = 'GetTradeToken',
  ActiveOrders = 'ActiveOrders',
  BuyAndSell = 'BuyAndSell',
  ExecuteSwap = 'ExecuteSwap',

  BridgeEthToZkLink = 'BridgeEthToZkLink',

  GetCurrentChain = 'GetCurrentChain',
  SwitchChain = 'SwitchChain',

  // Limit scene
  SubmitLimitOrder = 'SubmitLimitOrder',
  PreviewOrder = 'PreviewOrder',

  // Order Management
  ManageOrders = 'ManageOrders',
}
