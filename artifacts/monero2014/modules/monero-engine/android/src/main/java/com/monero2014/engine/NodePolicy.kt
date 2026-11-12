package com.monero2014.engine

import java.net.URI

/** Validate before wallet_init: no public node, DNS fallback, or credentials in Tor mode. */
internal fun validateNode(url: String, tor: Boolean): URI {
  val uri = URI(url)
  require(uri.host != null && uri.userInfo == null && uri.query == null && uri.fragment == null) {
    "Enter a node URL without credentials, query or fragment."
  }
  if (tor) require((uri.scheme == "http" || uri.scheme == "https") &&
    Regex("^[a-z2-7]{56}\\.onion$").matches(uri.host)) {
    "Tor requires a v3 onion node. Public nodes are never used in Tor mode."
  } else require(uri.scheme == "https" && !uri.host.endsWith(".onion")) {
    "Use an HTTPS node, or enable Tor for an onion node."
  }
  return uri
}
