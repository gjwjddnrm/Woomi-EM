import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as DB from '../db';
import { BigButton, Header } from '../components/ui';
import { type KeyName, getKey, maskKey, setKey } from '../keys';
import { useNav } from '../nav';
import { C, S } from '../theme';

function KeyField(props: { name: KeyName; label: string; hint: string; placeholder: string }) {
  const [saved, setSaved] = useState<string | null>(null);
  const [value, setValue] = useState('');
  useEffect(() => {
    getKey(props.name).then(setSaved);
  }, [props.name]);
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{props.label}</Text>
      <Text style={styles.hint}>{props.hint}</Text>
      <Text style={styles.saved}>저장된 키: {maskKey(saved)}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={props.placeholder}
        placeholderTextColor="#777"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={styles.input}
      />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <BigButton
          title="저장"
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
      <Header title="설정" onBack={() => nav.back()} />
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.box, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>촬영음</Text>
            <Text style={styles.hint}>끄면 찰칵 소리 없이 진동과 화면 깜박임으로만 알려 줍니다. 녹음에도 소리가 섞이지 않습니다.</Text>
          </View>
          <Switch
            value={shutter}
            onValueChange={(v) => {
              setShutter(v);
              DB.setSetting('shutterSound', v ? '1' : '0');
            }}
            trackColor={{ true: C.yellow, false: '#555' }}
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
        <BigButton title="녹음 안정성 설정 다시 보기" kind="dark" onPress={() => nav.push({ name: 'setup' })} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  box: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, padding: 14, marginBottom: 16 },
  label: { color: C.text, fontSize: 21, fontWeight: '900' },
  hint: { color: C.sub, fontSize: 16, lineHeight: 23, marginTop: 6 },
  saved: { color: C.yellow, fontSize: 17, fontWeight: '800', marginTop: 8 },
  input: {
    backgroundColor: '#fff',
    color: '#000',
    fontSize: 18,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  note: { color: C.sub, fontSize: 16, lineHeight: 24, marginBottom: 16 },
});
