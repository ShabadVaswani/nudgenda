import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/constants/design';

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
};

const outlineOffsets = [
  [-2, -2],
  [0, -2],
  [2, -2],
  [-2, 0],
  [2, 0],
  [-2, 2],
  [0, 2],
  [2, 2],
] as const;

export function OutlinedTitle({ children, style }: Props) {
  const flattened = StyleSheet.flatten(style) ?? {};
  const containerStyle: ViewStyle = {
    alignSelf: flattened.alignSelf,
    flex: flattened.flex,
    marginBottom: flattened.marginBottom,
    marginLeft: flattened.marginLeft,
    marginRight: flattened.marginRight,
    marginTop: flattened.marginTop,
    maxWidth: flattened.maxWidth,
    width: flattened.width,
  };
  const textOverrides: TextStyle = {
    fontSize: flattened.fontSize,
    letterSpacing: flattened.letterSpacing,
    lineHeight: flattened.lineHeight,
    textAlign: flattened.textAlign,
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text
        accessible={false}
        style={[styles.title, textOverrides, styles.layer, styles.deepShadow]}>
        {children}
      </Text>
      <Text accessible={false} style={[styles.title, textOverrides, styles.layer, styles.accent]}>
        {children}
      </Text>
      {outlineOffsets.map(([x, y]) => (
        <Text
          accessible={false}
          key={`${x}:${y}`}
          style={[
            styles.title,
            textOverrides,
            styles.layer,
            styles.outline,
            { transform: [{ translateX: x }, { translateY: y }] },
          ]}>
          {children}
        </Text>
      ))}
      <Text accessibilityRole="header" style={[styles.title, textOverrides, styles.fill]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    overflow: 'visible',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 52,
    letterSpacing: -1.4,
    lineHeight: 56,
  },
  layer: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  deepShadow: {
    color: colors.ink,
    transform: [{ translateX: 5 }, { translateY: 6 }],
  },
  accent: {
    color: colors.lime,
    transform: [{ translateX: 3 }, { translateY: 4 }],
  },
  outline: {
    color: colors.ink,
  },
  fill: {
    color: colors.white,
  },
});
