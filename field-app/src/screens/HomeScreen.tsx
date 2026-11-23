import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DB from '../db';
import FieldRecorder from '../../modules/field-recorder';
import { Banner, BigButton } from '../components/ui';
import {
  LOW_STORAGE_BLOCK,
  checkPermissions,
  getHealth,
  healthWarnings,
  requestPermissions,
  startInspection,
} from '../inspection';
import { useNav } from '../nav';
import { resumeInspectionFlow } from '../recovery';
import { C, S } from '../theme';
import { errMsg, fmtDate, fmtDuration } from '../util';
import type { DeviceHealth } from '../../modules/field-recorder';

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
        Alert.alert('확인해 주세요', msg.map((m) => `• ${m}`).join('\n'), [
          { text: '설정 안내 보기', onPress: () => resolve(false) },
          { text: '그래도 시작', onPress: () => resolve(true) },
        ])
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

  const warns = healthWarnings(health);

  return (
    <KeyboardAvoidingView style={styles.root} behavior="height">
      <View style={styles.top}>
        <Text style={styles.title}>현장점검</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={styles.smallBtn} onPress={() => nav.push({ name: 'setup' })}>
            <Text style={styles.smallBtnText}>안정성 설정</Text>
          </Pressable>
          {/* STAGE2_SETTINGS_BUTTON */}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: S.pad, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {health && !health.ignoringBatteryOptimizations ? (
              <Banner
                kind="error"
                text="배터리 최적화 예외가 꺼져 있습니다"
                action="설정"
                onAction={() => nav.push({ name: 'setup' })}
              />
            ) : null}
            {warns.map((w) => (
              <Banner key={w} text={w} />
            ))}

            <Text style={styles.label}>현장명</Text>
            <TextInput
              value={site}
              onChangeText={setSite}
              placeholder="예: 101동 3층 소방설비"
              placeholderTextColor="#777"
              style={styles.input}
              returnKeyType="done"
              maxLength={60}
            />
            <BigButton
              title="● 점검 시작"
              sub="녹음이 바로 시작됩니다"
              kind="danger"
              onPress={onStart}
              busy={busy}
              style={{ minHeight: 96, marginTop: 14 }}
            />
            <Text style={styles.section}>지난 점검</Text>
            {list.length === 0 ? <Text style={styles.empty}>아직 점검 기록이 없습니다.</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
            onPress={() =>
              item.status === 'active' ? resumeInspectionFlow(item, nav) : nav.push({ name: 'timeline', id: item.id })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.site}
              </Text>
              <Text style={styles.itemSub}>
                {fmtDate(item.started_at)} · 사진 {item.photo_count}장
                {item.ended_at ? ` · ${fmtDuration(item.ended_at - item.started_at)}` : ''}
              </Text>
            </View>
            {item.status === 'active' ? <Text style={styles.live}>진행 중</Text> : <Text style={styles.chev}>›</Text>}
          </Pressable>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.pad,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  title: { color: C.text, fontSize: 30, fontWeight: '900' },
  smallBtn: { borderWidth: 2, borderColor: C.cardBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  smallBtnText: { color: C.yellow, fontSize: 17, fontWeight: '800' },
  label: { color: C.sub, fontSize: 20, fontWeight: '700', marginTop: 6, marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    color: '#000000',
    fontSize: 24,
    fontWeight: '700',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  section: { color: C.text, fontSize: 22, fontWeight: '900', marginTop: 28, marginBottom: 10 },
  empty: { color: C.sub, fontSize: 18 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    marginBottom: 10,
    minHeight: 72,
  },
  itemTitle: { color: C.text, fontSize: 21, fontWeight: '800' },
  itemSub: { color: C.sub, fontSize: 16, marginTop: 4 },
  live: { color: C.red, fontSize: 17, fontWeight: '900' },
  chev: { color: C.sub, fontSize: 30, fontWeight: '700' },
});
