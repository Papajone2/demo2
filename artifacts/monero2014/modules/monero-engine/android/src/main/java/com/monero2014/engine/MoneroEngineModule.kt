package com.monero2014.engine

import android.view.WindowManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PersistableBundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MoneroEngineModule : Module() {
  private val engine by lazy { WalletEngine(requireNotNull(appContext.reactContext)) }
  private var privateClipboard: String? = null
  private fun clearPrivateClipboard() {
    val value = privateClipboard ?: return
    val context = appContext.reactContext ?: return
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    if (clipboard.primaryClip?.getItemAt(0)?.text?.toString() == value) {
      if (Build.VERSION.SDK_INT >= 28) clipboard.clearPrimaryClip()
      else clipboard.setPrimaryClip(ClipData.newPlainText("", ""))
    }
    privateClipboard = null
  }
  override fun definition() = ModuleDefinition {
    Name("MoneroEngine")
    OnCreate {
      appContext.currentActivity?.runOnUiThread {
        appContext.currentActivity?.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
    AsyncFunction("list") { engine.list() }
    AsyncFunction("create") { name: String, seed: String, height: String, network: Int -> engine.create(name, seed, height, network) }
    AsyncFunction("deriveSecret") { secret: String, saltHex: String, iterations: Int ->
      deriveLockSecret(secret, saltHex, iterations)
    }
    AsyncFunction("copyPrivateText") { value: String ->
      val context = requireNotNull(appContext.reactContext)
      val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val clip = ClipData.newPlainText("Recovery phrase", value)
      clip.description.extras = PersistableBundle().apply { putBoolean("android.content.extra.IS_SENSITIVE", true) }
      clipboard.setPrimaryClip(clip)
      privateClipboard = value
      Handler(Looper.getMainLooper()).postDelayed({
        runCatching {
          // Do not overwrite something else the user subsequently copied.
          if (privateClipboard == value) clearPrivateClipboard()
        }
      }, 60000)
      Unit
    }
    AsyncFunction("open") { id: String -> engine.open(id) }
    AsyncFunction("connect") { url: String -> engine.connect(url) }
    AsyncFunction("privacy") { engine.privacy() }
    AsyncFunction("configureNode") { url: String, tor: Boolean -> engine.configureNode(url, tor) }
    AsyncFunction("snapshot") { engine.snapshot() }
    AsyncFunction("subaddress") { engine.subaddress() }
    AsyncFunction("profile") { id: String, name: String, icon: String, reportingDisclosed: Boolean -> engine.profile(id, name, icon, reportingDisclosed) }
    AsyncFunction("reportActivation") { config: String -> engine.reportActivation(config) }
    AsyncFunction("secret") { id: String, recovery: Boolean -> engine.secret(id, recovery) }
    AsyncFunction("remove") { id: String -> engine.remove(id) }
    AsyncFunction("prepare") { address: String, amount: String -> engine.prepare(address, amount) }
    AsyncFunction("commit") { token: String -> engine.commit(token) }
    AsyncFunction("discard") { engine.discard() }
    AsyncFunction("close") { engine.close() }
    AsyncFunction("erase") { engine.erase(); runCatching { clearPrivateClipboard() }; Unit }
    OnActivityEntersBackground { engine.suspend() }
    OnActivityEntersForeground { engine.resume() }
    OnDestroy { engine.close() }
  }
}
