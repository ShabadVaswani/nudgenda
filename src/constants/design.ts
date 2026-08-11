import { Platform } from 'react-native';

export const colors = {
  ink: '#171713',
  paper: '#F6F0E3',
  pinkPaper: '#EDB8BD',
  aquaPaper: '#CDE8E4',
  lime: '#CDE54A',
  pink: '#EE7998',
  aqua: '#A9DDD7',
  yellow: '#F3CA4A',
  periwinkle: '#95A8E8',
  white: '#FFFDF7',
  muted: '#6D6A60',
} as const;

export const fonts = {
  display: 'ArchivoBlack_400Regular',
  hand: 'Kalam_400Regular',
  handBold: 'Kalam_700Bold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  round: 999,
} as const;

export const neoShadow = Platform.select({
  ios: {
    shadowColor: colors.ink,
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  android: { elevation: 5 },
  default: {
    boxShadow: `4px 5px 0 ${colors.ink}`,
  },
});
