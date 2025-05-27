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

// Device types - using the most reliable detection methods
export const isTablet = () => {
  // Use Platform.isPad for iOS - this is the most reliable method
  if (Platform.OS === 'ios') {
    // Access the isPad property directly from Platform
    // This is the official way to detect iPads including iPad Mini
    return Platform.isPad === true;
  } else {
    // For Android, use screen dimensions
    const dim = Dimensions.get('window');
    const { width, height } = dim;
    // Use the smallest dimension to account for orientation
    const smallestDimension = Math.min(width, height);
    return smallestDimension >= 600; // Standard Android tablet detection
  }
};

// iPad specific detection
export const isIPad = () => {
  return Platform.OS === 'ios' && Platform.isPad === true;
};

// iPad Mini specific detection if needed
export const isIPadMini = () => {
  if (!isIPad()) return false;
  
  // iPad Mini has a screen size of approximately 8 inches
  // We can use dimensions to differentiate between iPad models
  const dim = Dimensions.get('window');
  const { width, height } = dim;
  
  // Method 1: Calculate diagonal screen size
  const screenSize = Math.sqrt(width * width + height * height) / Dimensions.get('window').scale;
  const isDiagonalSmall = screenSize < 1100; // Approximate threshold for iPad Mini
  
  // Method 2: Check specific dimensions (iPad mini 6th gen has a resolution of 1488 x 2266 at 326 ppi)
  const isDimensionsMatch = (
    (width <= 834 && height <= 1194) || // Portrait
    (height <= 834 && width <= 1194)    // Landscape
  );
  
  // Use both methods for more reliable detection
  return isDiagonalSmall || isDimensionsMatch;
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
