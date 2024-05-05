import { BigNumber, ethers } from 'ethers';

import ERC20_ABI from '../src/contracts/ERC_20_abi.json';
import { ENetwork } from '../src/libs/config';
import { getProvider, sendTransactionViaWallet, TransactionState } from '../src/libs/providers';
import { ETransactionType } from '../src/types/db';
import { decryptPrivateKey } from '../src/utils/crypto';
import { EOrderStatus, TAPT_API_ENDPOINT, V3_SWAP_ROUTER02_ADDRESS } from './utils/constants';
import { fromReadableAmount } from './utils/helpers';
import { ApiResponse, ILimitOrder } from './utils/types';

async function run() {
  const url = `${TAPT_API_ENDPOINT}/orders/limit?orderStatus=${EOrderStatus.Submitted}`;
  const resp = await fetch(url);
  const jsonResp = (await resp.json()) as ApiResponse<ILimitOrder[]>;
  if (!jsonResp.success || !jsonResp.data) {
    throw new Error(`failed to make request. ${jsonResp.message}`);
  }

  const orders = jsonResp.data;

  for (let i = 0; i < orders.length; i++) {
    const { id: orderId, sellAmount, sellToken, wallet: walletDetails } = orders[i];

    const provider = getProvider(ENetwork.Local);
    // create wallet instance
    const privateKey = decryptPrivateKey(walletDetails.encryted_private_key);
    const wallet = new ethers.Wallet(privateKey, provider);

    const tokenOutContract = new ethers.Contract(sellToken.contractAddress, ERC20_ABI, provider);
    // check allowance allocated by wallet
    const allowance: BigNumber = await tokenOutContract.allowance(wallet.address, V3_SWAP_ROUTER02_ADDRESS);
    const amountOut = ethers.utils.parseUnits(sellAmount, sellToken.decimalPlaces);

    const body: { orderStatus: string; transaction?: { hash: string; type: string; toAddress: string } } = {
      orderStatus: EOrderStatus.ApprovalPending,
    };
    if (allowance.lt(amountOut)) {
      // request approval
      const tokenApproval = await tokenOutContract.populateTransaction.approve(
        V3_SWAP_ROUTER02_ADDRESS,
        fromReadableAmount(Number(sellAmount), sellToken.decimalPlaces).toString(),
      );

      const approvalTxnResp = await sendTransactionViaWallet(wallet, ENetwork.Local, tokenApproval);
      if (approvalTxnResp === TransactionState.Failed) {
        console.error('failed to get approval');
        // update orders table as failed
        body.orderStatus = EOrderStatus.Failed;
      } else {
        const txn = approvalTxnResp as ethers.providers.TransactionResponse;
        if (txn.to) {
          body.transaction = {
            hash: txn.hash,
            type: ETransactionType.Approval,
            toAddress: txn.to,
          };
        }
      }
    }

    // no need to retry or check the resp, next iteration will be take care of it if it's failed
    await fetch(`${TAPT_API_ENDPOINT}/orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }
}

(async function () {
  await run();
})();
