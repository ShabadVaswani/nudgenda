import { Pressable, StyleSheet, View } from 'react-native';

import { colors, neoShadow, radii } from '@/constants/design';

type Props = {
  active?: boolean;
  compact?: boolean;
  onPress: () => void;
};

export function MicButton({ active = false, compact = false, onPress }: Props) {
  const size = compact ? 54 : 88;

  return (
    <View style={styles.shell}>
      {active && <View style={[styles.pulse, { width: size + 16, height: size + 16 }]} />}
      <Pressable
        accessibilityLabel={active ? 'Stop listening' : 'Start listening'}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          neoShadow,
          { width: size, height: size },
          active && styles.active,
          pressed && styles.pressed,
        ]}>
        <View style={[styles.micCapsule, compact && styles.compactCapsule]} />
        <View style={[styles.micArc, compact && styles.compactArc]} />
        <View style={[styles.micStem, compact && styles.compactStem]} />
        <View style={[styles.micBase, compact && styles.compactBase]} />
      </Pressable>
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
    alignItems: 'center',
    backgroundColor: colors.pink,
    borderColor: colors.ink,
    borderRadius: radii.round,
    borderWidth: 3,
    justifyContent: 'center',
  },
  active: {
    backgroundColor: colors.yellow,
  },
  pressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  micCapsule: {
    borderColor: colors.ink,
    borderRadius: 12,
    borderWidth: 3,
    height: 34,
    position: 'absolute',
    top: 18,
    width: 20,
  },
  compactCapsule: {
    borderRadius: 8,
    borderWidth: 2.5,
    height: 22,
    top: 10,
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
    top: 35,
    width: 32,
  },
  compactArc: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    height: 17,
    top: 21,
    width: 23,
  },
  micStem: {
    backgroundColor: colors.ink,
    borderRadius: 2,
    bottom: 21,
    height: 18,
    position: 'absolute',
    width: 3,
  },
  compactStem: {
    bottom: 10,
    height: 8,
    width: 2,
  },
  micBase: {
    backgroundColor: colors.ink,
    borderRadius: 2,
    bottom: 18,
    height: 3,
    position: 'absolute',
    width: 24,
  },
  compactBase: {
    bottom: 8,
    height: 2.5,
    width: 17,
  },
});
