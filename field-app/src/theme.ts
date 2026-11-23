// 업무용 밝은 테마 (Woomi-EM 웹과 같은 계열: 흰 카드 + 파랑 강조 + Pretendard)
// 햇빛 아래에서는 밝은 바탕에 진한 글자가 가장 잘 보입니다. 촬영 화면만 어둡게 씁니다.
export const C = {
  bg: '#F2F4F7',
  surface: '#FFFFFF',
  surface2: '#F7F8FA',
  surface3: '#EEF1F5',
  border: '#E3E7ED',
  borderStrong: '#C9D0DA',
  text: '#101828',
  sub: '#475467',
  faint: '#8A94A6',
  primary: '#2453C7',
  primaryDark: '#163A94',
  primarySoft: '#EAF0FD',
  navy: '#0F1D3A',
  navy2: '#1B2B4F',
  red: '#D92D20',
  redSoft: '#FEE4E2',
  green: '#067647',
  greenSoft: '#DCFAE6',
  warn: '#B54708',
  warnSoft: '#FEF0C7',
  white: '#FFFFFF',
  black: '#000000',
  // 촬영 화면(어두운 카메라 UI)
  camBg: '#0A0D12',
  camPanel: '#11161F',
  camLine: '#273041',
  camText: '#F4F6F9',
  camSub: '#A9B3C3',
  amber: '#FFB020',
};

export const F = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
  xbold: 'Pretendard-ExtraBold',
};

export const S = {
  pad: 16,
  radius: 14,
  radiusSm: 10,
  touch: 60,
};

export const T = {
  num: { fontVariant: ['tabular-nums' as const] },
  h1: { fontFamily: F.xbold, fontSize: 26, letterSpacing: -0.6, color: C.text },
  h2: { fontFamily: F.bold, fontSize: 20, letterSpacing: -0.4, color: C.text },
  h3: { fontFamily: F.bold, fontSize: 17, letterSpacing: -0.2, color: C.text },
  body: { fontFamily: F.medium, fontSize: 16, color: C.text, lineHeight: 23 },
  sub: { fontFamily: F.medium, fontSize: 14, color: C.sub, lineHeight: 20 },
  label: { fontFamily: F.bold, fontSize: 12.5, letterSpacing: 0.6, color: C.faint },
};

export const shadow = {
  shadowColor: '#101828',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
