import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import FieldRecorder, { type DeviceHealth } from '../../modules/field-recorder';
import * as DB from '../db';
import { Banner, BigButton, Card, Icon, IconButton, Pill, SectionLabel, Stat } from '../components/ui';
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
import { C, S, T } from '../theme';
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

  return (
    <KeyboardAvoidingView style={styles.root} behavior="height">
      {/* 상단 바 */}
      <View style={styles.appBar}>
        <View style={styles.logo}>
          <Icon name="clipboard-check-outline" size={24} color="#1A1200" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.appTitle}>현장점검</Text>
          <Text style={styles.appSub}>녹음 · 사진 · 점검 보고서</Text>
        </View>
        <IconButton icon="cog-outline" onPress={() => nav.push({ name: 'settings' })} />
      </View>

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: S.pad, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {/* 기기 상태 */}
            <View style={styles.stats}>
              <Stat
                icon={battOk ? 'shield-check' : 'shield-alert'}
                label="녹음 안정성"
                value={battOk ? '설정됨' : '설정 필요'}
                tone={battOk ? 'ok' : 'bad'}
                onPress={() => nav.push({ name: 'setup' })}
              />
              <Stat
                icon={health?.charging ? 'battery-charging' : 'battery'}
                label="배터리"
                value={battPct >= 0 ? `${battPct}%` : '-'}
                tone={battPct >= 0 && battPct <= LOW_BATTERY_WARN && !health?.charging ? 'warn' : undefined}
              />
              <Stat
                icon="harddisk"
                label="남은 공간"
                value={fmtBytes(free)}
                tone={free >= 0 && free < LOW_STORAGE_WARN ? 'warn' : undefined}
              />
            </View>
            {warns.map((w) => (
              <Banner key={w} text={w} />
            ))}

            {active ? (
              <Pressable onPress={() => resumeInspectionFlow(active, nav)}>
                <Card accent={C.red} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[styles.recDot]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activeTitle}>진행 중인 점검</Text>
                      <Text style={styles.activeSub} numberOfLines={1}>
                        {active.site} · {fmtClock(active.started_at)} 시작
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={28} color={C.sub} />
                  </View>
                </Card>
              </Pressable>
            ) : null}

            {/* 새 점검 */}
            <Card style={{ marginBottom: 26 }}>
              <SectionLabel text="새 점검" />
              <Text style={styles.fieldLabel}>현장명</Text>
              <View style={styles.inputWrap}>
                <Icon name="map-marker-outline" size={24} color={C.sub} />
                <TextInput
                  value={site}
                  onChangeText={setSite}
                  placeholder="예: 101동 3층 소방설비"
                  placeholderTextColor={C.faint}
                  style={styles.input}
                  returnKeyType="done"
                  maxLength={60}
                />
              </View>
              <BigButton
                title="점검 시작"
                sub="누르면 바로 녹음이 시작됩니다"
                icon="record-circle-outline"
                kind="danger"
                onPress={onStart}
                busy={busy}
                style={{ minHeight: 84, marginTop: 14 }}
              />
            </Card>

            <SectionLabel text={`점검 기록 ${list.length ? `(${list.length})` : ''}`} />
            {list.length === 0 ? (
              <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Icon name="folder-open-outline" size={36} color={C.faint} />
                <Text style={styles.empty}>아직 점검 기록이 없습니다</Text>
              </Card>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const d = new Date(item.started_at);
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.surface2 }]}
              onPress={() =>
                item.status === 'active' ? resumeInspectionFlow(item, nav) : nav.push({ name: 'timeline', id: item.id })
              }
            >
              <View style={styles.dateTile}>
                <Text style={styles.dateMonth}>{d.getMonth() + 1}월</Text>
                <Text style={styles.dateDay}>{d.getDate()}</Text>
                <Text style={styles.dateWeek}>{WEEK[d.getDay()]}</Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.site}
                </Text>
                <View style={styles.rowMeta}>
                  <Pill icon="camera-outline" text={`${item.photo_count}장`} />
                  {item.ended_at ? (
                    <Pill icon="microphone-outline" text={fmtDuration(item.ended_at - item.started_at)} />
                  ) : null}
                  {item.status === 'active' ? <Pill text="진행 중" color={C.red} bg={C.redDark} /> : null}
                </View>
              </View>
              <Icon name="chevron-right" size={26} color={C.faint} />
            </Pressable>
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: S.pad,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: { color: C.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  appSub: { color: C.sub, fontSize: 13, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  recDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.red },
  activeTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  activeSub: { color: C.sub, fontSize: 15, marginTop: 2 },
  fieldLabel: { color: C.sub, fontSize: 15, fontWeight: '700', marginBottom: 8 },
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
  input: { flex: 1, color: C.text, fontSize: 21, fontWeight: '700', paddingVertical: 14 },
  empty: { color: C.sub, fontSize: 16, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 10,
  },
  dateTile: {
    width: 58,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: C.surface2,
    alignItems: 'center',
  },
  dateMonth: { color: C.sub, fontSize: 12, fontWeight: '800' },
  dateDay: { color: C.text, fontSize: 22, fontWeight: '900', ...T.num, lineHeight: 26 },
  dateWeek: { color: C.faint, fontSize: 12, fontWeight: '700' },
  rowTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  rowMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
});
