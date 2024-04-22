import { TransactionRequest } from '@ethersproject/abstract-provider';
import { Wallet } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import log from 'loglevel';
import { message } from 'telegraf/filters';

import { MAX_FEE_PER_GAS, MAX_PRIORITY_FEE_PER_GAS, WRAPPED_NATIVE_TOKEN } from '@/libs/constants';
import { toReadableAmount } from '@/libs/conversion';
import { getProvider } from '@/libs/providers';
import { ESessionProp, EWizardProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { decryptPrivateKey } from '@/utils/crypto';

export const createFundFromSingleWalletScene = composeWizardScene(
  async (ctx) => {
    if (ctx.wizard.state[EWizardProp.Reentering]) {
      ctx.wizard.state[EWizardProp.Reentering] = false;
      ctx.wizard.next();
    } else {
      ctx.reply(
        `Enter the sending wallet address with amount

Note that:
• Leaving the amount blank transfers the entire remaining balance.
• The address and amount are separated by comma
      
Example:
      
Address with remaining amount:
EwR1iMRLoXEQR8qTn1AF8ydwujqdMZVs53giNbDCxicH
      
Address with specified amount:
EwR1iMRLoXEQR8qTn1AF8ydwujqdMZVs53giNbDCxicH,0.001`,
        { reply_markup: { force_reply: true } },
      );
      ctx.wizard.next();
    }
  },
  async (ctx, done) => {
    if (ctx.has(message('reply_to_message', 'text'))) {
      const addressAmount = ctx.message.text.toLowerCase();
      const [address, amount] = addressAmount.split(/,\s?/);

      const { network } = ctx.session.prop[ESessionProp.Chain];
      const wallets = ctx.session.prop[ESessionProp.Wallets][network];
      const wallet = wallets.find((wallet) => wallet.address === address);

      if (!wallet) {
        ctx.reply('Address not found in the list of wallets');
        done();
      } else if (amount && Number.isNaN(Number(amount))) {
        ctx.reply('Invalid amount');
        done();
      } else {
        try {
          const privateKey = decryptPrivateKey(wallet.encryptedPrivateKey);
          const sendingWallet = new Wallet(privateKey);
          const provider = getProvider(network);
          const rawBalance = await provider.getBalance(sendingWallet.address);

          let balance: bigint;
          balance = rawBalance.toBigInt();
          balance = BigInt(toReadableAmount(balance.toString(), WRAPPED_NATIVE_TOKEN[network].decimals));

          // Transfer the entire remaining balance if the amount is not specified
          // TODO: Account for gas fees
          const transferAmount = amount ? BigInt(amount) : balance;

          if (transferAmount > balance || transferAmount <= 0n) {
            ctx.reply('Insufficient balance');
            done();
          } else {
            const receivingWallets = wallets.filter((wallet) => wallet.address !== sendingWallet.address);
            const amountPerWallet = parseEther(transferAmount.toString()).toBigInt() / BigInt(receivingWallets.length || 1);

            const sendingWalletWithProvider = sendingWallet.connect(provider);
            const currentNonce = await provider.getTransactionCount(address, 'latest');

            const txReceiptPromises = receivingWallets.map(async (wallet, index) => {
              const tx: TransactionRequest = {
                to: wallet.address,
                value: amountPerWallet,
                maxFeePerGas: MAX_FEE_PER_GAS,
                maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
                nonce: currentNonce + index,
              };
              return sendingWalletWithProvider.sendTransaction(tx).then((txRes) => txRes.wait());
            });
            const hashes = (await Promise.all(txReceiptPromises)).map((tx) => tx.transactionHash);

            ctx.reply(`✅ **Funding successful!**\n\nTransaction hashes:\n\`${hashes.join('\n')}\``, {
              parse_mode: 'Markdown',
            });
            done();
          }
        } catch (err) {
          log.error(`Error occurred in createFundFromSingleWalletScene: ${String(err)}`);
          ctx.reply('Something went wrong. Please try again');
          done();
        }
      }
    } else {
      done();
    }
  },
);
