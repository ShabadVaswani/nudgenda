import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, neoShadow, radii } from '@/constants/design';

type Props = PropsWithChildren<{
  backgroundColor?: string;
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function NeoCard({ children, backgroundColor = colors.white, shadow = true, style }: Props) {
  return (
    <View style={[styles.card, shadow && neoShadow, { backgroundColor }, style]}>
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
