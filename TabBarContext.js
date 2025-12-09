import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Animated } from 'react-native';

// ====================
// Enhanced Tab Bar Visibility Context
// ====================
const TabBarContext = createContext({
  isTabBarVisible: true,
  hideTabBar: () => {},
  showTabBar: () => {},
  tabBarAnimatedValue: new Animated.Value(1),
});

export const TabBarProvider = ({ children }) => {
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);
  const [tabBarAnimatedValue] = useState(new Animated.Value(1));
  const animationInProgress = useRef(false);

  const hideTabBar = useCallback(() => {
    if (!isTabBarVisible || animationInProgress.current) return;
    
    console.log('TabBarProvider: Hiding tab bar');
    animationInProgress.current = true;
    setIsTabBarVisible(false);
    
    Animated.timing(tabBarAnimatedValue, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      animationInProgress.current = false;
    });
  }, [isTabBarVisible, tabBarAnimatedValue]);

  const showTabBar = useCallback(() => {
    if (isTabBarVisible || animationInProgress.current) return;
    
    console.log('TabBarProvider: Showing tab bar');
    animationInProgress.current = true;
    setIsTabBarVisible(true);
    
    Animated.timing(tabBarAnimatedValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      animationInProgress.current = false;
    });
  }, [isTabBarVisible, tabBarAnimatedValue]);

  return (
    <TabBarContext.Provider value={{ 
      isTabBarVisible, 
      hideTabBar, 
      showTabBar, 
      tabBarAnimatedValue 
    }}>
      {children}
    </TabBarContext.Provider>
  );
};

export const useTabBar = () => useContext(TabBarContext);