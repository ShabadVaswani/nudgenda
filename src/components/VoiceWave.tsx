import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/design';

const barColors = [
  colors.pink,
  colors.yellow,
  colors.aqua,
  colors.periwinkle,
  colors.lime,
  colors.yellow,
  colors.pink,
];

export function VoiceWave({ level }: { level?: number }) {
  const [values] = useState(() => barColors.map(() => new Animated.Value(0)));
  const strength = level === undefined ? 1 : Math.max(0.08, Math.min(1, (level + 2) / 12));
  const loops = useMemo(
    () =>
      values.map((value, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 65),
            Animated.timing(value, {
              duration: 300 + (index % 3) * 90,
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.timing(value, {
              duration: 280 + ((index + 1) % 3) * 80,
              toValue: 0,
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
    [values],
  );

  useEffect(() => {
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [loops]);

  return (
    <View accessibilityLabel="Listening" style={styles.wave}>
      {values.map((value, index) => (
        <Animated.View
          key={`${barColors[index]}-${index}`}
          style={[
            styles.bar,
            {
              backgroundColor: barColors[index],
              transform: [
                {
                  scaleY: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.28, 0.4 + strength * (0.5 + (index % 3) * 0.08)],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wave: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    height: 42,
    justifyContent: 'center',
  },
  bar: {
    borderColor: colors.ink,
    borderRadius: 5,
    borderWidth: 1.5,
    height: 34,
    width: 7,
  },
});
