import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import FieldRecorder, { type DeviceHealth } from '../../modules/field-recorder';
import * as DB from '../db';
import { Banner, BigButton, Card, Icon, IconButton, SectionLabel, Stat } from '../components/ui';
import {
  LOW_BATTERY_WARN,
  LOW_STORAGE_BLOCK,
  LOW_STORAGE_WARN,
  checkPermissions,
  getHealth,
  healthWarnings,
  requestPermissions,
  startInspection,
} from '../inspection';
import { useNav } from '../nav';
import { resumeInspectionFlow } from '../recovery';
import { C, F, S, T, shadow } from '../theme';
import { errMsg, fmtBytes, fmtClock, fmtDuration } from '../util';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export default function HomeScreen() {
  const nav = useNav();
  const [site, setSite] = useState(DB.getSetting('lastSite') ?? '');
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<DeviceHealth | null>(getHealth());
  const [list, setList] = useState(() => DB.listInspections());

  const refresh = useCallback(() => {
    setHealth(getHealth());
    setList(DB.listInspections());
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    const t = setInterval(() => setHealth(getHealth()), 15000);
    return () => {
      sub.remove();
      clearInterval(t);
    };
  }, [refresh]);

  const onStart = async () => {
    const name = site.trim();
    if (!name) {
      Alert.alert('현장명을 입력하세요', '예: 101동 3층, ○○현장 지하주차장');
      return;
    }
    let perm = await checkPermissions();
    if (!perm.mic || !perm.camera || !perm.notifications) perm = await requestPermissions();
    if (!perm.mic) {
      Alert.alert('마이크 권한 필요', '녹음하려면 마이크 권한이 꼭 필요합니다.', [
        { text: '취소', style: 'cancel' },
        { text: '설정 열기', onPress: () => FieldRecorder.openAppSettings() },
      ]);
      return;
    }
    const h = getHealth();
    if (h && h.freeBytes >= 0 && h.freeBytes < LOW_STORAGE_BLOCK) {
      Alert.alert('저장공간 부족', '남은 공간이 너무 적어 녹음할 수 없습니다. 사진·동영상을 정리한 뒤 다시 시도하세요.');
      return;
    }
    const warns = healthWarnings(h);
    if (warns.length > 0 || (h && !h.ignoringBatteryOptimizations)) {
      const msg = [...warns];
      if (h && !h.ignoringBatteryOptimizations) msg.push('배터리 최적화 예외가 꺼져 있어 화면이 꺼지면 녹음이 끊길 수 있습니다');
      const go = await new Promise<boolean>((resolve) =>
        Alert.alert(
          '확인해 주세요',
          msg.map((m) => `• ${m}`).join('\n'),
          [
            { text: '설정 안내 보기', onPress: () => resolve(false) },
            { text: '그래도 시작', onPress: () => resolve(true) },
          ],
          { cancelable: false }
        )
      );
      if (!go) {
        nav.push({ name: 'setup' });
        return;
      }
    }
    setBusy(true);
    try {
      DB.setSetting('lastSite', name);
      const insp = await startInspection(name);
      nav.replace({ name: 'capture', id: insp.id });
    } catch (e) {
      Alert.alert('녹음을 시작하지 못했습니다', errMsg(e));
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const battOk = !!health?.ignoringBatteryOptimizations;
  const battPct = health?.batteryPct ?? -1;
  const free = health?.freeBytes ?? -1;
  const warns = healthWarnings(health);
  const active = list.find((i) => i.status === 'active');
  const past = list.filter((i) => i.status !== 'active');

  return (
    <KeyboardAvoidingView style={styles.root} behavior="height">
      <FlatList
        data={past}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {/* 남색 머리 영역 */}
            <View style={styles.hero}>
              <View style={styles.appBar}>
                <View style={styles.logo}>
                  <Icon name="clipboard-check-outline" size={22} color={C.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appTitle}>현장점검</Text>
                  <Text style={styles.appSub}>녹음 · 사진 · 점검 보고서</Text>
                </View>
                <IconButton icon="cog-outline" dark onPress={() => nav.push({ name: 'settings' })} />
              </View>
            </View>

            {/* 새 점검 카드 (머리 영역에 겹침) */}
            <View style={styles.body}>
              <Card style={styles.startCard}>
                <Text style={styles.cardTitle}>새 점검 시작</Text>
                <Text style={styles.cardSub}>현장명을 입력하면 녹음이 바로 시작됩니다</Text>
                <View style={styles.inputWrap}>
                  <Icon name="map-marker-outline" size={22} color={C.faint} />
                  <TextInput
                    value={site}
                    onChangeText={setSite}
                    placeholder="예: 101동 3층 소방설비"
                    placeholderTextColor={C.faint}
                    style={styles.input}
                    returnKeyType="done"
                    maxLength={60}
                  />
                  {site ? (
                    <Pressable onPress={() => setSite('')} hitSlop={10}>
                      <Icon name="close-circle" size={20} color={C.faint} />
                    </Pressable>
                  ) : null}
                </View>
                <BigButton
                  title="녹음 시작"
                  icon="microphone"
                  kind="danger"
                  size="lg"
                  onPress={onStart}
                  busy={busy}
                  style={{ marginTop: 12 }}
                />
              </Card>

              {active ? (
                <Pressable onPress={() => resumeInspectionFlow(active, nav)} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
                  <View style={styles.activeCard}>
                    <View style={styles.livePulse}>
                      <View style={styles.liveDot} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activeLabel}>진행 중인 점검</Text>
                      <Text style={styles.activeTitle} numberOfLines={1}>
                        {active.site}
                      </Text>
                      <Text style={styles.activeSub}>{fmtClock(active.started_at)} 시작 · 사진 {active.photo_count}장</Text>
                    </View>
                    <View style={styles.activeGo}>
                      <Text style={styles.activeGoText}>이어서</Text>
                      <Icon name="chevron-right" size={18} color={C.white} />
                    </View>
                  </View>
                </Pressable>
              ) : null}

              {/* 기기 상태 */}
              <SectionLabel text="기기 상태" style={{ marginTop: 22 }} />
              <View style={styles.stats}>
                <Stat
                  icon={battOk ? 'shield-check-outline' : 'shield-alert-outline'}
                  label="녹음 안정성"
                  value={battOk ? '정상' : '설정 필요'}
                  tone={battOk ? 'ok' : 'bad'}
                  onPress={() => nav.push({ name: 'setup' })}
                />
                <Stat
                  icon={health?.charging ? 'battery-charging' : 'battery-high'}
                  label={health?.charging ? '충전 중' : '배터리'}
                  value={battPct >= 0 ? `${battPct}%` : '-'}
                  tone={battPct >= 0 && battPct <= LOW_BATTERY_WARN && !health?.charging ? 'warn' : undefined}
                />
                <Stat icon="harddisk" label="남은 공간" value={fmtBytes(free)} tone={free >= 0 && free < LOW_STORAGE_WARN ? 'warn' : undefined} />
              </View>
              {warns.length ? <View style={{ marginTop: 10 }}>{warns.map((w) => <Banner key={w} text={w} />)}</View> : null}

              <SectionLabel text={`점검 기록 ${past.length}건`} style={{ marginTop: 22 }} />
              {past.length === 0 ? (
                <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
                  <Icon name="folder-open-outline" size={34} color={C.faint} />
                  <Text style={styles.empty}>아직 점검 기록이 없습니다</Text>
                </Card>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          const d = new Date(item.started_at);
          const first = index === 0;
          const lastRow = index === past.length - 1;
          return (
            <View style={{ paddingHorizontal: S.pad }}>
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  first && styles.rowFirst,
                  lastRow && styles.rowLast,
                  !first && styles.rowDivider,
                  pressed && { backgroundColor: C.surface2 },
                ]}
                onPress={() => nav.push({ name: 'timeline', id: item.id })}
              >
                <View style={styles.dateTile}>
                  <Text style={styles.dateDay}>{d.getDate()}</Text>
                  <Text style={styles.dateMonth}>
                    {d.getMonth() + 1}월 · {WEEK[d.getDay()]}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.site}
                  </Text>
                  <View style={styles.rowMeta}>
                    <Icon name="camera-outline" size={14} color={C.faint} />
                    <Text style={styles.rowMetaText}>{item.photo_count}장</Text>
                    {item.ended_at ? (
                      <>
                        <Text style={styles.metaDot}>·</Text>
                        <Icon name="microphone-outline" size={14} color={C.faint} />
                        <Text style={styles.rowMetaText}>{fmtDuration(item.ended_at - item.started_at)}</Text>
                      </>
                    ) : null}
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.rowMetaText}>{fmtClock(item.started_at).replace(/:\d\d$/, '')}</Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={22} color={C.faint} />
              </Pressable>
            </View>
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  hero: { backgroundColor: C.navy, paddingBottom: 56 },
  appBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: S.pad, paddingTop: 12, paddingBottom: 8 },
  logo: { width: 40, height: 40, borderRadius: 11, backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center' },
  appTitle: { fontFamily: F.xbold, fontSize: 21, color: C.white, letterSpacing: -0.5 },
  appSub: { fontFamily: F.medium, fontSize: 13, color: '#9FB0CF', marginTop: 1 },
  body: { paddingHorizontal: S.pad, marginTop: -44 },
  startCard: { padding: 18 },
  cardTitle: { ...T.h2 },
  cardSub: { ...T.sub, marginTop: 2, marginBottom: 14 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface2,
    borderRadius: S.radiusSm,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    paddingHorizontal: 12,
  },
  input: { flex: 1, color: C.text, fontFamily: F.semibold, fontSize: 18, paddingVertical: 13 },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: S.radius,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: '#F7B4AE',
    ...shadow,
  },
  livePulse: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.redSoft, alignItems: 'center', justifyContent: 'center' },
  liveDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.red },
  activeLabel: { fontFamily: F.bold, fontSize: 12.5, color: C.red, letterSpacing: 0.3 },
  activeTitle: { fontFamily: F.bold, fontSize: 17, color: C.text, marginTop: 1 },
  activeSub: { ...T.sub, fontSize: 13 },
  activeGo: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.red, borderRadius: 999, paddingLeft: 12, paddingRight: 6, paddingVertical: 7 },
  activeGoText: { fontFamily: F.bold, fontSize: 14, color: C.white },
  stats: { flexDirection: 'row', gap: 8 },
  empty: { ...T.sub, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: S.radius, borderTopRightRadius: S.radius },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: S.radius, borderBottomRightRadius: S.radius },
  rowDivider: { borderTopWidth: 1, borderTopColor: C.border },
  dateTile: { width: 54, paddingVertical: 7, borderRadius: 10, backgroundColor: C.primarySoft, alignItems: 'center' },
  dateDay: { fontFamily: F.xbold, fontSize: 21, color: C.primaryDark, lineHeight: 24, ...T.num },
  dateMonth: { fontFamily: F.semibold, fontSize: 11, color: C.primary },
  rowTitle: { fontFamily: F.bold, fontSize: 16.5, color: C.text, letterSpacing: -0.2 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  rowMetaText: { fontFamily: F.medium, fontSize: 13.5, color: C.sub, ...T.num },
  metaDot: { color: C.faint, marginHorizontal: 2 },
});
