/** Native exceptions carry bridge prefixes; match categories without exposing
 * engine internals or silently changing an uncertain broadcast into a retry.
 */
export function errorKey(source: string) {
  if (/broadcast.*(uncertain|unknown)|earlier broadcast/i.test(source)) return 'Payment status is uncertain. Do not send again. Check transaction history and the transaction ID first.';
  if (/could not prepare|preparation failed/i.test(source)) return 'Could not prepare payment. Check the available balance, fee and node connection.';
  if (/insufficient|not enough|unlocked balance/i.test(source)) return 'Not enough spendable balance. Allow for the fee, or choose Max.';
  if (/positive amount|Invalid payment amount/i.test(source)) return 'Amount must be greater than zero.';
  if (/invalid.*address|wrong network/i.test(source)) return 'Invalid address or wrong network. Check the recipient address.';
  if (/finish .*scanning|funds are still syncing|synchronization before sending/i.test(source)) return 'Funds are still syncing. Wait until fully synced before sending.';
  if (/Orbot|SOCKS|onion|Tor requires/i.test(source)) return 'Start Orbot on port 9050 and enter a v3 onion node. No direct fallback is used.';
  if (/daemon|node|network|connect/i.test(source)) return 'Could not connect to node. Check your connection and node settings.';
  if (/phrase, height|invalid.*seed|invalid.*phrase/i.test(source)) return 'Could not restore wallet. Check the recovery words and restore height.';
  if (/invalid QR/i.test(source)) return 'Invalid address or wrong network. Check the recipient address.';
  return source;
}
