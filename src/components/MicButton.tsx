import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { colors, neoShadow, radii } from '@/constants/design';

type Props = {
  active?: boolean;
  compact?: boolean;
  onPress: () => void;
};

export function MicButton({ active = false, compact = false, onPress }: Props) {
  const size = compact ? 54 : 88;
  const [recorderAnimation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) {
      recorderAnimation.stopAnimation();
      recorderAnimation.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(recorderAnimation, {
          duration: 720,
          toValue: 1,
          useNativeDriver: false,
        }),
        Animated.timing(recorderAnimation, {
          duration: 720,
          toValue: 0,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, recorderAnimation]);

  const recordingColor = recorderAnimation.interpolate({
    inputRange: [0, 0.35, 0.7, 1],
    outputRange: [colors.pink, colors.yellow, colors.aqua, colors.periwinkle],
  });
  const pulseScale = recorderAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.12],
  });

  return (
    <View style={styles.shell}>
      {active && (
        <Animated.View
          style={[
            styles.pulse,
            {
              height: size + 16,
              opacity: recorderAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.75, 0.2],
              }),
              transform: [{ scale: pulseScale }],
              width: size + 16,
            },
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.button,
          neoShadow,
          { backgroundColor: active ? recordingColor : colors.pink, height: size, width: size },
        ]}>
        <Pressable
          accessibilityLabel={active ? 'Stop listening' : 'Start listening'}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.pressTarget, pressed && styles.pressed]}>
          <View style={[styles.micCapsule, compact && styles.compactCapsule]} />
          <View style={[styles.micArc, compact && styles.compactArc]} />
          <View style={[styles.micStem, compact && styles.compactStem]} />
          <View style={[styles.micBase, compact && styles.compactBase]} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    borderColor: colors.ink,
    borderRadius: radii.round,
    borderStyle: 'dashed',
    borderWidth: 2,
    position: 'absolute',
  },
  button: {
    borderColor: colors.ink,
    borderRadius: radii.round,
    borderWidth: 3,
    overflow: 'hidden',
  },
  pressTarget: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  micCapsule: {
    borderColor: colors.ink,
    borderRadius: 12,
    borderWidth: 3,
    height: 34,
    position: 'absolute',
    top: 15,
    width: 20,
  },
  compactCapsule: {
    borderRadius: 8,
    borderWidth: 2.5,
    height: 22,
    top: 7,
    width: 14,
  },
  micArc: {
    borderBottomColor: colors.ink,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    borderBottomWidth: 3,
    borderLeftColor: colors.ink,
    borderLeftWidth: 3,
    borderRightColor: colors.ink,
    borderRightWidth: 3,
    height: 25,
    position: 'absolute',
    top: 32,
    width: 32,
  },
  compactArc: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    height: 17,
    top: 18,
    width: 23,
  },
  micStem: {
    backgroundColor: colors.ink,
    borderRadius: 2,
    bottom: 18,
    height: 18,
    position: 'absolute',
    width: 3,
  },
  compactStem: {
    bottom: 7,
    height: 8,
    width: 2,
  },
  micBase: {
    backgroundColor: colors.ink,
    borderRadius: 2,
    bottom: 15,
    height: 3,
    position: 'absolute',
    width: 24,
  },
  compactBase: {
    bottom: 5,
    height: 2.5,
    width: 17,
  },
});
