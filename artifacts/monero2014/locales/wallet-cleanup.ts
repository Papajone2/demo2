/** Neutral recovery copy and clearly separated browser-preview disclosures. */
const languages = ['es', 'de', 'fr', 'pt', 'ru', 'zh-Hans', 'ja', 'ko', 'tr', 'hi'];
const rows: Record<string, string[]> = {
  'A forgotten PIN or password cannot be recovered. Erasing removes the wallets and app lock from this device. You will need your recovery phrase to restore access.': [
    'Un PIN o contraseña olvidados no se pueden recuperar. Al borrar se eliminan las carteras y el bloqueo de este dispositivo. Necesitarás tu frase de recuperación para restaurar el acceso.',
    'Eine vergessene PIN oder ein vergessenes Passwort kann nicht wiederhergestellt werden. Beim Löschen werden Wallets und App-Sperre von diesem Gerät entfernt. Für den erneuten Zugriff brauchst du deine Wiederherstellungsphrase.',
    'Un PIN ou mot de passe oublié ne peut pas être récupéré. L’effacement supprime les portefeuilles et le verrou de cet appareil. Votre phrase de récupération sera nécessaire pour rétablir l’accès.',
    'Um PIN ou senha esquecidos não podem ser recuperados. Apagar remove as carteiras e o bloqueio deste dispositivo. Você precisará da frase de recuperação para restaurar o acesso.',
    'Забытый PIN или пароль восстановить нельзя. Стирание удаляет кошельки и блокировку приложения с этого устройства. Для восстановления доступа понадобится фраза восстановления.',
    '忘记的 PIN 或密码无法找回。清除操作会删除此设备上的钱包和应用锁。你需要恢复短语才能恢复访问。',
    '忘れたPINやパスワードは復元できません。消去すると、この端末のウォレットとアプリロックが削除されます。アクセスを復元するにはリカバリーフレーズが必要です。',
    '잊어버린 PIN이나 비밀번호는 복구할 수 없습니다. 삭제하면 이 기기의 지갑과 앱 잠금이 제거됩니다. 접근을 복원하려면 복구 구문이 필요합니다.',
    'Unutulan PIN veya şifre kurtarılamaz. Silme işlemi bu cihazdaki cüzdanları ve uygulama kilidini kaldırır. Erişimi geri yüklemek için kurtarma ifadeniz gerekir.',
    'भूला हुआ PIN या पासवर्ड वापस नहीं पाया जा सकता। मिटाने से इस डिवाइस के वॉलेट और ऐप लॉक हट जाते हैं। पहुँच बहाल करने के लिए रिकवरी वाक्यांश चाहिए।',
  ],
  'Preview only · no real XMR': [
    'Solo vista previa · sin XMR real', 'Nur Vorschau · keine echten XMR', 'Aperçu uniquement · pas de vrais XMR',
    'Apenas prévia · sem XMR real', 'Только предпросмотр · без настоящих XMR', '仅供预览 · 无真实 XMR',
    'プレビューのみ · 実際のXMRではありません', '미리보기 전용 · 실제 XMR 아님', 'Yalnızca önizleme · gerçek XMR yok', 'केवल पूर्वावलोकन · वास्तविक XMR नहीं',
  ],
  'Clear preview data': [
    'Borrar datos de vista previa', 'Vorschaudaten löschen', 'Effacer les données de l’aperçu',
    'Limpar dados da prévia', 'Очистить данные предпросмотра', '清除预览数据', 'プレビューデータを消去',
    '미리보기 데이터 지우기', 'Önizleme verilerini temizle', 'पूर्वावलोकन डेटा मिटाएँ',
  ],
  'Real Monero addresses are not supported in the preview.': [
    'La vista previa no admite direcciones Monero reales.', 'Echte Monero-Adressen werden in der Vorschau nicht unterstützt.',
    'L’aperçu ne prend pas en charge les vraies adresses Monero.', 'Endereços Monero reais não são aceitos na prévia.',
    'Настоящие адреса Monero не поддерживаются в предпросмотре.', '预览不支持真实的门罗币地址。',
    'プレビューでは実際のMoneroアドレスは使用できません。', '미리보기에서는 실제 Monero 주소를 지원하지 않습니다.',
    'Önizlemede gerçek Monero adresleri desteklenmez.', 'पूर्वावलोकन में वास्तविक Monero पते समर्थित नहीं हैं।',
  ],
  'Preview record only. No on-chain transaction exists.': [
    'Solo es un registro de vista previa. No existe una transacción en la blockchain.',
    'Nur ein Vorschaueintrag. Es gibt keine On-Chain-Transaktion.',
    'Enregistrement d’aperçu uniquement. Aucune transaction n’existe sur la blockchain.',
    'Apenas um registro da prévia. Não existe transação na blockchain.',
    'Только запись предпросмотра. Транзакции в блокчейне нет.',
    '仅为预览记录。链上不存在此交易。', 'プレビュー用の記録です。オンチェーン取引は存在しません。',
    '미리보기 기록일 뿐입니다. 온체인 거래는 없습니다.', 'Yalnızca önizleme kaydıdır. Zincir üzerinde işlem yoktur.',
    'यह केवल पूर्वावलोकन रिकॉर्ड है। ब्लॉकचेन पर कोई लेन-देन नहीं है।',
  ],
  'This wallet cannot receive deposits on this network.': [
    'Esta cartera no puede recibir depósitos en esta red.', 'Diese Wallet kann in diesem Netzwerk keine Einzahlungen empfangen.',
    'Ce portefeuille ne peut pas recevoir de dépôts sur ce réseau.', 'Esta carteira não pode receber depósitos nesta rede.',
    'Этот кошелёк не может получать переводы в этой сети.', '此钱包无法在此网络接收转账。',
    'このウォレットはこのネットワークで入金を受け取れません。', '이 지갑은 이 네트워크에서 입금을 받을 수 없습니다.',
    'Bu cüzdan bu ağda para yatırılamaz.', 'यह वॉलेट इस नेटवर्क पर जमा प्राप्त नहीं कर सकता।',
  ],
};
export function withWalletCleanup(language: string, original: Record<string, string>) {
  const index = languages.indexOf(language);
  if (index < 0) return original;
  for (const [key, values] of Object.entries(rows)) {
    if (values.length !== languages.length || !values[index]) throw new Error(`Incomplete cleanup translation: ${key}`);
    original[key] = values[index];
  }
  return original;
}
