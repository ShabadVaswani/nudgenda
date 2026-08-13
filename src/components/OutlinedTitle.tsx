import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, fonts } from '@/constants/design';

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  variant?: 'default' | 'brand';
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

function pickDefined<T extends object>(source: object, keys: readonly (keyof T)[]) {
  const target = {} as T;
  const values = source as T;
  keys.forEach((key) => {
    if (values[key] !== undefined) target[key] = values[key];
  });
  return target;
}

export function OutlinedTitle({ children, style, variant = 'default' }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const brandFontSize = Math.min(58, Math.max(50, windowWidth * 0.14));
  const variantStyle: TextStyle | undefined =
    variant === 'brand'
      ? {
          fontSize: brandFontSize,
          letterSpacing: brandFontSize * -0.027,
          lineHeight: Math.ceil(brandFontSize * 1.08),
        }
      : undefined;
  const flattened = StyleSheet.flatten([variantStyle, style]) ?? {};
  // Undefined values can override the base metrics on native. Only forward values
  // that callers actually supplied so Android keeps the intended display size.
  const containerStyle = pickDefined<ViewStyle>(flattened, [
    'alignSelf',
    'flex',
    'marginBottom',
    'marginLeft',
    'marginRight',
    'marginTop',
    'maxWidth',
    'width',
  ]);
  const textOverrides = pickDefined<TextStyle>(flattened, [
    'fontSize',
    'letterSpacing',
    'lineHeight',
    'textAlign',
  ]);

  const textProps =
    variant === 'brand'
      ? ({ allowFontScaling: false } as const)
      : ({ maxFontSizeMultiplier: 1.2 } as const);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text
        {...textProps}
        accessible={false}
        style={[styles.title, textOverrides, styles.layer, styles.deepShadow]}>
        {children}
      </Text>
      <Text
        {...textProps}
        accessible={false}
        style={[styles.title, textOverrides, styles.layer, styles.accent]}>
        {children}
      </Text>
      {outlineOffsets.map(([x, y]) => (
        <Text
          {...textProps}
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
      <Text
        {...textProps}
        accessibilityRole="header"
        style={[styles.title, textOverrides, styles.fill]}>
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
