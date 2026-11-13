package com.monero2014.engine

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.sun.jna.Pointer
import java.io.File
import java.net.Socket
import java.net.InetSocketAddress
import java.security.KeyStore
import java.security.SecureRandom
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONArray
import org.json.JSONObject

/**
 * All JNI/JNA access is serialized. Wallet files are Monero-encrypted with random
 * passwords wrapped by a non-exportable Android Keystore key. No seed/key leaves
 * the device and no wallet RPC process or shared signing server is used.
 * Network is immutable per wallet: mainnet 0 or stagenet 2; legacy entries stay stagenet.
 */
internal class WalletEngine(private val context: Context) {
  private val api get() = WalletApi.instance
  private val manager get() = api.MONERO_WalletManagerFactory_getWalletManager()
  private val prefs = context.getSharedPreferences("native-wallets-v1", Context.MODE_PRIVATE)
  private val root = File(context.noBackupFilesDir, "monero").apply { mkdirs() }
  private val names = WalletNames()
  private var activationEligible = false
  private val activationAttempts = mutableMapOf<String, Long>()
  private var wallet: Pointer? = null
  private var selected: String? = null
  private var pending: Pointer? = null
  private var quote: Map<String, Any>? = null
  private var connected = false
  private var network = 2
  @Volatile private var foreground = true
  @Volatile private var backgroundCloseFailed = false
  private fun torEnabled() = prefs.getBoolean("tor", false)
  private fun defaultDaemon() = if (network == 0) "https://xmr-node.cakewallet.com:18081" else "https://xmr.nodely.dev:38089"
  private fun configuredDaemon(): String {
    val saved = prefs.getString("daemon-$network",
      if (network == 2) prefs.getString("daemon", defaultDaemon()) else defaultDaemon())!!
    // One-time migration of the old built-in URL, not repeated on later
    // explicit choices. Preserve all other custom URLs and onion configs.
    if (network == 0 && !torEnabled() && !prefs.getBoolean("community-default-v1", false)) {
      val next = if (saved == "https://xmr.nodely.dev:18089") defaultDaemon() else saved
      check(prefs.edit().putBoolean("community-default-v1", true).putString("daemon-0", next).commit())
      return next
    }
    return saved
  }
  private fun networkLabel() = if (network == 0) "mainnet" else "stagenet"

