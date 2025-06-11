import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SpacerProps = {
  size?: number;
  backgroundColor?: string;
};

export function Spacer({ size = 48, backgroundColor = '#121212' }: SpacerProps) {
  const insets = useSafeAreaInsets();
  
  // Calculate total height including safe area inset
  const height = Platform.select({
    ios: Math.max(insets.top + size, size + 47), // Ensures minimum height on all iOS devices
    android: Math.max(insets.top + size, size),
    default: size,
  });

  return (
    <View 
      style={[
        styles.spacer,
        {
          height,
          backgroundColor,
        }
      ]} 
    />
  );
}

const styles = StyleSheet.create({
  spacer: {
    width: '100%',
  },
});