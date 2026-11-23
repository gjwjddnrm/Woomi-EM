import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { C, S, T } from '../theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon(props: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={props.name} size={props.size ?? 22} color={props.color ?? C.text} />;
}

type BtnKind = 'primary' | 'danger' | 'dark' | 'ghost';

export function BigButton(props: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
  sub?: string;
}) {
  const kind = props.kind ?? 'primary';
  const bg = kind === 'primary' ? C.accent : kind === 'danger' ? C.red : kind === 'dark' ? C.surface2 : 'transparent';
  const fg = kind === 'primary' ? '#1A1200' : C.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled || props.busy}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: props.disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        kind === 'dark' || kind === 'ghost' ? { borderWidth: 1, borderColor: C.borderStrong } : null,
        props.style,
      ]}
    >
      {props.busy ? (
        <ActivityIndicator color={fg} size="large" />
      ) : (
        <View style={styles.btnRow}>
          {props.icon ? <Icon name={props.icon} size={props.sub ? 30 : 24} color={fg} /> : null}
          <View style={{ alignItems: props.icon ? 'flex-start' : 'center', flexShrink: 1 }}>
            <Text style={[styles.btnText, { color: fg }]}>{props.title}</Text>
            {props.sub ? <Text style={[styles.btnSub, { color: fg }]}>{props.sub}</Text> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton(props: { icon: IconName; onPress: () => void; label?: string; color?: string }) {
  return (
    <Pressable
      onPress={props.onPress}
      hitSlop={8}
      accessibilityLabel={props.label}
      style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: C.surface3 }]}
    >
      <Icon name={props.icon} size={24} color={props.color ?? C.text} />
      {props.label ? <Text style={[styles.iconBtnText, props.color ? { color: props.color } : null]}>{props.label}</Text> : null}
    </Pressable>
  );
}

export function Banner(props: {
  text: string;
  kind?: 'warn' | 'error' | 'info' | 'ok';
  action?: string;
  onAction?: () => void;
}) {
  const kind = props.kind ?? 'warn';
  const tone = {
    warn: { bg: C.accentDark, fg: C.accent, icon: 'alert' as IconName },
    error: { bg: C.redDark, fg: '#FF8A82', icon: 'alert-octagon' as IconName },
    info: { bg: C.blueDark, fg: '#9CC5FF', icon: 'information' as IconName },
    ok: { bg: C.greenDark, fg: '#7BE59A', icon: 'check-circle' as IconName },
  }[kind];
  return (
    <View style={[styles.banner, { backgroundColor: tone.bg, borderColor: tone.fg }]}>
      <Icon name={tone.icon} size={22} color={tone.fg} />
      <Text style={[styles.bannerText, { color: C.text }]}>{props.text}</Text>
      {props.action && props.onAction ? (
        <Pressable onPress={props.onAction} style={[styles.bannerBtn, { backgroundColor: tone.fg }]}>
          <Text style={styles.bannerBtnText}>{props.action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Header(props: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      {props.onBack ? (
        <Pressable onPress={props.onBack} style={styles.headerBack} hitSlop={12} accessibilityLabel="뒤로">
          <Icon name="chevron-left" size={32} color={C.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text style={styles.headerSub} numberOfLines={1}>
            {props.subtitle}
          </Text>
        ) : null}
      </View>
      {props.right}
    </View>
  );
}

export function Card(props: { children: ReactNode; style?: ViewStyle; accent?: string }) {
  return (
    <View style={[styles.card, props.accent ? { borderLeftWidth: 4, borderLeftColor: props.accent } : null, props.style]}>
      {props.children}
    </View>
  );
}

export function SectionLabel(props: { text: string; right?: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.sectionRow, props.style]}>
      <Text style={styles.sectionLabel}>{props.text}</Text>
      {props.right}
    </View>
  );
}

export function Pill(props: { text: string; color?: string; bg?: string; icon?: IconName }) {
  const color = props.color ?? C.sub;
  return (
    <View style={[styles.pill, { backgroundColor: props.bg ?? C.surface3 }]}>
      {props.icon ? <Icon name={props.icon} size={14} color={color} /> : null}
      <Text style={[styles.pillText, { color }]}>{props.text}</Text>
    </View>
  );
}

export function Stat(props: { icon: IconName; label: string; value: string; tone?: 'ok' | 'warn' | 'bad'; onPress?: () => void }) {
  const color = props.tone === 'bad' ? C.red : props.tone === 'warn' ? C.accent : props.tone === 'ok' ? C.green : C.text;
  return (
    <Pressable style={styles.stat} onPress={props.onPress} disabled={!props.onPress}>
      <Icon name={props.icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>
        {props.value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export const ui = StyleSheet.create({
  input: {
    backgroundColor: C.surface2,
    color: C.text,
    fontSize: 21,
    fontWeight: '700',
    borderRadius: S.radiusSm,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 16 },
  modal: { backgroundColor: C.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border },
  modalTitle: { color: C.text, fontSize: 21, fontWeight: '800', marginBottom: 14 },
});

const styles = StyleSheet.create({
  btn: {
    minHeight: S.touch,
    borderRadius: S.radiusSm + 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btnText: { fontSize: 20, fontWeight: '800', letterSpacing: -0.2 },
  btnSub: { fontSize: 14, fontWeight: '600', marginTop: 2, opacity: 0.85 },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    minHeight: 44,
  },
  iconBtnText: { color: C.text, fontSize: 16, fontWeight: '700' },
  banner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerText: { flex: 1, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  bannerBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  bannerBtnText: { color: '#111', fontSize: 15, fontWeight: '900' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 62,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 6,
  },
  headerBack: { padding: 4 },
  headerTitle: { color: C.text, ...T.title },
  headerSub: { color: C.sub, fontSize: 14, fontWeight: '600', marginTop: 1 },
  card: {
    backgroundColor: C.surface,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { color: C.faint, ...T.label },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 13, fontWeight: '800' },
  stat: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
  },
  statValue: { fontSize: 19, fontWeight: '900', ...T.num },
  statLabel: { color: C.sub, fontSize: 13, fontWeight: '700' },
});
