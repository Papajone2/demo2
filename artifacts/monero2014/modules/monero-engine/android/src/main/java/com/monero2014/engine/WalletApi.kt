package com.monero2014.engine

import com.sun.jna.Library
import com.sun.jna.Native
import com.sun.jna.Pointer

/** Exact monero_c v0.18.4.6-RC2 ABI. C bool is one byte, NOT JNA Boolean. */
internal interface WalletApi : Library {
  fun MONERO_free(value: Pointer)
  fun MONERO_WalletManagerFactory_getWalletManager(): Pointer
  fun MONERO_WalletManagerFactory_setLogLevel(level: Int)
  fun MONERO_Wallet_createPolyseed(language: String): Pointer
  fun MONERO_WalletManager_createWalletFromPolyseed(manager: Pointer, path: String, password: String,
    network: Int, seed: String, passphrase: String, newWallet: Byte, height: Long, rounds: Long): Pointer?
  fun MONERO_WalletManager_recoveryWallet(manager: Pointer, path: String, password: String,
    seed: String, network: Int, height: Long, rounds: Long, offset: String): Pointer?
  fun MONERO_WalletManager_openWallet(manager: Pointer, path: String, password: String, network: Int): Pointer?
  fun MONERO_WalletManager_closeWallet(manager: Pointer, wallet: Pointer, store: Byte): Byte
  fun MONERO_Wallet_status(wallet: Pointer): Int
  fun MONERO_Wallet_store(wallet: Pointer, path: String): Byte
  fun MONERO_Wallet_address(wallet: Pointer, account: Long, index: Long): Pointer
  fun MONERO_Wallet_addressValid(address: String, network: Int): Byte
  fun MONERO_Wallet_init(wallet: Pointer, daemon: String, maxSize: Long, user: String, password: String,
    ssl: Byte, light: Byte, proxy: String): Byte
  fun MONERO_Wallet_setTrustedDaemon(wallet: Pointer, trusted: Byte)
  fun MONERO_Wallet_startRefresh(wallet: Pointer)
  fun MONERO_Wallet_pauseRefresh(wallet: Pointer)
  fun MONERO_Wallet_refreshAsync(wallet: Pointer)
  fun MONERO_Wallet_synchronized(wallet: Pointer): Byte
  fun MONERO_Wallet_blockChainHeight(wallet: Pointer): Long
  fun MONERO_Wallet_daemonBlockChainHeight(wallet: Pointer): Long
  fun MONERO_Wallet_balance(wallet: Pointer, account: Int): Long
  fun MONERO_Wallet_unlockedBalance(wallet: Pointer, account: Int): Long
  fun MONERO_Wallet_numSubaddresses(wallet: Pointer, account: Int): Long
  fun MONERO_Wallet_addSubaddress(wallet: Pointer, account: Int, label: String)
  fun MONERO_Wallet_history(wallet: Pointer): Pointer
  fun MONERO_TransactionHistory_refresh(history: Pointer)
  fun MONERO_TransactionHistory_count(history: Pointer): Int
  fun MONERO_TransactionHistory_transaction(history: Pointer, index: Int): Pointer
  fun MONERO_TransactionInfo_direction(tx: Pointer): Int
  fun MONERO_TransactionInfo_isFailed(tx: Pointer): Byte
  fun MONERO_TransactionInfo_amount(tx: Pointer): Long
  fun MONERO_TransactionInfo_fee(tx: Pointer): Long
  fun MONERO_TransactionInfo_confirmations(tx: Pointer): Long
  fun MONERO_TransactionInfo_hash(tx: Pointer): Pointer
  fun MONERO_TransactionInfo_timestamp(tx: Pointer): Long
  fun MONERO_Wallet_createTransaction(wallet: Pointer, address: String, paymentId: String, amount: Long,
    mixin: Int, priority: Int, account: Int, inputs: String, separator: String): Pointer?
  fun MONERO_PendingTransaction_status(tx: Pointer): Int
  fun MONERO_PendingTransaction_fee(tx: Pointer): Long
  fun MONERO_PendingTransaction_amount(tx: Pointer): Long
  fun MONERO_PendingTransaction_txCount(tx: Pointer): Long
  fun MONERO_PendingTransaction_txid(tx: Pointer, separator: String): Pointer
  fun MONERO_PendingTransaction_commit(tx: Pointer, filename: String, overwrite: Byte): Byte

  companion object {
    val instance: WalletApi by lazy { Native.load("monero_wallet2_api_c", WalletApi::class.java) }
  }
}
