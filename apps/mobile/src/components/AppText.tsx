import { Text, type TextProps } from 'react-native';

import type { ColorToken, TypographyToken } from '../theme';
import { useTheme } from '../theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyToken;
  color?: ColorToken;
}

/** Primitive de texte : centralise police/taille/couleur, jamais de style de texte en dur ailleurs. */
export function AppText({ variant = 'body', color = 'text', style, ...props }: AppTextProps) {
  const theme = useTheme();
  const variantTokens = theme.typography[variant];

  return (
    <Text
      style={[
        {
          fontFamily: theme.fonts[variantTokens.fontFamilyKey],
          fontSize: variantTokens.fontSize,
          lineHeight: variantTokens.lineHeight,
          color: theme.colors[color],
        },
        style,
      ]}
      {...props}
    />
  );
}
