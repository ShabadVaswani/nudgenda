import { Platform, StyleSheet, Text, type TextStyle } from 'react-native';

import { colors, fonts } from '@/constants/design';

type Props = {
  children: string;
  style?: TextStyle;
};

export function OutlinedTitle({ children, style }: Props) {
  return (
    <Text style={[styles.title, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

const titleShadow = Platform.select({
  web: { textShadow: `2px 2px 0 ${colors.ink}` } as TextStyle,
  default: {
    textShadowColor: colors.ink,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
});

const styles = StyleSheet.create({
  title: {
    ...titleShadow,
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 54,
    letterSpacing: -2.5,
    lineHeight: 57,
  },
});
