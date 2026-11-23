import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as DB from '../db';
import { BigButton, Header, Icon } from '../components/ui';
import { type KeyName, getKey, maskKey, setKey } from '../keys';
import { useNav } from '../nav';
import { C, F, S } from '../theme';

function KeyField(props: { name: KeyName; label: string; hint: string; placeholder: string }) {
  const [saved, setSaved] = useState<string | null>(null);
  const [value, setValue] = useState('');
  useEffect(() => {
    getKey(props.name).then(setSaved);
  }, [props.name]);
  return (
    <View style={styles.box}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="key-variant" size={22} color={C.primary} />
        <Text style={styles.label}>{props.label}</Text>
      </View>
      <Text style={styles.hint}>{props.hint}</Text>
      <Text style={styles.saved}>저장된 키: {maskKey(saved)}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={props.placeholder}
        placeholderTextColor={C.faint}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={styles.input}
      />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <BigButton
          title="저장"
          icon="content-save-outline"
          style={{ flex: 1 }}
          disabled={!value.trim()}
          onPress={async () => {
            await setKey(props.name, value);
            setSaved(value.trim());
            setValue('');
            Alert.alert('저장했습니다', '키는 이 폰의 보안 저장소(SecureStore)에만 보관됩니다.');
          }}
        />
        <BigButton
          title="삭제"
          kind="dark"
          style={{ flex: 1 }}
          disabled={!saved}
          onPress={async () => {
            await setKey(props.name, '');
            setSaved(null);
          }}
        />
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const nav = useNav();
  const [shutter, setShutter] = useState(DB.getSetting('shutterSound') === '1');
  return (
    <View style={styles.root}>
      <Header title="설정" subtitle="촬영 · API 키 · 안정성" onBack={() => nav.back()} />
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.box, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={shutter ? 'volume-high' : 'volume-off'} size={22} color={C.primary} />
              <Text style={styles.label}>촬영음</Text>
            </View>
            <Text style={styles.hint}>끄면 찰칵 소리 없이 진동과 화면 깜박임으로만 알려 줍니다. 녹음에도 소리가 섞이지 않습니다.</Text>
          </View>
          <Switch
            value={shutter}
            onValueChange={(v) => {
              setShutter(v);
              DB.setSetting('shutterSound', v ? '1' : '0');
            }}
            trackColor={{ true: C.primary, false: '#555' }}
            thumbColor={shutter ? '#fff' : '#ccc'}
            style={{ transform: [{ scale: 1.4 }], marginLeft: 12 }}
          />
        </View>
        <KeyField
          name="openai"
          label="OpenAI API 키 (음성 → 텍스트)"
          hint="platform.openai.com → API keys에서 만든 키 (sk-로 시작). Whisper로 녹음을 글로 바꿉니다. 1시간에 약 0.36달러."
          placeholder="sk-..."
        />
        <KeyField
          name="anthropic"
          label="Claude API 키 (보고서 초안)"
          hint="console.anthropic.com → API Keys에서 만든 키 (sk-ant-로 시작). 사진과 대화로 보고서 초안을 만듭니다."
          placeholder="sk-ant-..."
        />
        <Text style={styles.note}>
          녹음·사진은 이 폰 안에만 저장됩니다. "텍스트 변환"과 "보고서 초안"을 누를 때만 해당 녹음·사진이 OpenAI·Anthropic으로
          전송됩니다.
        </Text>
        <BigButton title="녹음 안정성 설정" icon="shield-check-outline" kind="dark" onPress={() => nav.push({ name: 'setup' })} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  box: { backgroundColor: C.surface, borderRadius: S.radius, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 14 },
  label: { color: C.text, fontSize: 19, fontFamily: F.xbold, flexShrink: 1 },
  hint: { color: C.sub, fontSize: 15, lineHeight: 22, marginTop: 6 },
  saved: { color: C.primary, fontSize: 15, fontFamily: F.xbold, marginTop: 10 },
  input: {
    backgroundColor: C.surface2,
    color: C.text,
    fontSize: 17,
    borderRadius: S.radiusSm,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  note: { color: C.sub, fontSize: 15, lineHeight: 22, marginBottom: 16 },
});