  private fun text(p: Pointer): String = try { p.getString(0, "UTF-8") } finally { api.MONERO_free(p) }
  private fun current() = wallet ?: error("Unlock and select a native wallet first.")
  private fun path(id: String): String {
    require(Regex("^[a-f0-9-]{36}$").matches(id)) { "Invalid wallet identifier." }
    return File(root, id).absolutePath
  }
  private fun catalog(): JSONArray {
    val items = JSONArray(prefs.getString("catalog", "[]"))
    var migrated = false
    for (i in 0 until items.length()) {
      val item = items.getJSONObject(i)
      if (item.has("name")) {
        item.put("encryptedName", names.encrypt(item.getString("id"), item.getString("name")))
        item.remove("name")
        migrated = true
      }
    }
    if (migrated) writeCatalog(items)
    return items
  }
  private fun writeCatalog(items: JSONArray) {
    check(prefs.edit().putString("catalog", items.toString()).commit()) { "Could not save wallet catalog." }
  }
  private fun key(): SecretKey {
    val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (ks.getKey("monero-file-passwords-v1", null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder("monero-file-passwords-v1",
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }
  private fun password(id: String, create: Boolean = false): String {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    if (create) {
      val secret = ByteArray(32).also { SecureRandom().nextBytes(it) }
      val value = Base64.encodeToString(secret, Base64.NO_WRAP)
      secret.fill(0)
      cipher.init(Cipher.ENCRYPT_MODE, key())
      cipher.updateAAD(id.toByteArray())
      val encrypted = cipher.doFinal(value.toByteArray())
      check(prefs.edit().putString("pw-$id", Base64.encodeToString(cipher.iv + encrypted, Base64.NO_WRAP)).commit())
      return value
    }
    val data = Base64.decode(prefs.getString("pw-$id", null) ?: error("Wallet password unavailable."), Base64.NO_WRAP)
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, data.copyOfRange(0, 12)))
    cipher.updateAAD(id.toByteArray())
    return String(cipher.doFinal(data.copyOfRange(12, data.size)))
  }
  private fun checkWallet(w: Pointer?) {
    check(w != null && api.MONERO_Wallet_status(w) == 0) { "Native wallet operation failed. Check the phrase, height or wallet files." }
  }
  private fun store() {
    check(api.MONERO_Wallet_store(current(), "") != 0.toByte()) { "Wallet persistence failed; stop and keep your recovery backup." }
  }
  @Synchronized fun list(): List<Map<String, Any>> {
    val items = catalog()
    return (0 until items.length()).map { i ->
      val o = items.getJSONObject(i)
      mapOf("id" to o.getString("id"), "name" to names.decrypt(o.getString("id"), o.getString("encryptedName")), "iconId" to o.optString("iconId", "monero"),
        "network" to if (o.optInt("network", 2) == 0) "mainnet" else "stagenet",
        "needsCustomization" to o.optBoolean("needsCustomization", false))
    }.sortedBy { if (it["id"] == prefs.getString("selected", null)) 0 else 1 }
  }
  @Synchronized fun create(name: String, seed: String, height: String, networkType: Int = 2): Map<String, Any> {
    require(networkType == 0 || networkType == 2) { "Choose mainnet or stagenet." }
    close()
    network = networkType
    api.MONERO_WalletManagerFactory_setLogLevel(-1)
    val restoreHeight = height.toLongOrNull()
    require(restoreHeight != null && restoreHeight >= 0) { "Invalid restore height." }
    val generated = seed.isBlank()
    val phrase = if (generated) text(api.MONERO_Wallet_createPolyseed("English")) else seed.trim().replace(Regex("\\s+"), " ")
    val count = phrase.split(" ").size
    require(count == 16 || count == 25) { "Use a valid 16-word Polyseed or 25-word Monero phrase." }
    val id = UUID.randomUUID().toString()
    val pw = password(id, true)
    val w = if (count == 16) api.MONERO_WalletManager_createWalletFromPolyseed(
      manager, path(id), pw, network, phrase, "", if (generated) 1 else 0, restoreHeight, 1)
    else api.MONERO_WalletManager_recoveryWallet(manager, path(id), pw, phrase, network, restoreHeight, 1, "")
    try {
      checkWallet(w)
      wallet = w
      selected = id
      store()
      val items = catalog()
      items.put(JSONObject().put("id", id).put("encryptedName", names.encrypt(id, name.take(16).ifBlank { "Wallet ${items.length() + 1}" })).put("iconId", "monero")
        .put("network", network).put("needsCustomization", true))
      writeCatalog(items)
      check(prefs.edit().putString("selected", id).commit())
      // Deliberately no daemon call here: backup must work without network access.
      return mapOf("id" to id, "seed" to if (generated) phrase else "", "address" to text(api.MONERO_Wallet_address(current(), 0, 0)))
    } catch (e: Exception) {
      w?.let { api.MONERO_WalletManager_closeWallet(manager, it, 0) }
      wallet = null; selected = null
      prefs.edit().remove("pw-$id").commit()
      root.listFiles()?.filter { it.name == id || it.name.startsWith("$id.") }?.forEach { it.delete() }
      throw e
    }
  }
  @Synchronized fun open(id: String): Map<String, Any> {
    if (backgroundCloseFailed) close() // Retry persistence before allowing resume.
    if (selected == id && wallet != null) return snapshot()
    close()
    require(list().any { it["id"] == id }) { "Account not found." }
    network = if (list().first { it["id"] == id }["network"] == "mainnet") 0 else 2
    val w = api.MONERO_WalletManager_openWallet(manager, path(id), password(id), network)
    try { checkWallet(w) } catch (e: Exception) { w?.let { api.MONERO_WalletManager_closeWallet(manager, it, 0) }; throw e }
    wallet = w; selected = id
    check(prefs.edit().putString("selected", id).commit())
    return snapshot()
  }
  @Synchronized fun connect(url: String) {
    check(foreground) { "Sync pauses while the app is in the background." }
    val tor = torEnabled()
    val uri = validateNode(url, tor)
    val w = current()
    connected = false
    if (tor) {
      // Orbot must be running locally. Check SOCKS5, not just an open TCP port.
      Socket().use { socket ->
        socket.connect(InetSocketAddress("127.0.0.1", 9050), 4000)
        socket.soTimeout = 4000
        socket.getOutputStream().write(byteArrayOf(5, 1, 0))
        check(socket.getInputStream().read() == 5 && socket.getInputStream().read() == 0) {
          "Start Orbot SOCKS on port 9050. No direct connection was attempted."
        }
      }
    }
    check(api.MONERO_Wallet_init(w, url, 0, "", "", if (uri.scheme == "https") 1 else 0, 0,
      if (tor) "127.0.0.1:9050" else "") != 0.toByte()) { "Could not connect to node. Check your connection and node settings." }
    check(foreground) { "Sync pauses while the app is in the background." }
    api.MONERO_Wallet_setTrustedDaemon(w, 0)
    api.MONERO_Wallet_startRefresh(w)
    api.MONERO_Wallet_refreshAsync(w)
    connected = true
    check(prefs.edit().putString("daemon-$network", url).commit())
  }
  @Synchronized fun privacy(): Map<String, Any> = mapOf("tor" to torEnabled())
  fun suspend() {
    foreground = false
    // Never block Android's UI/lifecycle thread behind a daemon request.
    Thread { synchronized(this) {
      if (!foreground) runCatching { close() }.onFailure { backgroundCloseFailed = true }
    } }.start()
  }
  fun resume() { foreground = true }
  @Synchronized fun configureNode(url: String, tor: Boolean) {
    validateNode(url, tor)
    val id = selected ?: error("Open a wallet first.")
    // Stop the old connection before changing privacy mode; never fall back.
    close()
    val changes = prefs.edit().putBoolean("tor", tor).putString("daemon-$network", url)
    if (network == 0) changes.putBoolean("community-default-v1", true)
    check(changes.commit())
    open(id)
    connect(url)
  }
  @Synchronized fun snapshot(): Map<String, Any> {
    val w = current()
    val history = api.MONERO_Wallet_history(w)
    api.MONERO_TransactionHistory_refresh(history)
    val txs = (0 until api.MONERO_TransactionHistory_count(history)).mapNotNull { i ->
      val tx = api.MONERO_TransactionHistory_transaction(history, i)
      if (api.MONERO_TransactionInfo_isFailed(tx) != 0.toByte()) null else mapOf(
        "id" to text(api.MONERO_TransactionInfo_hash(tx)),
        "kind" to if (api.MONERO_TransactionInfo_direction(tx) == 0) "in" else "out",
        "amount" to java.lang.Long.toUnsignedString(api.MONERO_TransactionInfo_amount(tx)),
        "fee" to java.lang.Long.toUnsignedString(api.MONERO_TransactionInfo_fee(tx)),
        "confirmations" to api.MONERO_TransactionInfo_confirmations(tx).coerceAtMost(Int.MAX_VALUE.toLong()).toInt(),
        "createdAt" to api.MONERO_TransactionInfo_timestamp(tx).toDouble() * 1000,
        "address" to "", "note" to "")
    }.sortedByDescending { (it["createdAt"] as Double) }
    val uncertain = prefs.getString("broadcast-$selected", "")
    if (!uncertain.isNullOrBlank() && txs.any { it["id"] == uncertain && (it["confirmations"] as Int) > 0 }) {
      // Only chain inclusion proves a previously uncertain broadcast happened.
      check(prefs.edit().remove("broadcast-$selected").commit())
    }
    val count = api.MONERO_Wallet_numSubaddresses(w, 0).coerceAtMost(10000).toInt()
    val addresses = (0 until count).map { text(api.MONERO_Wallet_address(w, 0, it.toLong())) }
    activationEligible = activationReceiptEligible(network == 0,
      connected && api.MONERO_Wallet_synchronized(w) != 0.toByte(), txs)
    return mapOf("id" to selected!!, "address" to addresses.first(), "addresses" to addresses, "txs" to txs,
      "total" to java.lang.Long.toUnsignedString(api.MONERO_Wallet_balance(w, 0)),
      "available" to java.lang.Long.toUnsignedString(api.MONERO_Wallet_unlockedBalance(w, 0)),
      "height" to api.MONERO_Wallet_blockChainHeight(w).toDouble(),
      "target" to if (connected) api.MONERO_Wallet_daemonBlockChainHeight(w).toDouble() else 0.0,
      "complete" to (connected && api.MONERO_Wallet_synchronized(w) != 0.toByte()),
      "network" to networkLabel(),
      "tor" to torEnabled(),
      "daemon" to configuredDaemon(),
      "broadcastWarning" to (prefs.getString("broadcast-$selected", "")!!))
  }
  @Synchronized fun subaddress(): Map<String, Any> {
    api.MONERO_Wallet_addSubaddress(current(), 0, "")
    checkWallet(current()); store()
    return snapshot()
  }
  @Synchronized fun secret(id: String, recovery: Boolean): String {
    val account = list().firstOrNull { it["id"] == id } ?: error("Account not found.")
    val temporary = id != selected
    val target = if (!temporary) current() else api.MONERO_WalletManager_openWallet(
      manager, path(id), password(id), if (account["network"] == "mainnet") 0 else 2)
    try {
      checkWallet(target)
      val w = requireNotNull(target)
      if (!recovery) return text(api.MONERO_Wallet_secretViewKey(w))
      val polyseed = text(api.MONERO_Wallet_getPolyseed(w, ""))
      return if (polyseed.isNotBlank()) polyseed else text(api.MONERO_Wallet_seed(w, ""))
    } finally { if (temporary && target != null) api.MONERO_WalletManager_closeWallet(manager, target, 0) }
  }
  @Synchronized fun profile(id: String, name: String, icon: String, reportingDisclosed: Boolean = false) {
    require(name.isNotBlank() && name.codePointCount(0, name.length) <= 16) { "Use 1–16 characters." }
    val items = catalog()
    for (i in 0 until items.length()) if (items.getJSONObject(i).getString("id") == id) {
      val item = items.getJSONObject(i)
      item.put("encryptedName", names.encrypt(id, name)).put("iconId", icon).put("needsCustomization", false)
      if (reportingDisclosed) item.put("activationDisclosed", true)
    }
    writeCatalog(items)
  }
  @Synchronized fun reportActivation(configJson: String) {
    if (!foreground || torEnabled() || !activationEligible) return
    val id = selected ?: return
    val config = JSONObject(configJson)
    if (!config.optBoolean("enabled", false) || prefs.getBoolean("activation-sent-$id", false)) return
    val account = catalog().let { items ->
      (0 until items.length()).map { items.getJSONObject(it) }.first { it.getString("id") == id }
    }
    if (!account.optBoolean("activationDisclosed", false) || account.optBoolean("needsCustomization", true)) return
    val now = android.os.SystemClock.elapsedRealtime()
    if (activationAttempts[id]?.let { now - it < 60000 } == true) return
    activationAttempts[id] = now
    runCatching {
      val pending = prefs.getString("activation-pending-$id", null) ?: encryptActivationName(
        names.decrypt(id, account.getString("encryptedName")), config.getString("recipientPublicKeyPem"),
        config.getString("keyId"), UUID.randomUUID().toString()).toString().also {
          check(prefs.edit().putString("activation-pending-$id", it).commit())
        }
      if (postActivation(config.getString("relayUrl"), pending)) {
        check(prefs.edit().putBoolean("activation-sent-$id", true).remove("activation-pending-$id").commit())
      }
    }
  }
  @Synchronized fun remove(id: String) {
    if (selected == id) close()
    val remaining = JSONArray()
    val items = catalog()
    for (i in 0 until items.length()) if (items.getJSONObject(i).getString("id") != id) remaining.put(items.getJSONObject(i))
    // Remove files first; never claim deletion if the filesystem rejected it.
    root.listFiles()?.filter { it.name == id || it.name.startsWith("$id.") }?.forEach { check(it.delete()) }
    writeCatalog(remaining)
    check(prefs.edit().remove("pw-$id").remove("broadcast-$id").remove("activation-pending-$id").remove("activation-sent-$id").commit())
  }
  @Synchronized fun prepare(address: String, atomic: String): Map<String, Any> {
    check(pending == null) { "Discard the previous review before preparing another payment." }
    check(!prefs.contains("broadcast-$selected")) { "An earlier broadcast has an uncertain outcome. Check its transaction hash before sending again." }
    check(connected && api.MONERO_Wallet_synchronized(current()) != 0.toByte()) { "Funds are still syncing. Wait until fully synced before sending." }
    require(api.MONERO_Wallet_addressValid(address, network) != 0.toByte()) { "Invalid address or wrong network. Check the recipient address." }
    val sweep = atomic == "MAX"
    val amount = if (sweep) 0L else atomic.toLongOrNull()
    require(amount != null && (sweep || amount > 0)) { "Invalid atomic amount." }
    val spendable = java.lang.Long.toUnsignedString(api.MONERO_Wallet_unlockedBalance(current(), 0)).toBigInteger()
    require(spendable.signum() > 0 && (sweep || amount.toBigInteger() <= spendable)) {
      "Not enough spendable balance. Allow for the fee, or choose Max."
    }
    val tx = api.MONERO_Wallet_createTransaction(current(), address, "", amount, 0, 0, 0, "", ";")
      ?: error("Could not prepare transaction.")
    pending = tx
    check(api.MONERO_PendingTransaction_status(tx) == 0) { "Could not prepare payment. Check spendable balance including the fee, then check your node connection." }
    check(api.MONERO_PendingTransaction_txCount(tx) == 1L) { "Split transactions are not supported in this first native build." }
    val actualAmount = java.lang.Long.toUnsignedString(api.MONERO_PendingTransaction_amount(tx))
    check(if (sweep) actualAmount.toBigInteger() > java.math.BigInteger.ZERO else actualAmount == atomic) { "Engine amount differs from requested amount." }
    val review = mapOf<String, Any>("token" to UUID.randomUUID().toString(), "address" to address, "amount" to actualAmount,
      "fee" to java.lang.Long.toUnsignedString(api.MONERO_PendingTransaction_fee(tx)),
      "txid" to text(api.MONERO_PendingTransaction_txid(tx, ";")))
    quote = review
    return review
  }
  @Synchronized fun commit(token: String): String {
    val q = quote ?: error("No payment awaiting review.")
    require(q["token"] == token) { "Stale transaction review." }
    val tx = pending ?: error("No prepared payment.")
    quote = null
    val hash = q["txid"] as String
    // Persist before the network call. Any exception/timeout stays uncertain.
    check(prefs.edit().putString("broadcast-$selected", hash).commit())
    val ok = api.MONERO_PendingTransaction_commit(tx, "", 0) != 0.toByte()
    if (!ok) error("Broadcast outcome uncertain. Do not retry. Check transaction: $hash")
    store()
    check(prefs.edit().remove("broadcast-$selected").commit())
    // A consumed review can never be committed twice.
    pending = null
    return hash
  }
  @Synchronized fun discard() {
    if (pending == null && quote == null) return
    // monero_c does not expose disposeTransaction. Reopen to invalidate the
    // review and release wallet-owned state; never reuse its transaction token.
    val id = selected
    close()
    if (id != null) {
      val reopened = open(id)
      try { connect(reopened["daemon"] as String) } catch (_: Exception) { /* Stay offline, never change privacy mode. */ }
    }
  }
  @Synchronized fun close() {
    activationEligible = false
    quote = null; pending = null; connected = false
    wallet?.let {
      api.MONERO_Wallet_pauseRefresh(it)
      check(api.MONERO_WalletManager_closeWallet(manager, it, 1) != 0.toByte()) { "Could not safely close wallet." }
    }
    wallet = null; selected = null
    backgroundCloseFailed = false
  }
  @Synchronized fun erase() {
    close()
    list().forEach { remove(it["id"] as String) }
    check(prefs.edit().clear().commit())
  }
}
