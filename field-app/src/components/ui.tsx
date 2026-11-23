import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { C, S } from '../theme';

type BtnKind = 'primary' | 'danger' | 'dark' | 'ghost';

export function BigButton(props: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
  sub?: string;
}) {
  const kind = props.kind ?? 'primary';
  const bg = kind === 'primary' ? C.yellow : kind === 'danger' ? C.red : kind === 'dark' ? C.card : 'transparent';
  const fg = kind === 'primary' ? C.black : C.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled || props.busy}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: props.disabled ? 0.4 : pressed ? 0.7 : 1 },
        kind === 'ghost' || kind === 'dark' ? { borderWidth: 2, borderColor: C.cardBorder } : null,
        props.style,
      ]}
    >
      {props.busy ? (
        <ActivityIndicator color={fg} size="large" />
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.btnText, { color: fg }]}>{props.title}</Text>
          {props.sub ? <Text style={[styles.btnSub, { color: fg }]}>{props.sub}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

export function Banner(props: { text: string; kind?: 'warn' | 'error' | 'info'; action?: string; onAction?: () => void }) {
  const kind = props.kind ?? 'warn';
  const bg = kind === 'error' ? C.red : kind === 'warn' ? C.yellow : C.blue;
  const fg = kind === 'warn' ? C.black : C.text;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={[styles.bannerText, { color: fg }]}>{props.text}</Text>
      {props.action && props.onAction ? (
        <Pressable onPress={props.onAction} style={[styles.bannerBtn, { borderColor: fg }]}>
          <Text style={[styles.bannerBtnText, { color: fg }]}>{props.action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Header(props: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      {props.onBack ? (
        <Pressable onPress={props.onBack} style={styles.headerBack} hitSlop={12}>
          <Text style={styles.headerBackText}>‹ 뒤로</Text>
        </Pressable>
      ) : null}
      <Text style={styles.headerTitle} numberOfLines={1}>
        {props.title}
      </Text>
      {props.right}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: S.touch,
    borderRadius: S.radius,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  btnText: { fontSize: S.fontBig, fontWeight: '800' },
  btnSub: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  banner: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerText: { flex: 1, fontSize: 18, fontWeight: '800' },
  bannerBtn: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  bannerBtnText: { fontSize: 17, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.pad,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
    gap: 12,
  },
  headerBack: { paddingVertical: 6, paddingRight: 8 },
  headerBackText: { color: C.yellow, fontSize: 22, fontWeight: '800' },
  headerTitle: { flex: 1, color: C.text, fontSize: 24, fontWeight: '900' },
});
