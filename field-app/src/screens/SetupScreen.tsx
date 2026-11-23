import { useCallback, useEffect, useState } from 'react';
import { AppState, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import FieldRecorder, { type DeviceHealth } from '../../modules/field-recorder';
import * as DB from '../db';
import { BigButton, Header } from '../components/ui';
import { type PermResult, checkPermissions, getHealth, requestPermissions } from '../inspection';
import { useNav } from '../nav';
import { C, S } from '../theme';
import { fmtBytes } from '../util';

function Step(props: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepHead}>
        <Text style={[styles.badge, props.done ? { backgroundColor: C.green } : null]}>{props.done ? '✓' : props.n}</Text>
        <Text style={styles.stepTitle}>{props.title}</Text>
      </View>
      {props.children}
    </View>
  );
}

export default function SetupScreen({ first }: { first?: boolean }) {
  const nav = useNav();
  const [perm, setPerm] = useState<PermResult | null>(null);
  const [health, setHealth] = useState<DeviceHealth | null>(getHealth());
  const [samsungGuideOpened, setSamsungGuideOpened] = useState(DB.getSetting('samsungGuideSeen') === '1');

  const refresh = useCallback(() => {
    checkPermissions().then(setPerm);
    setHealth(getHealth());
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const done = () => {
    DB.setSetting('setupDone', '1');
    if (first) nav.reset({ name: 'home' });
    else nav.back();
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      done();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const permOk = !!perm && perm.mic && perm.camera && perm.notifications;
  const battOk = !!health?.ignoringBatteryOptimizations;
  const isSamsung = (health?.manufacturer ?? '').toLowerCase().includes('samsung');

  return (
    <View style={styles.root}>
      <Header title="녹음 안정성 설정" onBack={first ? undefined : done} />
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingBottom: 60 }}>
        <Text style={styles.lead}>
          화면이 꺼지거나 다른 앱을 써도 녹음이 끊기지 않도록, 처음 한 번만 아래 3가지를 해 주세요.
        </Text>

        <Step n={1} title="권한 허용 (마이크·카메라·알림)" done={permOk}>
          <Text style={styles.body}>
            알림 권한은 상단에 "점검 녹음 중"을 띄우는 데 필요합니다. 알림이 보여야 안드로이드가 녹음을 멈추지 않습니다.
          </Text>
          {!permOk ? (
            <BigButton
              title="권한 허용하기"
              onPress={async () => {
                setPerm(await requestPermissions());
              }}
              style={{ marginTop: 10 }}
            />
          ) : null}
          {perm && !permOk ? (
            <BigButton
              kind="dark"
              title="앱 권한 설정 열기"
              sub="'허용 안 함'을 눌렀다면 여기서 직접 켜세요"
              onPress={() => FieldRecorder.openAppSettings()}
              style={{ marginTop: 10 }}
            />
          ) : null}
        </Step>

        <Step n={2} title="배터리 최적화 예외" done={battOk}>
          <Text style={styles.body}>
            {battOk
              ? '설정되었습니다.'
              : '버튼을 누르고 나오는 창에서 "허용"을 누르세요. 녹음이 화면 꺼짐 중에 멈추지 않게 합니다.'}
          </Text>
          {!battOk ? (
            <BigButton
              title="배터리 최적화 예외 요청"
              onPress={() => FieldRecorder.requestIgnoreBatteryOptimizations()}
              style={{ marginTop: 10 }}
            />
          ) : null}
        </Step>

        <Step n={3} title="삼성: '절전 예외 앱'에 등록" done={samsungGuideOpened}>
          <Text style={styles.body}>
            삼성 갤럭시는 위 설정과 별개로 오래 안 쓴 앱을 "절전 상태"로 만듭니다. 아래 순서로 꼭 등록하세요.
          </Text>
          <View style={styles.howto}>
            <Text style={styles.howtoLine}>① 설정 앱 → 배터리 (또는 "디바이스 케어 → 배터리")</Text>
            <Text style={styles.howtoLine}>② 백그라운드 사용 제한</Text>
            <Text style={styles.howtoLine}>③ 절전 예외 앱 → 오른쪽 위 "+" 또는 "추가"</Text>
            <Text style={styles.howtoLine}>④ 목록에서 "현장점검" 선택 → 추가</Text>
            <Text style={[styles.howtoLine, { marginTop: 8 }]}>그리고 같은 화면에서:</Text>
            <Text style={styles.howtoLine}>• "사용하지 않는 앱을 절전 상태로 전환" → 끄기</Text>
            <Text style={[styles.howtoLine, { marginTop: 8 }]}>추가로 앱 정보에서:</Text>
            <Text style={styles.howtoLine}>• 설정 → 애플리케이션 → 현장점검 → 배터리 → "제한 없음"</Text>
          </View>
          <BigButton
            title="배터리 설정 열기"
            onPress={() => {
              FieldRecorder.openSamsungBatterySettings();
              DB.setSetting('samsungGuideSeen', '1');
              setSamsungGuideOpened(true);
            }}
            style={{ marginTop: 10 }}
          />
          <BigButton
            kind="dark"
            title="앱 정보 열기 (배터리 → 제한 없음)"
            onPress={() => {
              FieldRecorder.openAppSettings();
              DB.setSetting('samsungGuideSeen', '1');
              setSamsungGuideOpened(true);
            }}
            style={{ marginTop: 10 }}
          />
          {!isSamsung && health ? (
            <Text style={[styles.body, { marginTop: 8 }]}>
              (이 기기는 {health.manufacturer}입니다. 메뉴 이름이 조금 다를 수 있습니다.)
            </Text>
          ) : null}
        </Step>

        <View style={styles.info}>
          <Text style={styles.infoTitle}>현재 상태</Text>
          <Text style={styles.infoLine}>
            기기: {health ? `${health.manufacturer} ${health.model} (Android API ${health.sdk})` : '-'}
          </Text>
          <Text style={styles.infoLine}>
            배터리: {health ? `${health.batteryPct}%${health.charging ? ' (충전 중)' : ''}` : '-'}
            {health?.powerSaveMode ? ' · 절전 모드 켜짐 ⚠' : ''}
          </Text>
          <Text style={styles.infoLine}>남은 저장공간: {health ? fmtBytes(health.freeBytes) : '-'}</Text>
          <Text style={styles.infoLine}>녹음 용량: 1시간에 약 30MB (1분마다 파일 저장)</Text>
        </View>

        <BigButton title={first ? '시작하기' : '완료'} onPress={done} style={{ marginTop: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  lead: { color: C.text, fontSize: 20, fontWeight: '700', lineHeight: 29, marginBottom: 16 },
  step: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 14,
    marginBottom: 14,
  },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.yellow,
    color: C.black,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
  },
  stepTitle: { color: C.text, fontSize: 21, fontWeight: '900', flex: 1 },
  body: { color: C.sub, fontSize: 18, lineHeight: 26 },
  howto: { backgroundColor: '#0B0B0B', borderRadius: 10, padding: 12, marginTop: 10 },
  howtoLine: { color: C.text, fontSize: 18, lineHeight: 28, fontWeight: '700' },
  info: { marginTop: 6, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder },
  infoTitle: { color: C.text, fontSize: 20, fontWeight: '900', marginBottom: 6 },
  infoLine: { color: C.sub, fontSize: 17, lineHeight: 26 },
});
