import type { InlineKeyboardButton } from 'telegraf/types';

import { TWizardState } from '@/types/telegram';
import { isBuyMode, isDCAOrder, isLimitOrder, truncateAddress } from '@/utils/common';

import { DEFAULT_TRADE_OPTIONS, EDcaOrderKeyboardData, EOrderDetails, EOrderType } from '../constants/bot-action.constant';
import { EWizardProp } from '../constants/bot-prop.constant';
import { TWallet } from '../interfaces/bot-context.interface';

export function getWalletKeyboardData(wallets: TWallet[], activeAddress: unknown) {
  const kbData = wallets.reduce(
    (acc, wallet, index) => {
      const isActiveWallet = activeAddress === wallet.address;
      const truncatedAddress = truncateAddress(wallet.address);
      const button = { text: isActiveWallet ? `${truncatedAddress} ❎` : truncatedAddress, callback_data: wallet.address };

      if (index % 3 === 0) {
        acc.push([button]);
      } else {
        acc[acc.length - 1].push(button);
      }
      return acc;
    },
    [] as { text: string; callback_data: string }[][],
  );
  return kbData;
}

/**
 * !!! WARNING: this function mutates the existing array !!!
 * Add trade related keyboard data based on the order type.
 * @param {TWizardState} state - current state of the telegram context
 * @param {InlineKeyboardButton[][]} existingKeyboardData - existing keyboard data
 */
export function addTradeRelatedKeyboardData(state: TWizardState, existingKeyboardData: InlineKeyboardButton[][]) {
  const orderType = state[EWizardProp.OrderType] || EOrderType.SwapOrderType;

  let tradeRelatedKeyboardAction: InlineKeyboardButton[][] = [];
  if (isLimitOrder(orderType)) {
    tradeRelatedKeyboardAction = addLimitOrderKeyboardData(state);
  } else if (isDCAOrder(orderType)) {
    tradeRelatedKeyboardAction = addDcaOrderKeyboardData(state);
  }
  // insert limit order keyboard action (target price and expiry) into keyboard actions array at index 5
  const insertLocation = 5;
  // number of elements to be removed in order to insert limit order keyboard action
  const numOfElementsNeedToBeDeleted = 0;
  existingKeyboardData.splice(insertLocation, numOfElementsNeedToBeDeleted, ...tradeRelatedKeyboardAction);
}

// add Limit Order related Keyboard data
function addLimitOrderKeyboardData(state: TWizardState) {
  const action = state[EWizardProp.Action];
  const triggerPrice = (state[EWizardProp.TriggerPrice] as string) || (isBuyMode(action) ? '-1%' : '+1%');
  const orderExpiry = (state[EWizardProp.Expiry] as string) || '1d';
  const limitOrderKeyboardAction = [
    [
      { text: `(${triggerPrice}) ${EOrderDetails.TriggerPrice}`, callback_data: EOrderDetails.TriggerPrice },
      { text: `(${orderExpiry}) ${EOrderDetails.Expiry}`, callback_data: EOrderDetails.Expiry },
    ],
  ];
  return limitOrderKeyboardAction;
}

// Add DCA Order related Keyboard data
function addDcaOrderKeyboardData(state: TWizardState) {
  const interval = (state[EWizardProp.DcaInterval] as string) || DEFAULT_TRADE_OPTIONS.DcaInterval;
  const duration = (state[EWizardProp.DcaDuration] as string) || DEFAULT_TRADE_OPTIONS.DcaDuration;
  const minPrice = (state[EWizardProp.DcaMinPrice] as string) || DEFAULT_TRADE_OPTIONS.DcaMinPrice;
  const maxPrice = (state[EWizardProp.DcaMaxPrice] as string) || DEFAULT_TRADE_OPTIONS.DcaMaxPrice;

  const dcaKeyboardAction = [
    [
      { text: `(${interval}) ${EDcaOrderKeyboardData.Interval}`, callback_data: EDcaOrderKeyboardData.Interval },
      { text: `(${duration}) ${EDcaOrderKeyboardData.Duration}`, callback_data: EDcaOrderKeyboardData.Duration },
    ],
    [
      { text: `(${minPrice}) ${EDcaOrderKeyboardData.MinPrice}`, callback_data: EDcaOrderKeyboardData.MinPrice },
      { text: `(${maxPrice}) ${EDcaOrderKeyboardData.MaxPrice}`, callback_data: EDcaOrderKeyboardData.MaxPrice },
    ],
  ];
  return dcaKeyboardAction;
}
