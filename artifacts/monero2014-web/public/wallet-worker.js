/* Monero wallet2 strips path prefixes from daemon URLs. Restore the fixed,
 * same-origin relay prefix at the HTTP transport boundary inside the worker.
 * Never patch vendor code or allow the worker to choose an arbitrary relay.
 */
importScripts(new URL('monero.worker.js', self.location.href).href);

const request = self.HttpClient.request.bind(self.HttpClient);
const endpoints = new Set([
  'gethashes.bin', 'getblocks.bin', 'getblocks_by_height.bin',
  'gettransactions', 'getheight', 'getinfo', 'getversion', 'sendrawtransaction',
  'json_rpc', 'get_info', 'get_height', 'get_version', 'get_blocks.bin',
  'get_blocks_by_height.bin', 'get_hashes.bin', 'get_o_indexes.bin',
  'get_outs.bin', 'get_outs', 'get_transactions', 'get_transaction_pool_hashes.bin',
  'get_transaction_pool', 'get_transaction_pool_stats', 'is_key_image_spent',
  'send_raw_transaction', 'get_output_distribution.bin', 'get_limit',
]);
self.HttpClient.request = function(options) {
  const url = new URL(options.uri);
  if (url.origin !== self.location.origin) {
    return Promise.reject(new Error('The test wallet only uses its same-origin stagenet relay.'));
  }
  const endpoint = url.pathname.split('/').filter(Boolean).pop();
  if (!endpoints.has(endpoint)) {
    return Promise.reject(new Error('Unsupported daemon endpoint.'));
  }
  url.pathname = `/api/monero/daemon/stagenet/${endpoint}`;
  url.search = '';
  return request({ ...options, uri: url.href });
};
