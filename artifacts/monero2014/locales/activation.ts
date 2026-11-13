const languages = ['es', 'de', 'fr', 'pt', 'ru', 'zh-Hans', 'ja', 'ko', 'tr', 'hi'];
const rows: Record<string, string[]> = {
  'Android stores wallet names encrypted on this device.': [
    'Android guarda los nombres de las carteras cifrados en este dispositivo.',
    'Android speichert Wallet-Namen auf diesem Gerät verschlüsselt.',
    'Android stocke les noms des portefeuilles chiffrés sur cet appareil.',
    'O Android guarda os nomes das carteiras encriptados neste dispositivo.',
    'Android хранит названия кошельков на этом устройстве в зашифрованном виде.',
    'Android 在此设备上加密存储钱包名称。',
    'Android はこの端末上でウォレット名を暗号化して保存します。',
    'Android는 이 기기에 지갑 이름을 암호화하여 저장합니다.',
    'Android cüzdan adlarını bu cihazda şifrelenmiş olarak saklar.',
    'Android इस डिवाइस पर वॉलेट के नाम एन्क्रिप्ट करके रखता है।',
  ],
  'Activation reporting is not configured. No wallet-name reports are sent.': [
    'Los informes de activación no están configurados. No se envían informes de nombres.',
    'Aktivierungsberichte sind nicht eingerichtet. Es werden keine Wallet-Namen gemeldet.',
    'Les rapports d’activation ne sont pas configurés. Aucun nom de portefeuille n’est envoyé.',
    'Os relatórios de ativação não estão configurados. Não são enviados nomes de carteiras.',
    'Отчёты об активации не настроены. Названия кошельков не отправляются.',
    '尚未配置激活报告。不会发送钱包名称报告。',
    '有効化レポートは未設定です。ウォレット名は送信されません。',
    '활성화 보고가 설정되지 않았습니다. 지갑 이름 보고는 전송되지 않습니다.',
    'Etkinleştirme bildirimi yapılandırılmadı. Cüzdan adı bildirimi gönderilmez.',
    'सक्रियण रिपोर्टिंग कॉन्फ़िगर नहीं है। वॉलेट के नाम की कोई रिपोर्ट नहीं भेजी जाती।',
  ],
  'Continuing enables a one-time report after this wallet receives its first confirmed payment. Your encrypted wallet name is sent to the app operator, who can decrypt it. Your recovery phrase, address and payment amount are not sent. Reporting is paused while Tor is enabled.': [
    'Al continuar, permites un informe único cuando esta cartera reciba su primer pago confirmado. El nombre cifrado se envía al operador de la app, que puede descifrarlo. No se envían tu frase de recuperación, dirección ni importe. Los informes se pausan con Tor activado.',
    'Wenn du fortfährst, wird nach der ersten bestätigten Zahlung ein einmaliger Bericht aktiviert. Dein verschlüsselter Wallet-Name wird an den App-Betreiber gesendet, der ihn entschlüsseln kann. Wiederherstellungsphrase, Adresse und Betrag werden nicht gesendet. Bei aktiviertem Tor pausieren Berichte.',
    'Continuer active un rapport unique après le premier paiement confirmé reçu. Le nom chiffré est envoyé à l’opérateur de l’app, qui peut le déchiffrer. La phrase de récupération, l’adresse et le montant ne sont pas envoyés. Les rapports sont suspendus lorsque Tor est activé.',
    'Ao continuar, ativas um relatório único após o primeiro pagamento confirmado recebido. O nome encriptado é enviado ao operador da app, que pode desencriptá-lo. A frase de recuperação, o endereço e o montante não são enviados. Os relatórios são pausados com o Tor ativo.',
    'Продолжая, вы включаете разовый отчёт после первого подтверждённого входящего платежа. Зашифрованное название отправляется оператору приложения, который может его расшифровать. Фраза восстановления, адрес и сумма не отправляются. При включённом Tor отчёты приостанавливаются.',
    '继续即启用一次性报告：此钱包收到首笔已确认付款后，加密的钱包名称将发送给应用运营者，运营者可以解密。恢复短语、地址和付款金额不会发送。启用 Tor 时暂停报告。',
    '続行すると、このウォレットが最初の承認済み入金を受け取った後、一度だけレポートを送信します。暗号化されたウォレット名はアプリ運営者に送信され、運営者は復号できます。復元フレーズ、アドレス、金額は送信されません。Tor 有効時は送信を一時停止します。',
    '계속하면 첫 번째 확인된 입금 후 일회성 보고가 활성화됩니다. 암호화된 지갑 이름이 앱 운영자에게 전송되며 운영자는 복호화할 수 있습니다. 복구 문구, 주소, 금액은 전송되지 않습니다. Tor가 활성화되면 보고가 일시 중지됩니다.',
    'Devam etmek, ilk onaylanmış ödeme alındıktan sonra tek seferlik bildirimi etkinleştirir. Şifreli cüzdan adı, şifresini çözebilen uygulama işletmecisine gönderilir. Kurtarma ifadeniz, adresiniz ve ödeme tutarı gönderilmez. Tor etkinken bildirimler duraklatılır.',
    'जारी रखने पर पहली पुष्टि की गई प्राप्ति के बाद एक बार रिपोर्ट भेजना सक्रिय होगा। एन्क्रिप्ट किया गया वॉलेट नाम ऐप संचालक को भेजा जाता है, जो उसे डिक्रिप्ट कर सकता है। रिकवरी वाक्यांश, पता और भुगतान राशि नहीं भेजी जाती। Tor चालू होने पर रिपोर्टिंग रुक जाती है।',
  ],
};
export function withActivationCopy(language: string, original: Record<string, string>) {
  const index = languages.indexOf(language);
  if (index < 0) return original;
  for (const [key, values] of Object.entries(rows)) original[key] = values[index];
  return original;
}
