/* eslint-disable max-len */
import { BigNumber, ethers } from 'ethers';
import { logger } from 'firebase-functions';
import ERC20_ABI from '../contracts/ERC_20_abi.json';
import { TAPT_API_ENDPOINT, V3_UNISWAP_ROUTER_ADDRESS } from '../utils/constants';
import { countdown, fromReadableAmount, toReadableAmount } from '../utils/helpers';
import { fromChainIdToNetwork, getProvider } from '../utils/providers';
import { ILimitOrder, IToken, ENetwork, IUpdateOrderRequestBody, TransactionState, ETransactionType, EOrderStatus } from '../utils/types';
import { sendTransactionViaWallet } from '../utils/transactions';
import { decrypt } from '../utils/crypto';
import { handleError } from '../utils/responseHandler';
import { createScheduleFunction } from '../utils/firebase-functions';
import { makeNetworkRequest } from '../utils/networking';

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
export async function submitApprovalTransactions() {
  const url = `${TAPT_API_ENDPOINT}/orders/limit?orderStatus=${EOrderStatus.Submitted}`;
  const orders = await makeNetworkRequest<ILimitOrder[]>(url);

  // additional params which will be shared between promises iterations
  const additionalParams: {
    orderId: number;
    sellAmount: string;
    sellToken: IToken;
    wallet: ethers.Wallet;
    network: ENetwork;
  }[] = [];
  logger.info('orders', orders);

  // checking wallets balances
  const walletBalances: Promise<BigNumber>[] = orders.map((order) => {
    const { orderId, sellAmount, sellToken, encryptedPrivateKey, chainId } = order;

    const network = fromChainIdToNetwork(chainId);
    const provider = getProvider(network);
    // create wallet instance
    const privateKey = decrypt(encryptedPrivateKey);
    const wallet = new ethers.Wallet(privateKey, provider);
    // save to additionalParams to use the values for later in approval submition
    additionalParams.push({ orderId, wallet, sellAmount, sellToken, network });
    return provider.getBalance(wallet.address);
  });
  const walletBalanceResult = await Promise.allSettled(walletBalances);

  // getting allowance from the wallet
  const allowancePromises: (Promise<BigNumber> | undefined)[] = walletBalanceResult.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }

    const { orderId, wallet, sellAmount, sellToken, network } = additionalParams[idx];

    let balance = result.value.toBigInt();
    balance = BigInt(toReadableAmount(balance.toString(), sellToken.decimalPlaces));
    const amountOut = ethers.utils.parseUnits(sellAmount, sellToken.decimalPlaces);
    const readableAmountOut = BigInt(toReadableAmount(amountOut.toString(), sellToken.decimalPlaces));
    if (balance <= readableAmountOut) {
      logger.warn(`not enough balance! ${JSON.stringify({ address: wallet.address, orderId, network })}`);
      return undefined;
    }

    // save to additionalParams to use the values for later in approval submition
    additionalParams.push({ orderId, wallet, sellAmount, sellToken, network });
    const provider = getProvider(network);

    const tokenInContract = new ethers.Contract(sellToken.contractAddress, ERC20_ABI, provider);
    const allowance: Promise<BigNumber> = tokenInContract.allowance(wallet.address, V3_UNISWAP_ROUTER_ADDRESS[network]);
    return allowance;
  });
  const allowanceResult = await Promise.allSettled(allowancePromises);

  // validate allowance and prepare `Approval Txn`
  const approvalTxnPromises = allowanceResult.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }
    const { sellAmount, sellToken, network } = additionalParams[idx];
    const provider = getProvider(network);
    const amountOut = ethers.utils.parseUnits(sellAmount, sellToken.decimalPlaces);
    const allowance = result.value;
    if (allowance.lt(amountOut)) {
      const tokenInContract = new ethers.Contract(sellToken.contractAddress, ERC20_ABI, provider);
      return tokenInContract.populateTransaction.approve(
        V3_UNISWAP_ROUTER_ADDRESS[network],
        fromReadableAmount(Number(sellAmount), sellToken.decimalPlaces).toString(),
      );
    }
    // already approved
    return EOrderStatus.ApprovalCompleted;
  });
  const approvalTxnResults = await Promise.allSettled(approvalTxnPromises);

  // Send `Approval` Txn
  const approvalTxnRespPromises = approvalTxnResults.map((result, idx) => {
    if (result.status === 'rejected' || !result.value) {
      return undefined;
    }
    if (result.value === EOrderStatus.ApprovalCompleted) {
      return result.value;
    }
    const tokenApproval = result.value;
    const { wallet, network } = additionalParams[idx];
    return sendTransactionViaWallet(wallet, network, tokenApproval);
  });
  const approvalTxnResponsesResult = await Promise.allSettled(approvalTxnRespPromises);
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
    return makeNetworkRequest(`${TAPT_API_ENDPOINT}/orders/${orderId}`, 'PATCH', reqBody as unknown as Record<string, unknown>);
  });
  const approvalSubmissionResult = await Promise.allSettled(updateOrdersPromises);
  return approvalSubmissionResult;
}

// submit approval transaction
export const approvalSubmission = createScheduleFunction(async () => {
  try {
    await countdown(5, async () => {
      const approvalTxns = await submitApprovalTransactions();
      logger.info(`approvalTxns: ${approvalTxns}`);
    });
  } catch (e: unknown) {
    handleError(e);
  }
});
