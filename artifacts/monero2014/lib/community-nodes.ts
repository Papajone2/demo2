// Operators/domains from Feather's published list, not a trust endorsement.
// HTTPS ports checked separately; never disable certificate verification.
export const FEATHER_NODE_SOURCE = 'https://github.com/feather-wallet/feather/blob/f43b8de3d59d2c31592903140172e224b358130e/src/assets/nodes.json';
export const COMMUNITY_NODES = [
  { name: 'Cake Wallet', url: 'https://xmr-node.cakewallet.com:18081' },
  { name: 'MoneroDevs', url: 'https://node.monerodevs.org:18089' },
  { name: 'Seth for Privacy', url: 'https://node.sethforprivacy.com' },
] as const;
export const ONION_NODES = [
  { name: 'plowsof', url: 'http://plowsof3t5hogddwabaeiyrno25efmzfxyro2vligremt7sxpsclfaid.onion:18089' },
  { name: 'Rucknium', url: 'http://rucknium757bokwv3ss35ftgc3gzb7hgbvvglbg3hisp7tsj2fkd2nyd.onion:18081' },
] as const;
export const EXCHANGE_SOURCE = 'https://www.getmonero.org/community/merchants/';
export const CHANGENOW_KYC_SOURCE = 'https://changenow.io/terms-of-use/aml-kyc';
export const EXCHANGES = [
  { name: 'ChangeNOW', url: 'https://changenow.io/?from=btc&to=xmr' },
  { name: 'SimpleSwap', url: 'https://simpleswap.io/' },
] as const;
