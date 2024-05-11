import { ethers, Wallet } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import log from 'loglevel';
import { message } from 'telegraf/filters';

import { ENetwork } from '@/libs/config';
import { WRAPPED_NATIVE_TOKEN } from '@/libs/constants';
import { fromReadableAmount } from '@/libs/conversion';
import { getProvider } from '@/libs/providers';
import { ESessionProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';
import { decryptPrivateKey } from '@/utils/crypto';
import { commitTransaction, getEthTransactionFee, getL1Signer } from '@/utils/zk-link-bridge';
import { ETH_ADDRESS, ZkLinkProviderUrl } from '@/utils/zk-link-bridge/constants';

export const createBridgeEthToZkLinkScene = composeWizardScene(
  async (ctx, done) => {
    const { network } = ctx.session.prop[ESessionProp.Chain];

    if (![ENetwork.Local, ENetwork.Mainnet, ENetwork.EthereumSepolia].includes(network)) {
      ctx.reply('This feature is only available on mainnet and sepolia network.');
      return done();
    }

    ctx.reply(
      `Enter the sending wallet address with the amount of ETH to bridge

    Note that:
    • Leaving the amount blank transfers the entire remaining balance.
    • The address and amount are separated by comma
    
    Example:
    
    Address with remaining amount:
    0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
    
    Address with specified amount:
    0x70997970C51812dc3A010C7d01b50e0d17dc79C8,0.001`,
      { reply_markup: { force_reply: true } },
    );
    ctx.wizard.next();
  },
  async (ctx, done) => {
    if (ctx.has(message('reply_to_message', 'text'))) {
      // TODO: Refactor this part and fund from single wallet part to a shared function
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
          const balance = rawBalance.toBigInt();

          const amountBn = amount ? BigInt(fromReadableAmount(Number(amount), WRAPPED_NATIVE_TOKEN[network].decimals).toString()) : 0n;
          const transferAmount = amount ? amountBn : balance;

          if (transferAmount > balance || transferAmount <= 0n) {
            ctx.reply('Insufficient balance');
            done();
          } else {
            ctx.reply('Initiating the bridging process...');

            const sendingWalletWithProvider = sendingWallet.connect(provider);
            const wrapperProvider = new ethers.providers.Web3Provider(async (method, params) => {
              const result = (await provider.send(method, params ?? [])) as unknown;
              if (method === 'eth_accounts') {
                return [wallet.address];
              }
              return result;
            });
            const zkLinkProviderUrl = ZkLinkProviderUrl[network];
            const l1Signer = getL1Signer(sendingWalletWithProvider, wrapperProvider.getSigner(), zkLinkProviderUrl, network);

            const l2Receiver = sendingWalletWithProvider.address;
            const l1Token = ETH_ADDRESS;
            const amountToBridge = parseUnits(transferAmount.toString(), 0);
            const fee = await getEthTransactionFee(l1Signer, wrapperProvider);
            // // fee.l1GasLimit = fee.l1GasLimit.mul(2); // for ERC20 gasLimit mul 2

            ctx.reply(`Bridging ${transferAmount} ETH to ${l2Receiver} in the zkLink network...`);

            const tx = await commitTransaction(
              l1Signer,
              {
                to: l2Receiver,
                tokenAddress: l1Token,
                amount: amountToBridge,
                toMerge: false,
              },
              fee,
            );

            ctx.reply(`Successfully bridged to the zkLink network. Transaction hash: ${tx?.hash}`);
          }
        } catch (err) {
          log.error(`Error in createBridgeEthToZkLinkScene: ${String(err)}`);
          ctx.reply('Something went wrong. Please try again later.');
          done();
        }
      }
    }
    done();
  },
);
