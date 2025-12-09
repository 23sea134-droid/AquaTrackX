import { useCallback, useRef, useEffect } from 'react';
import { useTabBar } from '../context/TabBarContext';

// ====================
// Enhanced Scroll Handler Hook
// ====================
export const useScrollHandler = () => {
  const { hideTabBar, showTabBar, isTabBarVisible } = useTabBar();
  const lastScrollY = useRef(0);
  const scrollDirection = useRef('up');
  const hideTimeout = useRef(null);
  const scrollThreshold = 10; // Minimum scroll distance to trigger hide/show
  const topThreshold = 100; // Show tab bar when near top

  const handleScroll = useCallback((event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDelta = currentScrollY - lastScrollY.current;
    
    // Clear any existing timeout
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
    }

    // Show tab bar when at the top
    if (currentScrollY <= topThreshold) {
      if (!isTabBarVisible) {
        scrollDirection.current = 'up';
        showTabBar();
      }
      lastScrollY.current = currentScrollY;
      return;
    }

    // Only trigger on significant scroll movements
    if (Math.abs(scrollDelta) < scrollThreshold) {
      lastScrollY.current = currentScrollY;
      return;
    }

    // Scrolling down - hide tab bar
    if (scrollDelta > 0 && currentScrollY > topThreshold) {
      if (scrollDirection.current !== 'down') {
        scrollDirection.current = 'down';
        hideTabBar();
      }
    } 
    // Scrolling up - show tab bar
    else if (scrollDelta < 0) {
      if (scrollDirection.current !== 'up') {
        scrollDirection.current = 'up';
        showTabBar();
      }
    }

    // Auto-show tab bar after scroll stops (with longer delay)
    hideTimeout.current = setTimeout(() => {
      if (currentScrollY <= topThreshold) {
        showTabBar();
      }
    }, 3000);

    lastScrollY.current = currentScrollY;
  }, [hideTabBar, showTabBar, isTabBarVisible]);

  // Handle scroll end - show tab bar after user stops scrolling
  const handleScrollEnd = useCallback(() => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
    }
    
    hideTimeout.current = setTimeout(() => {
      showTabBar();
    }, 1500);
  }, [showTabBar]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
      }
    };
  }, []);

  return { 
    handleScroll, 
    handleScrollEnd,
    // Additional handlers for different scroll components
    onScrollBeginDrag: () => {
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
      }
    },
    onMomentumScrollEnd: handleScrollEnd,
    onScrollEndDrag: handleScrollEnd,
  };
};