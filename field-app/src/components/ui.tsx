import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { C, F, S, T, shadow } from '../theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon(props: { name: IconName; size?: number; color?: string; style?: TextStyle }) {
  return <MaterialCommunityIcons name={props.name} size={props.size ?? 22} color={props.color ?? C.text} style={props.style} />;
}

type BtnKind = 'primary' | 'danger' | 'secondary' | 'ghost' | 'dark';

export function BigButton(props: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
  sub?: string;
  size?: 'md' | 'lg';
}) {
  const kind = props.kind === 'dark' ? 'secondary' : (props.kind ?? 'primary');
  const pal = {
    primary: { bg: C.primary, fg: C.white, border: C.primary },
    danger: { bg: C.red, fg: C.white, border: C.red },
    secondary: { bg: C.surface, fg: C.text, border: C.borderStrong },
    ghost: { bg: 'transparent', fg: C.primary, border: 'transparent' },
  }[kind];
  const lg = props.size === 'lg' || !!props.sub;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled || props.busy}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.btn,
        lg && styles.btnLg,
        { backgroundColor: pal.bg, borderColor: pal.border, opacity: props.disabled ? 0.45 : pressed ? 0.85 : 1 },
        props.style,
      ]}
    >
      {props.busy ? (
        <ActivityIndicator color={pal.fg} />
      ) : (
        <View style={styles.btnRow}>
          {props.icon ? <Icon name={props.icon} size={lg ? 26 : 21} color={pal.fg} /> : null}
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.btnText, lg && styles.btnTextLg, { color: pal.fg }]}>{props.title}</Text>
            {props.sub ? <Text style={[styles.btnSub, { color: pal.fg }]}>{props.sub}</Text> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton(props: { icon: IconName; onPress: () => void; label?: string; color?: string; dark?: boolean }) {
  const color = props.color ?? (props.dark ? C.white : C.text);
  return (
    <Pressable
      onPress={props.onPress}
      hitSlop={8}
      accessibilityLabel={props.label}
      style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: props.dark ? 'rgba(255,255,255,0.12)' : C.surface3 }]}
    >
      <Icon name={props.icon} size={24} color={color} />
      {props.label ? <Text style={[styles.iconBtnText, { color }]}>{props.label}</Text> : null}
    </Pressable>
  );
}

