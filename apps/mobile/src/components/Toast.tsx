import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet } from 'react-native';

import { useTheme } from '../theme';

import { AppText } from './AppText';

export type ToastVariant = 'info' | 'success' | 'error';

interface ToastState {
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_HIDE_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      setToast({ message, variant });
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      hideTimeout.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
          setToast(null),
        );
      }, AUTO_HIDE_MS);
    },
    [opacity],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  const backgroundColor =
    toast?.variant === 'error'
      ? theme.colors.danger
      : toast?.variant === 'success'
        ? theme.colors.primary
        : theme.colors.text;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          style={[
            styles.container,
            {
              opacity,
              backgroundColor,
              borderRadius: theme.radii.md,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              bottom: theme.spacing.xxl,
            },
          ]}
        >
          <AppText variant="label" color="onPrimary">
            {toast.message}
          </AppText>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé à l’intérieur de <ToastProvider>.');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
});
