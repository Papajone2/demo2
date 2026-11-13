import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { accent, LanguageButton } from '@/components/language-picker';
import { OnboardSlide } from '@/components/onboard-slide';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

/** Shared intro slides used by first run and by "Create wallet" from Accounts. */
export function useAndroidBack(handler: (() => void) | undefined) {
  const ref = useRef(handler);
  ref.current = handler;
  const on = !!handler;
  useEffect(() => {
    if (!on || Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { ref.current?.(); return true; });
    return () => sub.remove();
  }, [on]);
}

export function Onboarding({ start = 0, onDone, onExit, showLanguage }: { start?: number; onDone: () => void; onExit?: () => void; showLanguage?: boolean }) {
  const c = useColors();
  const { t } = useLanguage();
  const [i, setI] = useState(start);
  useAndroidBack(i > 0 ? () => setI((n) => Math.max(0, n - 1)) : onExit);
  if (i === 0)
    return <OnboardSlide testID="onboard-slide-1" active={0} onDot={setI} onNext={() => setI(1)} topRight={showLanguage ? <LanguageButton /> : undefined}
      title={accent(t('Welcome to\n[Monero] Wallet'), c.primary)} body={t('A simple and secure wallet\nfor Monero.')} />;
  if (i === 1)
    return <OnboardSlide testID="onboard-slide-2" active={1} onDot={setI} onNext={() => setI(2)} topRight={showLanguage ? <LanguageButton /> : undefined}
      title={accent(t('Your keys.\nYour [Monero.]'), c.primary)} body={t('Your wallet is protected by a\nprivate recovery phrase. Keep it\nsafe and never share it.')} />;
  return <OnboardSlide testID="onboard-slide-3" active={2} onDot={setI} onNext={onDone} topRight={showLanguage ? <LanguageButton /> : undefined}
    title={accent(t('A quick sync,\n[then you’re in.]'), c.primary)} body={t('Your wallet needs to sync with\nthe Monero network to show your\nlatest balance and transactions.')} />;
}
