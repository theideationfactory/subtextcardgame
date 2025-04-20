import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SafeAreaWrapperProps = {
  children: React.ReactNode;
  backgroundColor?: string;
};

export function SafeAreaWrapper({ children, backgroundColor = '#121212' }: SafeAreaWrapperProps) {
  const insets = useSafeAreaInsets();
  
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          // Always apply top safe area inset for iOS (including Dynamic Island)
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});