import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';

export interface StarRatingProps {
  /** `null`/`undefined` = pas de note. Valeur attendue par pas de 0,5 entre 0,5 et 5. */
  value: number | null | undefined;
  /** Omis ou `readOnly` : affichage seul (ex. détail d'un item). */
  onChange?: (value: number | null) => void;
  readOnly?: boolean;
  size?: number;
  accessibilityLabel?: string;
}

const STAR_COUNT = 5;
/** Zone tactile 44×44 par étoile (docs/NOTRE_NID_PRD.md section 4.6), scindée en deux
 * moitiés pour permettre les demi-étoiles au tir. */
const CELL_SIZE = 44;

export function formatRatingLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

/** Note sur 5 étoiles avec demi-points, tactile ou lecture seule (docs/NOTRE_NID_PRD.md section 7). */
export function StarRating({
  value,
  onChange,
  readOnly = false,
  size,
  accessibilityLabel,
}: StarRatingProps) {
  const theme = useTheme();
  const iconSize = size ?? theme.iconSizes.xl;
  const editable = !readOnly && Boolean(onChange);
  const summary = value ? `Note : ${formatRatingLabel(value)} sur 5` : 'Pas de note';

  const handlePress = (tapped: number) => {
    onChange?.(value === tapped ? null : tapped);
  };

  const stars = Array.from({ length: STAR_COUNT }, (_, index) => {
    const starCeiling = index + 1;
    const filled = (value ?? 0) >= starCeiling;
    const halfFilled = !filled && (value ?? 0) >= starCeiling - 0.5;
    const iconName = filled ? 'star' : halfFilled ? 'star-half' : 'star-outline';
    const halfValue = starCeiling - 0.5;
    const fullValue = starCeiling;

    return (
      <View key={index} style={styles.cell}>
        <Ionicons name={iconName} size={iconSize} color={theme.colors.accent} />
        {editable ? (
          <View style={styles.touchOverlay} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${formatRatingLabel(halfValue)} sur 5`}
              style={styles.halfCell}
              onPress={() => handlePress(halfValue)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${formatRatingLabel(fullValue)} sur 5`}
              style={styles.halfCell}
              onPress={() => handlePress(fullValue)}
            />
          </View>
        ) : null}
      </View>
    );
  });

  if (editable) {
    return <View style={styles.row}>{stars}</View>;
  }

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? summary}
    >
      {stars}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  halfCell: {
    flex: 1,
  },
});
