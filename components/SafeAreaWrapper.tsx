import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SafeAreaWrapperProps = {
  children: React.ReactNode;
  backgroundColor?: string;
  reducedSize?: boolean;
};

export function SafeAreaWrapper({ 
  children, 
  backgroundColor = '#121212',
  reducedSize = true 
}: SafeAreaWrapperProps) {
  const insets = useSafeAreaInsets();
  
  // Use standardized padding values across all platforms
  // For mobile, use minimal safe area insets to ensure content doesn't overlap with system UI
  // For web, use consistent small padding
  const topPadding = Platform.OS === 'web' ? 0 : Math.max(insets.top, 4);
  const bottomPadding = Platform.OS === 'web' ? 0 : Math.max(insets.bottom, 4);
  const leftPadding = Platform.OS === 'web' ? 0 : insets.left;
  const rightPadding = Platform.OS === 'web' ? 0 : insets.right;
  
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          // Remove fixed height to allow content to determine size
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingLeft: leftPadding,
          paddingRight: rightPadding,
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