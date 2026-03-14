import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SafeAreaWrapperProps = {
  children: React.ReactNode;
  backgroundColor?: string;
  reducedSize?: boolean;
<<<<<<< HEAD
  skipBottomInset?: boolean;
=======
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
};

export function SafeAreaWrapper({ 
  children, 
<<<<<<< HEAD
  backgroundColor = '#090909',
  reducedSize = true,
  skipBottomInset = false 
=======
  backgroundColor = '#121212',
  reducedSize = true 
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
}: SafeAreaWrapperProps) {
  const insets = useSafeAreaInsets();
  
  // Use standardized padding values across all platforms
  // For mobile, use minimal safe area insets to ensure content doesn't overlap with system UI
  // For web, use consistent small padding
  const topPadding = Platform.OS === 'web' ? 0 : Math.max(insets.top, 4);
<<<<<<< HEAD
  const bottomPadding = skipBottomInset ? 0 : (Platform.OS === 'web' ? 0 : Math.max(insets.bottom, 4));
=======
  const bottomPadding = Platform.OS === 'web' ? 0 : Math.max(insets.bottom, 4);
>>>>>>> 8334cd6520d7fc014c1767411dbb9bc181ef497e
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