export function Banner(props: { text: string; kind?: 'warn' | 'error' | 'info' | 'ok'; action?: string; onAction?: () => void }) {
  const kind = props.kind ?? 'warn';
  const tone = {
    warn: { bg: C.warnSoft, fg: C.warn, icon: 'alert-outline' as IconName },
    error: { bg: C.redSoft, fg: C.red, icon: 'alert-octagon-outline' as IconName },
    info: { bg: C.primarySoft, fg: C.primary, icon: 'information-outline' as IconName },
    ok: { bg: C.greenSoft, fg: C.green, icon: 'check-circle-outline' as IconName },
  }[kind];
  return (
    <View style={[styles.banner, { backgroundColor: tone.bg }]}>
      <Icon name={tone.icon} size={20} color={tone.fg} />
      <Text style={[styles.bannerText, { color: tone.fg }]}>{props.text}</Text>
      {props.action && props.onAction ? (
        <Pressable onPress={props.onAction} style={[styles.bannerBtn, { borderColor: tone.fg }]}>
          <Text style={[styles.bannerBtnText, { color: tone.fg }]}>{props.action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 남색 상단 바 */
export function Header(props: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      {props.onBack ? (
        <Pressable onPress={props.onBack} style={styles.headerBack} hitSlop={12} accessibilityLabel="뒤로">
          <Icon name="arrow-left" size={26} color={C.white} />
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

export function Card(props: { children: ReactNode; style?: ViewStyle; accent?: string; padded?: boolean }) {
  return (
    <View
      style={[
        styles.card,
        props.padded === false && { padding: 0 },
        props.accent ? { borderLeftWidth: 4, borderLeftColor: props.accent } : null,
        props.style,
      ]}
    >
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
  const color = props.tone === 'bad' ? C.red : props.tone === 'warn' ? C.warn : props.tone === 'ok' ? C.green : C.text;
  const iconBg = props.tone === 'bad' ? C.redSoft : props.tone === 'warn' ? C.warnSoft : props.tone === 'ok' ? C.greenSoft : C.primarySoft;
  const iconFg = props.tone ? color : C.primary;
  return (
    <Pressable style={({ pressed }) => [styles.stat, pressed && props.onPress && { backgroundColor: C.surface2 }]} onPress={props.onPress} disabled={!props.onPress}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Icon name={props.icon} size={18} color={iconFg} />
      </View>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {props.value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {props.label}
      </Text>
    </Pressable>
  );
}

/** 목록 한 줄 (왼쪽 아이콘 타일 + 제목/설명 + 오른쪽) */
export function ListRow(props: {
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  title: string;
  sub?: string;
  right?: ReactNode;
  onPress?: () => void;
  first?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={!props.onPress}
      style={({ pressed }) => [styles.listRow, !props.first && styles.listRowDivider, pressed && { backgroundColor: C.surface2 }]}
    >
      {props.icon ? (
        <View style={[styles.listIcon, { backgroundColor: props.iconBg ?? C.primarySoft }]}>
          <Icon name={props.icon} size={20} color={props.iconColor ?? C.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle} numberOfLines={1}>
          {props.title}
        </Text>
        {props.sub ? <Text style={styles.listSub}>{props.sub}</Text> : null}
      </View>
      {props.right ?? (props.onPress ? <Icon name="chevron-right" size={22} color={C.faint} /> : null)}
    </Pressable>
  );
}

export const ui = StyleSheet.create({
  input: {
    backgroundColor: C.surface,
    color: C.text,
    fontFamily: F.semibold,
    fontSize: 18,
    borderRadius: S.radiusSm,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  modalBg: { flex: 1, backgroundColor: 'rgba(16,24,40,0.6)', justifyContent: 'center', padding: 16 },
  modal: { backgroundColor: C.surface, borderRadius: 18, padding: 20 },
  modalTitle: { ...T.h2, marginBottom: 14 },
});

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: S.radiusSm,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  btnLg: { minHeight: S.touch + 4, borderRadius: 12 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { fontFamily: F.bold, fontSize: 17, letterSpacing: -0.2 },
  btnTextLg: { fontSize: 19 },
  btnSub: { fontFamily: F.medium, fontSize: 13, marginTop: 1, opacity: 0.9 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 10, minHeight: 44, minWidth: 44, justifyContent: 'center' },
  iconBtnText: { fontFamily: F.semibold, fontSize: 15 },
  banner: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerText: { flex: 1, fontFamily: F.semibold, fontSize: 14.5, lineHeight: 20 },
  bannerBtn: { borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 6 },
  bannerBtnText: { fontFamily: F.bold, fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 60,
    backgroundColor: C.navy,
    gap: 8,
  },
  headerBack: { padding: 6 },
  headerTitle: { fontFamily: F.bold, fontSize: 19, color: C.white, letterSpacing: -0.3 },
  headerSub: { fontFamily: F.medium, fontSize: 13, color: '#B6C2D9', marginTop: 1 },
  card: { backgroundColor: C.surface, borderRadius: S.radius, borderWidth: 1, borderColor: C.border, padding: 16, ...shadow },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  sectionLabel: { ...T.label },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontFamily: F.semibold, fontSize: 12.5 },
  stat: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    gap: 6,
    ...shadow,
  },
  statIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: F.xbold, fontSize: 18, letterSpacing: -0.3, ...T.num },
  statLabel: { fontFamily: F.medium, fontSize: 12.5, color: C.sub },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, minHeight: 60 },
  listRowDivider: { borderTopWidth: 1, borderTopColor: C.border },
  listIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontFamily: F.semibold, fontSize: 16, color: C.text },
  listSub: { fontFamily: F.medium, fontSize: 13.5, color: C.sub, marginTop: 2, lineHeight: 19 },
});
