// 웹 미리보기용 카메라 대체 화면
import { forwardRef } from 'react';
import { Image, View, type ViewStyle } from 'react-native';

export const CameraView = forwardRef<unknown, { style?: ViewStyle | ViewStyle[] }>(function CameraView(props, _ref) {
  return (
    <View style={props.style}>
      <Image source={{ uri: '/preview/cam.jpg' }} style={{ flex: 1 }} resizeMode="cover" />
    </View>
  );
});
export type CameraView = { takePictureAsync: () => Promise<{ uri: string; width: number; height: number }> };
export function useCameraPermissions() {
  return [{ granted: true, canAskAgain: true }, async () => ({ granted: true })] as const;
}
