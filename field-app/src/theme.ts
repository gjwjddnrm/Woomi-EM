// 현장용 전문 테마: 짙은 슬레이트 바탕 + 안전 앰버 강조. 햇빛 아래에서도 대비가 충분하도록 글자는 밝게.
export const C = {
  bg: '#0B0E13',
  surface: '#151A22',
  surface2: '#1D2430',
  surface3: '#263041',
  border: '#2E3949',
  borderStrong: '#3E4C61',
  text: '#F4F6F9',
  sub: '#A7B2C1',
  faint: '#6F7C8F',
  accent: '#FFB020', // 안전 앰버
  accentDark: '#3A2A08',
  red: '#FF453A',
  redDark: '#3A1210',
  green: '#30D158',
  greenDark: '#0F2E1A',
  blue: '#4C9AFF',
  blueDark: '#0F2340',
  black: '#000000',
  white: '#FFFFFF',
  // 예전 이름 호환
  card: '#151A22',
  cardBorder: '#2E3949',
  yellow: '#FFB020',
  orange: '#FF9500',
};

export const S = {
  pad: 16,
  radius: 16,
  radiusSm: 10,
  touch: 64,
  font: 18,
  fontBig: 22,
  fontHuge: 34,
};

export const T = {
  // 글자 체계
  display: { fontSize: 30, fontWeight: '900' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  body: { fontSize: 17, fontWeight: '500' as const },
  label: { fontSize: 13, fontWeight: '800' as const, letterSpacing: 1.2 },
  num: { fontVariant: ['tabular-nums' as const] },
};
