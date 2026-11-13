const languages = ['es', 'de', 'fr', 'pt', 'ru', 'zh-Hans', 'ja', 'ko', 'tr', 'hi'];
const rows: Record<string, string[]> = {
  'Swap Bitcoin or another supported cryptocurrency for Monero. The external provider handles the exchange and sends XMR to your receiving address in this wallet.': [
    'Cambia Bitcoin u otra criptomoneda compatible por Monero. El proveedor externo realiza el cambio y envía XMR a tu dirección de recepción en esta cartera.',
    'Tausche Bitcoin oder eine andere unterstützte Kryptowährung gegen Monero. Der externe Anbieter führt den Tausch aus und sendet XMR an deine Empfangsadresse in dieser Wallet.',
    'Échangez du Bitcoin ou une autre cryptomonnaie compatible contre du Monero. Le prestataire externe réalise l’échange et envoie les XMR à votre adresse de réception dans ce portefeuille.',
    'Troque Bitcoin ou outra criptomoeda compatível por Monero. O provedor externo faz a troca e envia XMR ao seu endereço de recebimento nesta carteira.',
    'Обменяйте Bitcoin или другую поддерживаемую криптовалюту на Monero. Внешний сервис выполняет обмен и отправляет XMR на адрес получения в этом кошельке.',
    '将比特币或其他受支持的加密货币兑换为门罗币。外部服务商处理兑换，并将 XMR 发送到此钱包的收款地址。',
    'Bitcoinなどの対応する暗号資産をMoneroに交換できます。外部サービスが交換を処理し、このウォレットの受取アドレスにXMRを送ります。',
    '비트코인 등 지원되는 암호화폐를 Monero로 교환하세요. 외부 제공업체가 교환을 처리하고 이 지갑의 수신 주소로 XMR을 보냅니다.',
    'Bitcoin veya desteklenen başka bir kripto parayı Monero ile takas edin. Harici sağlayıcı takası gerçekleştirir ve XMR’yi bu cüzdandaki alıcı adresinize gönderir.',
    'Bitcoin या किसी समर्थित क्रिप्टोकरेंसी को Monero में बदलें। बाहरी सेवा एक्सचेंज करती है और इस वॉलेट के प्राप्ति पते पर XMR भेजती है।',
  ],
  'How a swap works': ['Cómo funciona un cambio', 'So funktioniert ein Tausch', 'Comment fonctionne un échange', 'Como funciona uma troca', 'Как работает обмен', '兑换流程', '交換の流れ', '교환 방법', 'Takas nasıl çalışır', 'स्वैप कैसे होता है'],
  'Choose your currencies': ['Elige las monedas', 'Währungen auswählen', 'Choisissez vos monnaies', 'Escolha as moedas', 'Выберите валюты', '选择币种', '通貨を選ぶ', '통화 선택', 'Para birimlerini seçin', 'मुद्राएँ चुनें'],
  'ChangeNOW opens with BTC → XMR selected. You can change the sending currency on the provider’s website.': [
    'ChangeNOW se abre con BTC → XMR seleccionado. Puedes cambiar la moneda de envío en la web del proveedor.',
    'ChangeNOW öffnet sich mit BTC → XMR. Die Sendewährung kannst du auf der Website des Anbieters ändern.',
    'ChangeNOW s’ouvre avec BTC → XMR sélectionné. Vous pouvez modifier la monnaie envoyée sur le site du prestataire.',
    'O ChangeNOW abre com BTC → XMR selecionado. Você pode mudar a moeda de envio no site do provedor.',
    'ChangeNOW открывается с выбранной парой BTC → XMR. Валюту отправки можно изменить на сайте сервиса.',
    'ChangeNOW 打开时已选择 BTC → XMR。你可以在服务商网站更改转出币种。',
    'ChangeNOWはBTC → XMRが選択された状態で開きます。送る通貨はサービスのサイトで変更できます。',
    'ChangeNOW는 BTC → XMR이 선택된 상태로 열립니다. 제공업체 웹사이트에서 보낼 통화를 바꿀 수 있습니다.',
    'ChangeNOW, BTC → XMR seçili olarak açılır. Göndereceğiniz para birimini sağlayıcının sitesinde değiştirebilirsiniz.',
    'ChangeNOW में BTC → XMR पहले से चुना होगा। सेवा की वेबसाइट पर भेजी जाने वाली मुद्रा बदल सकते हैं।',
  ],
  'Use your receiving address': ['Usa tu dirección de recepción', 'Empfangsadresse verwenden', 'Utilisez votre adresse de réception', 'Use seu endereço de recebimento', 'Используйте адрес получения', '使用你的收款地址', '受取アドレスを使う', '수신 주소 사용', 'Alıcı adresinizi kullanın', 'अपना प्राप्ति पता इस्तेमाल करें'],
  'Copy an address from Receive in this wallet. On the provider’s website, check the destination, quote, fees and minimum amount before sending.': [
    'Copia una dirección desde Recibir en esta cartera. En la web del proveedor, comprueba el destino, la cotización, las comisiones y el mínimo antes de enviar.',
    'Kopiere eine Adresse unter Empfangen in dieser Wallet. Prüfe vor dem Senden Ziel, Angebot, Gebühren und Mindestbetrag auf der Website des Anbieters.',
    'Copiez une adresse depuis Recevoir dans ce portefeuille. Avant d’envoyer, vérifiez la destination, le devis, les frais et le minimum sur le site du prestataire.',
    'Copie um endereço em Receber nesta carteira. No site do provedor, confira destino, cotação, taxas e valor mínimo antes de enviar.',
    'Скопируйте адрес в разделе «Получить» этого кошелька. Перед отправкой проверьте на сайте сервиса адрес, курс, комиссии и минимальную сумму.',
    '从此钱包的“收款”页面复制地址。发送前，在服务商网站核对目标地址、报价、手续费和最低金额。',
    'このウォレットの「受け取る」からアドレスをコピーします。送金前にサービスのサイトで送付先、見積もり、手数料、最低額を確認してください。',
    '이 지갑의 받기에서 주소를 복사하세요. 보내기 전에 제공업체 사이트에서 목적지, 견적, 수수료, 최소 금액을 확인하세요.',
    'Bu cüzdanın Al bölümünden bir adres kopyalayın. Göndermeden önce sağlayıcının sitesinde hedefi, teklifi, ücretleri ve minimum tutarı kontrol edin.',
    'इस वॉलेट के प्राप्त करें पेज से पता कॉपी करें। भेजने से पहले सेवा की वेबसाइट पर पता, दर, शुल्क और न्यूनतम राशि जाँचें।',
  ],
  'Send, then wait for delivery': ['Envía y espera la entrega', 'Senden und Lieferung abwarten', 'Envoyez puis attendez la réception', 'Envie e aguarde o recebimento', 'Отправьте и дождитесь поступления', '发送并等待到账', '送金して着金を待つ', '보낸 후 입금 대기', 'Gönderin ve teslimatı bekleyin', 'भेजें और प्राप्ति की प्रतीक्षा करें'],
  'Follow the provider’s deposit instructions and keep your order ID. After the provider sends XMR, it appears here as your wallet syncs and the payment confirms.': [
    'Sigue las instrucciones de depósito del proveedor y guarda el ID del pedido. Tras el envío de XMR, aparecerá aquí al sincronizarse la cartera y confirmarse el pago.',
    'Befolge die Einzahlungsanweisungen des Anbieters und bewahre die Auftrags-ID auf. Sobald der Anbieter XMR sendet, erscheint es hier während Synchronisierung und Bestätigung.',
    'Suivez les instructions de dépôt et conservez votre numéro de commande. Une fois les XMR envoyés, ils apparaissent ici lors de la synchronisation et des confirmations.',
    'Siga as instruções de depósito do provedor e guarde o ID do pedido. Depois do envio de XMR, ele aparece aqui conforme a carteira sincroniza e o pagamento é confirmado.',
    'Следуйте инструкциям сервиса по переводу и сохраните номер заявки. После отправки XMR сервисом платёж появится здесь при синхронизации и получении подтверждений.',
    '遵循服务商的入金说明并保留订单编号。服务商发送 XMR 后，随着钱包同步和付款确认，款项会显示在这里。',
    'サービスの入金手順に従い、注文IDを保管してください。XMRが送られると、ウォレットの同期と取引確認に伴ってここに表示されます。',
    '제공업체의 입금 안내를 따르고 주문 ID를 보관하세요. 제공업체가 XMR을 보내면 지갑 동기화와 결제 확인에 따라 여기에 표시됩니다.',
    'Sağlayıcının yatırma talimatlarını izleyin ve sipariş kimliğini saklayın. Sağlayıcı XMR’yi gönderdiğinde cüzdan eşitlenip ödeme onaylandıkça burada görünür.',
    'सेवा के जमा निर्देशों का पालन करें और ऑर्डर ID रखें। सेवा के XMR भेजने के बाद वॉलेट सिंक होने और भुगतान की पुष्टि के साथ वह यहाँ दिखेगा।',
  ],
  'Accounts and identity checks': ['Cuentas y verificación de identidad', 'Konten und Identitätsprüfung', 'Comptes et vérification d’identité', 'Contas e verificação de identidade', 'Аккаунты и проверка личности', '账户与身份验证', 'アカウントと本人確認', '계정 및 신원 확인', 'Hesaplar ve kimlik kontrolleri', 'खाते और पहचान जाँच'],
  'ChangeNOW says basic swaps do not require an account. This is not a guarantee of no KYC: identity verification can be mandatory in some regions or triggered by risk checks. A swap may be put on hold while documents are requested. Other providers have their own policies.': [
    'ChangeNOW indica que los cambios básicos no requieren cuenta. No garantiza ausencia de KYC: la verificación puede ser obligatoria en algunas regiones o activarse por controles de riesgo. El cambio puede pausarse mientras se solicitan documentos. Otros proveedores tienen sus propias políticas.',
    'Laut ChangeNOW ist für einfache Tausche kein Konto nötig. Das garantiert keinen Tausch ohne KYC: Eine Identitätsprüfung kann regional vorgeschrieben oder durch Risikoprüfungen ausgelöst werden. Ein Tausch kann während einer Dokumentenanforderung angehalten werden. Andere Anbieter haben eigene Regeln.',
    'Selon ChangeNOW, les échanges simples ne nécessitent pas de compte. Cela ne garantit pas l’absence de KYC : une vérification peut être obligatoire dans certaines régions ou déclenchée par des contrôles de risque. Un échange peut être suspendu pendant une demande de documents. Les autres prestataires ont leurs propres règles.',
    'O ChangeNOW informa que trocas básicas não exigem conta. Isso não garante ausência de KYC: a verificação pode ser obrigatória em certas regiões ou acionada por análise de risco. A troca pode ser suspensa enquanto documentos são solicitados. Outros provedores têm suas próprias políticas.',
    'По данным ChangeNOW, для обычного обмена аккаунт не нужен. Это не гарантирует отсутствие KYC: проверка личности может быть обязательной в некоторых регионах или назначаться по результатам оценки риска. Обмен могут приостановить и запросить документы. У других сервисов свои правила.',
    'ChangeNOW 表示基本兑换无需账户，但这不保证免 KYC：某些地区可能强制要求身份验证，风险检查也可能触发验证。索取文件期间，兑换可能被暂停。其他服务商有各自的政策。',
    'ChangeNOWによると通常の交換にアカウントは不要ですが、KYC不要を保証するものではありません。地域によって本人確認が必須の場合や、リスク審査で求められる場合があります。書類の提出を求められ、交換が保留されることもあります。他のサービスには独自の規定があります。',
    'ChangeNOW는 기본 교환에 계정이 필요 없다고 안내합니다. KYC가 없다는 보장은 아닙니다. 일부 지역에서는 신원 확인이 필수이거나 위험 심사로 요구될 수 있습니다. 서류를 요청하는 동안 교환이 보류될 수 있습니다. 다른 업체는 각자의 정책을 적용합니다.',
    'ChangeNOW, temel takaslar için hesap gerekmediğini belirtir. Bu, KYC olmayacağı garantisi değildir: bazı bölgelerde kimlik doğrulama zorunlu olabilir veya risk kontrolleriyle istenebilir. Belgeler istenirken takas bekletilebilir. Diğer sağlayıcıların kendi politikaları vardır.',
    'ChangeNOW के अनुसार सामान्य स्वैप के लिए खाता आवश्यक नहीं है। इसका मतलब KYC न होने की गारंटी नहीं है: कुछ क्षेत्रों में पहचान सत्यापन अनिवार्य हो सकता है या जोखिम जाँच के कारण माँगा जा सकता है। दस्तावेज़ माँगे जाने पर स्वैप रोका जा सकता है। अन्य सेवाओं की अपनी नीतियाँ हैं।',
  ],
  'Read ChangeNOW’s verification policy': ['Lee la política de verificación de ChangeNOW', 'ChangeNOW-Verifizierungsrichtlinie lesen', 'Lire la politique de vérification de ChangeNOW', 'Leia a política de verificação do ChangeNOW', 'Политика проверки ChangeNOW', '阅读 ChangeNOW 验证政策', 'ChangeNOWの本人確認規定を読む', 'ChangeNOW 신원 확인 정책 읽기', 'ChangeNOW doğrulama politikasını okuyun', 'ChangeNOW की सत्यापन नीति पढ़ें'],
  'Verification may be required and a swap can be paused. Read the provider’s policy before sending.': [
    'Puede exigirse verificación y pausarse el cambio. Lee la política del proveedor antes de enviar.',
    'Eine Verifizierung kann nötig sein und den Tausch anhalten. Lies vor dem Senden die Regeln des Anbieters.',
    'Une vérification peut être requise et l’échange suspendu. Lisez les règles du prestataire avant d’envoyer.',
    'Pode ser exigida verificação e a troca pode ser suspensa. Leia a política do provedor antes de enviar.',
    'Может потребоваться проверка, а обмен могут приостановить. Прочитайте правила сервиса перед отправкой.',
    '可能需要验证，兑换也可能被暂停。发送前请阅读服务商政策。',
    '本人確認が求められ、交換が保留される場合があります。送金前にサービスの規定を確認してください。',
    '신원 확인이 필요하거나 교환이 보류될 수 있습니다. 보내기 전에 제공업체 정책을 읽으세요.',
    'Doğrulama gerekebilir ve takas durdurulabilir. Göndermeden önce sağlayıcının politikasını okuyun.',
    'सत्यापन आवश्यक हो सकता है और स्वैप रोका जा सकता है। भेजने से पहले सेवा की नीति पढ़ें।',
  ],
};
export function withExchangeHelp(language: string, original: Record<string, string>) {
  const index = languages.indexOf(language);
  if (index < 0) return original;
  for (const [key, values] of Object.entries(rows)) {
    if (values.length !== languages.length || !values[index]) throw new Error(`Incomplete exchange translation: ${key}`);
    original[key] = values[index];
  }
  return original;
}
