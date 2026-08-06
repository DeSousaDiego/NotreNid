import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';

import { TextField, type TextFieldProps } from './TextField';

export type PasswordFieldProps = Omit<TextFieldProps, 'secureTextEntry'>;

/** TextField spécialisé mot de passe : bascule masquer/afficher. */
export function PasswordField(props: PasswordFieldProps) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <TextField
        {...props}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        style={[{ paddingRight: 44 }, props.style]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        style={{
          position: 'absolute',
          right: 4,
          top: 28,
          width: 40,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={theme.iconSizes.md}
          color={theme.colors.textMuted}
        />
      </Pressable>
    </View>
  );
}
