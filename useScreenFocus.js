import { useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBar } from '../context/TabBarContext';

// ====================
// Screen Focus Handler (to ensure tab bar shows when switching screens)
// ====================
export const useScreenFocus = () => {
  const { showTabBar } = useTabBar();

  useFocusEffect(() => {
    // Show tab bar when screen comes into focus
    const timer = setTimeout(() => {
      showTabBar();
    }, 100);
    
    return () => clearTimeout(timer);
  });
};