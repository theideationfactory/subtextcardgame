import { Dimensions, Platform, ScaledSize } from 'react-native';

// Get device dimensions
const { width, height } = Dimensions.get('window');

// Utility: Detect iPhones with Dynamic Island (iPhone 14 Pro/Max, 15 Pro/Max, etc)
export const hasDynamicIsland = () => {
  if (Platform.OS !== 'ios') return false;
  // These are the screen heights for iPhones with Dynamic Island (points, not pixels)
  // iPhone 14 Pro: 393 x 852, 14 Pro Max: 430 x 932
  // iPhone 15 Pro: 393 x 852, 15 Pro Max: 430 x 932
  const dynamicIslandHeights = [852, 932];
  const dynamicIslandWidths = [393, 430];
  return (
    (dynamicIslandHeights.includes(height) && dynamicIslandWidths.includes(width)) ||
    (dynamicIslandHeights.includes(width) && dynamicIslandWidths.includes(height))
  );
};

// Device types
export const isTablet = () => {
  const dim = Dimensions.get('window');
  return (dim.width >= 768 || dim.height >= 768);
};

export const isIPad = () => {
  return Platform.OS === 'ios' && isTablet();
};

export const isIPadMini = () => {
  // iPad mini 6th gen has a resolution of 1488 x 2266 at 326 ppi
  // We can use approximate dimensions to detect iPad mini
  return isIPad() && (
    (width <= 834 && height <= 1194) || // Portrait
    (height <= 834 && width <= 1194)    // Landscape
  );
};

// Responsive sizing helpers
export const getResponsiveWidth = (percentage: number) => {
  return width * (percentage / 100);
};

export const getResponsiveHeight = (percentage: number) => {
  return height * (percentage / 100);
};

// Responsive dimensions for different device types
export const getColorOptionSize = () => {
  if (isIPadMini()) {
    return 100; // Larger touch target for iPad mini
  } else if (isTablet()) {
    return 90; // Larger touch target for other tablets
  }
  return 80; // Default size for phones (already increased from 70)
};

export const getHitSlop = () => {
  if (isIPadMini() || isTablet()) {
    return 25; // Larger hit slop for tablets
  }
  return 20; // Default hit slop (already increased from 15)
};

// Listen for dimension changes (e.g., orientation changes)
export const listenToOrientationChanges = (callback: (dim: ScaledSize) => void) => {
  return Dimensions.addEventListener('change', ({ window }) => {
    callback(window);
  });
};
