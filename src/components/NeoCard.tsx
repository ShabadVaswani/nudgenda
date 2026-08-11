import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, neoShadow, radii } from '@/constants/design';

type Props = PropsWithChildren<{
  backgroundColor?: string;
  style?: ViewStyle;
}>;

export function NeoCard({ children, backgroundColor = colors.white, style }: Props) {
  return (
    <View style={[styles.card, neoShadow, { backgroundColor }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.ink,
    borderRadius: radii.md,
    borderWidth: 2.5,
  },
});
