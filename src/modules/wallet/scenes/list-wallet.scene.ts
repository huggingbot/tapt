import { WRAPPED_NATIVE_TOKEN } from '@/libs/constants';
import { getErc20CommonProps, getErc20Contract } from '@/libs/contracts';
import { toReadableAmount } from '@/libs/conversion';
import { getProvider } from '@/libs/providers';
import { ESessionProp } from '@/modules/bot/constants/bot-prop.constant';
import { composeWizardScene } from '@/modules/bot/utils/scene-factory';

export const createListWalletScene = composeWizardScene(async (ctx, done) => {
  const { network } = ctx.session.prop[ESessionProp.Chain];
  const wallets = ctx.session.prop[ESessionProp.Wallets][network];
  if (!wallets.length) {
    ctx.reply('You have no wallets');
  } else {
    const addresses = wallets.map((wallet) => wallet.address);

    const USDC_CONTRACT = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const WBTC_CONTRACT = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';

    const provider = getProvider(network);
    const rawBalances = await Promise.all(
      addresses.map((address) => {
        const usdcContract = getErc20Contract(USDC_CONTRACT, provider);
        const wbtcContract = getErc20Contract(WBTC_CONTRACT, provider);
        return Promise.all([
          address,
          provider.getBalance(address),
          getErc20CommonProps(usdcContract, address),
          getErc20CommonProps(wbtcContract, address),
        ]);
      }),
    );

    const balances = rawBalances.map((rb) => {
      const [address, rawBalance, usdcProps, wbtcProps] = rb;
      let balance = rawBalance.toBigInt();
      balance = BigInt(toReadableAmount(balance.toString(), WRAPPED_NATIVE_TOKEN[network].decimals));

      const { balance: _usdcBalance, decimals: usdcDecimals } = usdcProps;
      let usdcBalance = BigInt(_usdcBalance);
      usdcBalance = BigInt(toReadableAmount(usdcBalance.toString(), usdcDecimals));

      const { balance: _wbtcBalance, decimals: wbtcDecimals } = wbtcProps;
      let wbtcBalance = BigInt(_wbtcBalance);
      wbtcBalance = BigInt(toReadableAmount(wbtcBalance.toString(), wbtcDecimals));

      const balanceStr = `
      Wallet address: ${address}
      Balance (ETH): ${balance} ETH
      Tokens:
      ----------
      USDC: ${usdcBalance} USDC
      WBTC: ${wbtcBalance} WBTC\n
      `;

      return balanceStr;
    });

    ctx.reply(`Your wallets are:\n${balances.join('\n')}`);
  }
  done();
});
