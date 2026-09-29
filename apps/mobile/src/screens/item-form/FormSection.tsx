import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '../../components';
import { useTheme } from '../../theme';

export interface FormSectionProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: ReactNode;
}

/**
 * Sous-section légère des étapes du formulaire : petit repère terracotta + titre
 * vert forêt, champs resserrés dessous — structure sans ajouter de carte autour.
 */
export function FormSection({ icon, title, children }: FormSectionProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        <Ionicons
          name={icon}
          size={theme.iconSizes.sm}
          color={theme.colors.secondary}
          accessible={false}
          importantForAccessibility="no"
        />
        <AppText variant="label" color="primary" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}
