import { Ionicons } from '@expo/vector-icons';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useTheme, type ColorToken } from '../theme';

import { AppText } from './AppText';

export interface RowGroupProps {
  children: ReactNode;
  /** Petit intitulé discret au-dessus du groupe (jamais un gros titre). */
  title?: string;
  /** `subtle` : fond transparent, pour les actions secondaires moins mises en avant. */
  tone?: 'default' | 'subtle';
}

/**
 * Surface ivoire légèrement délimitée regroupant des lignes, séparées par un
 * filet fin — une liste, pas une mosaïque de cartes. Les enfants `null`
 * (lignes conditionnelles) sont ignorés : jamais de séparateur orphelin.
 */
export function RowGroup({ children, title, tone = 'default' }: RowGroupProps) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {title ? (
        <AppText
          variant="label"
          color="textMuted"
          accessibilityRole="header"
          style={{ paddingHorizontal: theme.spacing.xs }}
        >
          {title}
        </AppText>
      ) : null}
      <View
        style={{
          borderRadius: theme.radii.lg,
          backgroundColor: tone === 'default' ? theme.colors.surface : 'transparent',
          borderWidth: 1,
          borderColor: theme.colors.border,
          paddingHorizontal: theme.spacing.md,
          overflow: 'hidden',
        }}
      >
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? (
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

export interface NavigationRowProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Précision secondaire sous le libellé. */
  description?: string;
  /** `danger` : action destructrice (texte et icône `danger`, jamais d'aplat rouge). */
  tone?: 'default' | 'danger' | 'muted';
  /** Chevron = navigation vers un autre écran ; absent pour une action immédiate. */
  showChevron?: boolean;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const TONE_COLORS: Record<NonNullable<NavigationRowProps['tone']>, ColorToken> = {
  default: 'text',
  danger: 'danger',
  muted: 'textMuted',
};

/** Ligne sobre : icône, libellé, chevron — zone tactile ≥ 52 pt sur toute la largeur. */
export function NavigationRow({
  label,
  onPress,
  icon,
  description,
  tone = 'default',
  showChevron = true,
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: NavigationRowProps) {
  const theme = useTheme();
  const textColor = TONE_COLORS[tone];
  const iconColor = tone === 'default' ? theme.colors.primary : theme.colors[textColor];
  const isInteractive = !disabled && !loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      disabled={!isInteractive}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: 52,
        paddingVertical: theme.spacing.sm,
        opacity: disabled ? 0.5 : pressed ? 0.6 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={theme.iconSizes.md} color={iconColor} /> : null}
      <View style={{ flex: 1 }}>
        <AppText variant="body" color={textColor}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" color="textMuted">
            {description}
          </AppText>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : showChevron ? (
        <Ionicons
          name="chevron-forward"
          size={theme.iconSizes.sm}
          color={theme.colors.textMuted}
          accessible={false}
          importantForAccessibility="no"
        />
      ) : null}
    </Pressable>
  );
}
