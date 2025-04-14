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
          // Apply safe area insets as padding
          paddingTop: Platform.OS === 'ios' ? 0 : insets.top, // Header handles top padding on iOS
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