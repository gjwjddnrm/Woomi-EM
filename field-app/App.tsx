import { StatusBar } from 'expo-status-bar';
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as DB from './src/db';
import { NavContext, type Nav, type Route } from './src/nav';
import { resumeInspectionFlow } from './src/recovery';
import { clearClipCache, resumePendingCompression } from './src/storage';
import { C } from './src/theme';
import CaptureScreen from './src/screens/CaptureScreen';
import HomeScreen from './src/screens/HomeScreen';
import SetupScreen from './src/screens/SetupScreen';
import TimelineScreen from './src/screens/TimelineScreen';
import { BigButton } from './src/components/ui';

class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('UI error', error);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: C.bg, padding: 20, justifyContent: 'center', gap: 16 }}>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>화면 오류가 났습니다</Text>
          <Text style={{ color: C.sub, fontSize: 17 }}>
            녹음은 별도로 계속 저장되고 있습니다.{'\n'}
            {this.state.error.message}
          </Text>
          <BigButton
            title="처음 화면으로"
            onPress={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [stack, setStack] = useState<Route[] | null>(null);
  const stackRef = useRef<Route[]>([]);

  const set = useCallback((s: Route[]) => {
    stackRef.current = s;
    setStack(s);
  }, []);

  const nav: Nav | null = useMemo(() => {
    if (!stack) return null;
    return {
      route: stack[stack.length - 1],
      push: (r) => set([...stackRef.current, r]),
      replace: (r) => set([...stackRef.current.slice(0, -1), r]),
      reset: (r) => set([r]),
      back: () => set(stackRef.current.length > 1 ? stackRef.current.slice(0, -1) : [{ name: 'home' }]),
    };
  }, [stack, set]);

  // 부팅: DB 준비 → 첫 실행 안내 또는 진행 중 점검 복구
  useEffect(() => {
    try {
      DB.getDb();
      resumePendingCompression();
      clearClipCache();
      const setupDone = DB.getSetting('setupDone') === '1';
      set([setupDone ? { name: 'home' } : { name: 'setup' }]);
    } catch (e) {
      Alert.alert('저장소를 열지 못했습니다', String(e));
      set([{ name: 'home' }]);
    }
  }, [set]);

  // 진행 중이던 점검이 있으면 이어서 할지 묻는다 (처음 한 번)
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (!nav || recoveredRef.current) return;
    recoveredRef.current = true;
    const active = DB.getActiveInspection();
    if (active) resumeInspectionFlow(active, nav, 'reset');
  }, [nav]);

  // 하드웨어 뒤로가기 (각 화면이 먼저 처리하지 않으면)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stackRef.current.length > 1) {
        set(stackRef.current.slice(0, -1));
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [set]);

  if (!nav) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  const r = nav.route;
  let screen: ReactNode;
  switch (r.name) {
    case 'home':
      screen = <HomeScreen />;
      break;
    case 'setup':
      screen = <SetupScreen first={stack!.length === 1} />;
      break;
    case 'capture':
      screen = <CaptureScreen key={r.id} id={r.id} />;
      break;
    case 'timeline':
      screen = <TimelineScreen key={r.id} id={r.id} />;
      break;
    default:
      screen = <HomeScreen />;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <NavContext.Provider value={nav}>
          <ErrorBoundary onReset={() => nav.reset({ name: 'home' })}>{screen}</ErrorBoundary>
        </NavContext.Provider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
});
