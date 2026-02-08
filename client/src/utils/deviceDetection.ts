/**
 * Utility functions for detecting device type and capabilities
 */

/**
 * Detects if the current device is a mobile device
 * @returns true if the device is mobile (phone or tablet), false otherwise
 */
export const isMobileDevice = (): boolean => {
  // Check user agent for mobile indicators
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // Check for mobile keywords in user agent
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  const isMobileUA = mobileRegex.test(userAgent);
  
  // Check for touch capability and small screen size
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasSmallScreen = window.innerWidth <= 768; // Typical mobile/tablet breakpoint
  
  // Check using modern API if available
  const isMobileConnection = (navigator as any).connection?.type === 'cellular';
  
  // Device is mobile if user agent indicates mobile OR (has touch + small screen)
  return isMobileUA || (hasTouchScreen && hasSmallScreen) || isMobileConnection;
};

/**
 * Detects if the current device is a tablet
 * @returns true if the device is a tablet, false otherwise
 */
export const isTabletDevice = (): boolean => {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // Check for tablet-specific indicators
  const tabletRegex = /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i;
  const isTabletUA = tabletRegex.test(userAgent);
  
  // Check screen size for tablets (between mobile and desktop)
  const isTabletScreen = window.innerWidth > 768 && window.innerWidth <= 1024;
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return isTabletUA || (hasTouchScreen && isTabletScreen);
};

/**
 * Gets a detailed description of the device type
 * @returns string describing the device type
 */
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  if (isTabletDevice()) return 'tablet';
  if (isMobileDevice()) return 'mobile';
  return 'desktop';
};

/**
 * Gets device information for logging
 * @returns object with device details
 */
export const getDeviceInfo = () => {
  return {
    type: getDeviceType(),
    userAgent: navigator.userAgent,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    touchEnabled: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    platform: navigator.platform,
    vendor: navigator.vendor
  };
};

/**
 * Checks if the device is suitable for taking an exam on mobile
 * @returns object with compatibility info
 */
export const checkMobileExamCompatibility = () => {
  const deviceType = getDeviceType();
  const isMobile = deviceType === 'mobile' || deviceType === 'tablet';
  
  // Check for required features
  const hasRequiredFeatures = {
    touch: 'ontouchstart' in window,
    localStorage: typeof Storage !== 'undefined',
    // Add more checks as needed
  };
  
  const isCompatible = isMobile && Object.values(hasRequiredFeatures).every(v => v);
  
  return {
    isMobile,
    deviceType,
    isCompatible,
    features: hasRequiredFeatures,
    warnings: isCompatible ? [] : ['Some required features are not available']
  };
};
