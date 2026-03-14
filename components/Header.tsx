import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type HeaderProps = {
  children: React.ReactNode;
  backgroundColor?: string;
  withBorder?: boolean;
};

export function Header({ children, backgroundColor = '#1a1a1a', withBorder = true }: HeaderProps) {
  const insets = useSafeAreaInsets();
  
  // Calculate dynamic padding based on device
  const topPadding = Platform.select({
    ios: Math.max(insets.top, 47), // Ensures minimum padding even on non-notched devices
    android: Math.max(insets.top, 16),
    default: 16,
  });
  
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor,
          paddingTop: topPadding,
          paddingBottom: 16,
          paddingHorizontal: 16,
          borderBottomWidth: withBorder ? StyleSheet.hairlineWidth : 0,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
});