/* eslint-disable max-len */
import { BigNumber, ethers } from 'ethers';

import { ERC20_ABI, TAPT_API_ENDPOINT, V3_UNISWAP_ROUTER_ADDRESS } from '../utils/constants';
import { fromReadableAmount } from '../utils/helpers';
import { getProvider } from '../utils/providers';
import {
  ApiResponse,
  ILimitOrder,
  IToken,
  ENetwork,
  IUpdateOrderRequestBody,
  TransactionState,
  ETransactionType,
  EOrderStatus,
} from '../utils/types';
import { sendTransactionViaWallet } from '../utils/transactions';
import { decrypt } from '../utils/crypto';
import { handleErrorResponse } from '../utils/responseHandler';
import { onRequest } from 'firebase-functions/v2/https';

/**
 * Ideally, this function will be first function in the trading work flow.
 * This function is responsible for checking token allowance
 * from wallet and getting approval to spend tokens
 * In trading crons workflow, we can list this trade as cron number 1
 * For e.g:
 *    limit order: (from up to bottom)
 *    **[submit_approval]
 *    [track_txn]
 *    [check_orders_criteria]
 *    [execute_trade]
 *    [track_txn]
 *    (DONE)
 */
async function submitApprovalTransactions() {
  const url = `${TAPT_API_ENDPOINT}/orders/limit?orderStatus=${EOrderStatus.Submitted}`;
  const resp = await fetch(url);
  const jsonResp = (await resp.json()) as ApiResponse<ILimitOrder[]>;
  if (!jsonResp.success || !jsonResp.data) {
    throw new Error(`failed to make request. ${jsonResp.message}`);
  }

  const orders = jsonResp.data;
  // additional params which will be shared between promises iterations
  const additionalParams: {
    orderId: number;
    sellAmount: string;
    sellToken: IToken;
    wallet: ethers.Wallet;
  }[] = [];
  // getting allowance from the wallet
  const allowancePromises: Promise<BigNumber>[] = orders.map((order) => {
    const { orderId, sellAmount, sellToken, encryptedPrivateKey } = order;
    const provider = getProvider(ENetwork.Local);
    // create wallet instance
    const privateKey = decrypt(encryptedPrivateKey);
    const wallet = new ethers.Wallet(privateKey, provider);

    // save to additionalParams to use the values for later in approval submition
    additionalParams.push({ orderId, wallet, sellAmount, sellToken });

    const tokenOutContract = new ethers.Contract(sellToken.contractAddress, ERC20_ABI, provider);
    const allowance: Promise<BigNumber> = tokenOutContract.allowance(wallet.address, V3_UNISWAP_ROUTER_ADDRESS[ENetwork.Local]);
    return allowance;
  });
  const allowanceResult = await Promise.allSettled(allowancePromises);

  // validate allowance and prepare `Approval Txn`
  const approvalTxnPromises = allowanceResult.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }
    const provider = getProvider(ENetwork.Local);
    const { sellAmount, sellToken } = additionalParams[idx];
    const amountOut = ethers.utils.parseUnits(sellAmount, sellToken.decimalPlaces);
    const allowance = result.value;
    if (allowance.lt(amountOut)) {
      const tokenOutContract = new ethers.Contract(sellToken.contractAddress, ERC20_ABI, provider);
      return tokenOutContract.populateTransaction.approve(
        V3_UNISWAP_ROUTER_ADDRESS[ENetwork.Local],
        fromReadableAmount(Number(sellAmount), sellToken.decimalPlaces).toString(),
      );
    }
    // already approved
    return EOrderStatus.ApprovalCompleted;
  });
  const approvalTxnResults = await Promise.allSettled(approvalTxnPromises);

  // Send `Approval` Txn
  const approvalRxnRespPromises = approvalTxnResults.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }
    if (result.value === EOrderStatus.ApprovalCompleted) {
      return result.value;
    }
    const tokenApproval = result.value;
    const { wallet } = additionalParams[idx];
    return sendTransactionViaWallet(wallet, ENetwork.Local, tokenApproval);
  });
  const approvalTxnResponsesResult = await Promise.allSettled(approvalRxnRespPromises);

  // Check `Approval` TXN responses and update the database
  const updateOrdersPromises = approvalTxnResponsesResult.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }
    const approvalTxnResp = result.value;
    const reqBody: IUpdateOrderRequestBody = {
      orderStatus: EOrderStatus.ApprovalCompleted,
    };
    if (approvalTxnResp === TransactionState.Failed) {
      reqBody.orderStatus = EOrderStatus.Failed;
    } else if (approvalTxnResp !== EOrderStatus.ApprovalCompleted) {
      const txn = approvalTxnResp as ethers.providers.TransactionResponse;
      reqBody.orderStatus = EOrderStatus.ApprovalPending;
      if (txn.to) {
        reqBody.transaction = {
          hash: txn.hash,
          type: ETransactionType.Approval,
          toAddress: txn.to,
        };
      }
    }
    const { orderId } = additionalParams[idx];
    // TODO: Replace this with bulk_update instead of updating 1 by 1
    return fetch(`${TAPT_API_ENDPOINT}/orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reqBody),
    });
  });
  return await Promise.allSettled(updateOrdersPromises);
}

// submit approval transaction
export const approvalSubmission = onRequest(async (req, res) => {
  try {
    const approvalTxns = await submitApprovalTransactions();
    res.json({ result: approvalTxns });
  } catch (e: unknown) {
    handleErrorResponse(res, e);
  }
});
