import React from 'react';
import { Text, View } from 'react-native';
import config from '@/config/activation-reporting.json';
import { useLanguage } from '@/context/LanguageContext';
import { F } from './ui';

export function ActivationDisclosure() {
  const { t } = useLanguage();
  return (
    <View testID="activation-disclosure" style={{ gap: 6, paddingHorizontal: 4 }}>
      <Text style={{ fontFamily: F.r, fontSize: 13, lineHeight: 19, color: '#B0B0B6' }}>
        {t('Android stores wallet names encrypted on this device.')}
      </Text>
      <Text style={{ fontFamily: F.r, fontSize: 13, lineHeight: 19, color: '#B0B0B6' }}>
        {config.enabled
          ? t('Continuing enables a one-time report after this wallet receives its first confirmed payment. Your encrypted wallet name is sent to the app operator, who can decrypt it. Your recovery phrase, address and payment amount are not sent. Reporting is paused while Tor is enabled.')
          : t('Activation reporting is not configured. No wallet-name reports are sent.')}
      </Text>
    </View>
  );
}
