export enum ESessionProp {
  Wallets = 'wallets',
  Chain = 'chain',
}

export enum EWizardProp {
  Action = 'action',
  Msg = 'msg',
  Reentering = 'reentering',
  Contract = 'contract',
  TokenPrice = 'tokenPrice',
  ActiveAddress = 'activeAddress',
  DoNothing = 'doNothing',
  OrderType = 'orderType',
  TriggerPrice = 'triggerPrice',
  TargetPrice = 'targetPrice',
  Expiry = 'orderExpiry',
  OrderDetailsAction = 'orderDetailsAction',
  ReEnterTheScene = 'reEnterTheScene',
  TradeAmount = 'tradeAmount',
  DcaDuration = 'dcaDuration',
  DcaInterval = 'dcaInterval',
  DcaMinPrice = 'dcaMinPrice',
  DcaMaxPrice = 'dcaMaxPrice',

  // Order Management
  OrderManagementMode = 'orderManagementMode',
  ActiveDcaOrders = 'activeDcaOrders',
  ActiveLimitOrders = 'activeLimitOrders',
  OrderManagementAction = 'orderManagementAction',
  OrderManagementActionCancel = 'orderManagementActionCancel',
}

export enum EOrderExpiryUnit {
  Minute = 'm',
  Hour = 'h',
  Day = 'd',
  Week = 'w',
  Month = 'M',
}
