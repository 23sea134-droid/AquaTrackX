import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
  AppState,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { deviceService } from '../services/deviceService';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBar } from '../context/TabBarContext';

const { width } = Dimensions.get('window');

const StatusScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { showTabBar } = useTabBar();

  // Custom scroll handler to replace useScrollHandler
  const handleScroll = useCallback((event) => {
    // Custom scroll logic if needed
  }, []);

  const onScrollBeginDrag = useCallback(() => {
    // Custom logic for scroll begin
  }, []);

  const onMomentumScrollEnd = useCallback(() => {
    // Custom logic for momentum scroll end
  }, []);

  const onScrollEndDrag = useCallback(() => {
    // Custom logic for scroll end drag
  }, []);

  const [devices, setDevices] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [valveStates, setValveStates] = useState({});
  const [valveLoading, setValveLoading] = useState({});
  
  const unsubscribeRef = useRef(null);
  const isMountedRef = useRef(true);
  const appStateRef = useRef(AppState.currentState);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => showTabBar(), 100);
      return () => clearTimeout(timer);
    }, [showTabBar])
  );

  const cleanupListeners = useCallback(() => {
    if (unsubscribeRef.current) {
      try {
        // Check if unsubscribe is a function before calling it
        if (typeof unsubscribeRef.current === 'function') {
          unsubscribeRef.current();
        }
        unsubscribeRef.current = null;
      } catch (error) {
        console.error('Error cleaning up listeners:', error);
      }
    }
  }, []);

  const loadDevices = useCallback(async () => {
    if (!user?.uid || !isMountedRef.current) return;
    
    try {
      setLoading(true);
      const result = await deviceService.getUserDevices(user.uid);
      if (result.success && isMountedRef.current) {
        const devicesList = result.devices || [];
        setDevices(devicesList);
        
        // Update valve states from fresh data
        const updatedValveStates = {};
        devicesList.forEach(device => {
          if (device.data?.valveState !== undefined) {
            updatedValveStates[device.id] = device.data.valveState === 'OPEN';
          } else if (device.valveState !== undefined) {
            updatedValveStates[device.id] = device.valveState === 'OPEN';
          }
        });
        setValveStates(updatedValveStates);
        
        console.log(`✅ Loaded ${devicesList.length} devices`);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
      if (isMountedRef.current) {
        Alert.alert('Error', 'Failed to load devices. Please try again.');
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [user?.uid]);

  // FIXED: setupRealtimeListeners function with proper cleanup logic
  const setupRealtimeListeners = useCallback(() => {
    if (!user?.uid || !isMountedRef.current) return;
    
    // Only cleanup if we're switching modes, not on initial setup
    if (unsubscribeRef.current) {
      console.log('🧹 Cleaning up old listener before setting up new one');
      cleanupListeners();
    }
    
    if (realtimeEnabled) {
      try {
        const unsubscribe = deviceService.listenToDeviceStatus(
          user.uid, 
          (updatedDevices) => {
            if (isMountedRef.current && Array.isArray(updatedDevices)) {
              console.log(`🔄 Real-time update: ${updatedDevices.length} devices`);
              
              // Don't update if we get an empty array and we already have devices
              // This prevents the "cleaning" issue
              if (updatedDevices.length === 0 && devices.length > 0) {
                console.warn('⚠️ Received empty array in real-time update, keeping existing devices');
                return;
              }
              
              setDevices(updatedDevices);
              
              // Update valve states in real-time
              const updatedValveStates = {};
              updatedDevices.forEach(device => {
                if (device.data?.valveState !== undefined) {
                  updatedValveStates[device.id] = device.data.valveState === 'OPEN';
                } else if (device.valveState !== undefined) {
                  updatedValveStates[device.id] = device.valveState === 'OPEN';
                }
              });
              setValveStates(prev => ({ ...prev, ...updatedValveStates }));
            }
          },
          (error) => {
            console.error('Realtime listener error:', error);
            if (isMountedRef.current) {
              setRealtimeEnabled(false);
              Alert.alert('Connection Error', 'Real-time updates disabled due to connection issues.');
            }
          }
        );
        
        // Only assign if unsubscribe is a valid function
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribeRef.current = unsubscribe;
          console.log('✅ Real-time listener established');
        } else {
          console.warn('Invalid unsubscribe function returned from listenToDeviceStatus');
        }
      } catch (error) {
        console.error('Error setting up realtime listener:', error);
        if (isMountedRef.current) {
          setRealtimeEnabled(false);
        }
      }
    }
  }, [user?.uid, realtimeEnabled, devices.length]); // Added devices.length to deps

  const handleAppStateChange = useCallback((nextAppState) => {
    if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      if (isMountedRef.current) {
        console.log('App resumed - reloading devices');
        loadDevices();
        setupRealtimeListeners();
      }
    } else if (nextAppState.match(/inactive|background/)) {
      console.log('App backgrounded - cleaning up listeners');
      cleanupListeners();
    }
    appStateRef.current = nextAppState;
  }, [loadDevices, setupRealtimeListeners, cleanupListeners]);

  useEffect(() => {
    isMountedRef.current = true;
    loadDevices();
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      isMountedRef.current = false;
      try {
        subscription?.remove();
      } catch (error) {
        console.error('Error removing app state subscription:', error);
      }
      cleanupListeners();
    };
  }, [loadDevices, handleAppStateChange, cleanupListeners]);

  // FIXED: Setup realtime listeners only after initial load is complete
  //    and only when realtime is enabled
  useEffect(() => {
    // Only setup listeners if:
    // - User is authenticated
    // - Not currently loading
    // - Realtime is enabled
    // - We have at least attempted to load devices
    if (user?.uid && !loading && realtimeEnabled) {
      console.log('🔌 Setting up real-time listener...');
      setupRealtimeListeners();
      
      // Cleanup when realtime is disabled or component unmounts
      return () => {
        console.log('🔌 Cleaning up real-time listener...');
        cleanupListeners();
      };
    } else if (user?.uid && !loading && !realtimeEnabled) {
      // If realtime is disabled, make sure listeners are cleaned up
      cleanupListeners();
    }
  }, [user?.uid, loading, realtimeEnabled]); // Removed setupRealtimeListeners from deps

  const onRefresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    setRefreshing(true);
    await loadDevices();
    if (isMountedRef.current) setRefreshing(false);
  }, [loadDevices]);

  const toggleRealtimeUpdates = useCallback(() => {
    const newState = !realtimeEnabled;
    setRealtimeEnabled(newState);
    
    if (newState && user?.uid) {
      setupRealtimeListeners();
      Alert.alert('Real-time Mode', 'Real-time updates enabled');
    } else {
      cleanupListeners();
      Alert.alert('Battery Saver Mode', 'Real-time updates disabled to save battery');
    }
  }, [realtimeEnabled, user?.uid, setupRealtimeListeners, cleanupListeners]);

  const toggleValve = useCallback(async (deviceId, deviceName, currentState, deviceStatus) => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    // ✅ ADD: Check if already processing this device
    if (valveLoading[deviceId]) {
      console.log('Valve operation already in progress for device:', deviceId);
      return;
    }

    if (deviceStatus?.toLowerCase() !== 'online') {
      Alert.alert(
        'Device Offline',
        'Cannot control valve. Device is currently offline.',
        [{ text: 'OK' }]
      );
      return;
    }

    const newState = !currentState;
    const action = newState ? 'open' : 'close';
    
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Valve`,
      `Are you sure you want to ${action} the water valve for "${deviceName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: async () => {
            // ✅ SET: Loading state
            setValveLoading(prev => ({ ...prev, [deviceId]: true }));

            try {
              console.log(`🔧 Sending valve command: ${action} for device ${deviceId}`);
              
              // FIXED: Pass deviceId and boolean state (not userId)
              const result = await deviceService.controlValve(deviceId, newState);
              
              if (result.success) {
                // Update local state immediately for better UX
                setValveStates(prev => ({ ...prev, [deviceId]: newState }));
                
                Alert.alert('Success', `Valve ${action}ed successfully. Changes will be reflected in a few seconds.`);
                
                console.log(`✅ Valve command sent successfully`);
                
                // Refresh data from Firebase to ensure consistency
                setTimeout(() => {
                  console.log('🔄 Refreshing device data...');
                  loadDevices();
                }, 2000); // Wait 2 seconds for ESP32 to process command
              } else {
                console.error('❌ Valve control failed:', result.error);
                Alert.alert('Error', result.error || `Failed to ${action} valve`);
                
                // Revert local state on failure
                setValveStates(prev => ({ ...prev, [deviceId]: currentState }));
              }
            } catch (error) {
              console.error('❌ Valve control error:', error);
              Alert.alert('Error', `Failed to ${action} valve. Please try again.`);
              
              // Revert local state on error
              setValveStates(prev => ({ ...prev, [deviceId]: currentState }));
            } finally {
              // ✅ CLEAR: Loading state
              setValveLoading(prev => ({ ...prev, [deviceId]: false }));
            }
          }
        }
      ]
    );
  }, [user?.uid, loadDevices, valveLoading]);

  const getStatusInfo = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return { color: '#10B981', icon: 'checkmark-circle', text: 'Online' };
      case 'offline':
        return { color: '#EF4444', icon: 'close-circle', text: 'Offline' };
      case 'warning':
        return { color: '#F59E0B', icon: 'warning', text: 'Warning' };
      case 'maintenance':
        return { color: '#8B5CF6', icon: 'construct', text: 'Maintenance' };
      default:
        return { color: '#6B7280', icon: 'help-circle', text: 'Unknown' };
    }
  }, []);

  const getFilteredDevices = useCallback(() => {
    if (selectedFilter === 'all') return devices;
    return devices.filter(device => device.status?.toLowerCase() === selectedFilter);
  }, [devices, selectedFilter]);

  const formatLastSeen = useCallback((timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const lastSeen = new Date(timestamp);
    const diffInMinutes = Math.floor((now - lastSeen) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  }, []);

  const openLocationInMaps = useCallback((latitude, longitude) => {
    if (!latitude || !longitude) {
      Alert.alert('Invalid Location', 'GPS coordinates are not available.');
      return;
    }
    const url = `https://maps.google.com/?q=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open maps application');
    });
  }, []);

  const handleDeviceAction = useCallback((device) => {
    const actions = [
      { 
        text: 'View Details', 
        onPress: () => navigation.navigate('DeviceDetail', { deviceId: device.id })
      },
    ];

    if (device.gpsLocation?.latitude && device.gpsLocation?.longitude) {
      actions.push({
        text: 'View Location',
        onPress: () => openLocationInMaps(
          device.gpsLocation.latitude,
          device.gpsLocation.longitude
        )
      });
    }

    actions.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(device.name || 'Device Options', 'Choose an action:', actions);
  }, [navigation, openLocationInMaps]);

  const renderDeviceCard = useCallback((device, index) => {
    const statusInfo = getStatusInfo(device.status);
    const isValveOpen = valveStates[device.id] ?? (device.data?.valveState === 'OPEN') ?? (device.valveState === 'OPEN');
    const isValveLoading = valveLoading[device.id] || false;
    const flowRate = device.data?.flowRate || 0;
    const totalLitres = device.data?.totalLitres || device.totalUsage || 0;
    const isOnline = device.status?.toLowerCase() === 'online';
    
    // Get deviceId for commands (use actual deviceId, not the key)
    const actualDeviceId = device.deviceId || device.id;
    
    return (
      <TouchableOpacity
        key={device.id || index}
        style={styles.deviceCard}
        onPress={() => handleDeviceAction(device)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#1f293780', '#11182780']}
          style={styles.deviceCardGradient}
        >
          {/* Header */}
          <View style={styles.deviceHeader}>
            <View style={styles.deviceHeaderLeft}>
              <View style={[styles.statusIndicator, { backgroundColor: statusInfo.color }]}>
                <Ionicons name={statusInfo.icon} size={24} color="#fff" />
              </View>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>
                  {device.name || `Water Monitor ${index + 1}`}
                </Text>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>
                    {statusInfo.text}
                  </Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </View>

          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color="#9ca3af" />
            <Text style={styles.locationText}>{device.location || 'Main Supply'}</Text>
          </View>

          <View style={styles.divider} />

          {/* Valve Control */}
          <View style={styles.valveContainer}>
            <View style={styles.valveLeft}>
              <View style={styles.valveIconContainer}>
                <Ionicons 
                  name={isValveOpen ? "water" : "water-outline"} 
                  size={20} 
                  color={isValveOpen ? "#10B981" : "#6B7280"} 
                />
              </View>
              <View>
                <Text style={styles.valveLabel}>Water Valve</Text>
                <Text style={[styles.valveStatus, { color: isValveOpen ? '#10B981' : '#EF4444' }]}>
                  {isValveLoading ? 'Updating...' : (isValveOpen ? 'OPEN' : 'CLOSED')}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              onPress={() => toggleValve(actualDeviceId, device.name, isValveOpen, device.status)}
              disabled={isValveLoading || !isOnline}
              activeOpacity={0.7}
              style={styles.toggleButton}
            >
              <View style={[
                styles.toggleTrack,
                isValveOpen && styles.toggleTrackActive,
                !isOnline && styles.toggleTrackDisabled
              ]}>
                <View style={[
                  styles.toggleThumb,
                  isValveOpen && styles.toggleThumbActive
                ]}>
                  {isValveLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons 
                      name={isValveOpen ? "checkmark" : "close"} 
                      size={14} 
                      color="#fff" 
                    />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Offline Warning */}
          {!isOnline && (
            <View style={styles.warningBanner}>
              <Ionicons name="information-circle" size={14} color="#F59E0B" />
              <Text style={styles.warningText}>Device must be online to control valve</Text>
            </View>
          )}

          {/* Flow Rate */}
          {isValveOpen && isOnline && flowRate > 0 && (
            <View style={styles.flowRateContainer}>
              <Ionicons name="speedometer" size={16} color="#3B82F6" />
              <Text style={styles.flowRateText}>
                Flow: <Text style={styles.flowRateValue}>{flowRate.toFixed(1)} L/min</Text>
              </Text>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.flowRateText}>
                Total: <Text style={styles.flowRateValue}>{totalLitres.toFixed(2)} L</Text>
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Ionicons name="time" size={16} color="#9ca3af" />
              <Text style={styles.statLabel}>Last Seen</Text>
              <Text style={styles.statValue}>{formatLastSeen(device.lastSeen)}</Text>
            </View>

            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Ionicons name="wifi" size={16} color="#9ca3af" />
              <Text style={styles.statLabel}>Signal</Text>
              <Text style={styles.statValue}>{device.signalStrength || 'N/A'}</Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="battery-half" size={16} color="#9ca3af" />
              <Text style={styles.statLabel}>Battery</Text>
              <Text style={styles.statValue}>
                {device.batteryLevel ? `${device.batteryLevel}%` : 'N/A'}
              </Text>
            </View>

            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Ionicons name="water" size={16} color="#9ca3af" />
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statValue}>
                {totalLitres ? `${totalLitres.toFixed(0)}L` : '0L'}
              </Text>
            </View>
          </View>

          {/* GPS Location */}
          {device.gpsLocation?.latitude && device.gpsLocation?.longitude && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity 
                style={styles.gpsContainer}
                onPress={() => openLocationInMaps(
                  device.gpsLocation.latitude,
                  device.gpsLocation.longitude
                )}
                activeOpacity={0.7}
              >
                <View style={styles.gpsLeft}>
                  <View style={styles.gpsIcon}>
                    <Ionicons name="navigate" size={14} color="#10B981" />
                  </View>
                  <View>
                    <Text style={styles.gpsLabel}>GPS Location</Text>
                    <Text style={styles.gpsCoords}>
                      {device.gpsLocation.latitude.toFixed(6)}, {device.gpsLocation.longitude.toFixed(6)}
                    </Text>
                  </View>
                </View>
                <Ionicons name="open-outline" size={16} color="#10B981" />
              </TouchableOpacity>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }, [getStatusInfo, handleDeviceAction, formatLastSeen, openLocationInMaps, valveStates, valveLoading, toggleValve]);

  if (loading && user) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#030712', '#111827', '#000000']}
          style={[styles.gradient, { justifyContent: 'center', alignItems: 'center' }]}
        >
          <ActivityIndicator size="large" color="#06b6d4" />
          <Text style={styles.loadingText}>Loading device status...</Text>
        </LinearGradient>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#030712', '#111827', '#000000']}
          style={[styles.gradient, { justifyContent: 'center', alignItems: 'center' }]}
        >
          <Ionicons name="lock-closed" size={60} color="#9ca3af" />
          <Text style={styles.notAuthTitle}>Authentication Required</Text>
          <Text style={styles.notAuthSubtitle}>
            Please sign in to view device status
          </Text>
        </LinearGradient>
      </View>
    );
  }

  const filteredDevices = getFilteredDevices();
  const statusCounts = {
    all: devices.length,
    online: devices.filter(d => d.status?.toLowerCase() === 'online').length,
    offline: devices.filter(d => d.status?.toLowerCase() === 'offline').length,
    warning: devices.filter(d => d.status?.toLowerCase() === 'warning').length,
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <LinearGradient
          colors={['#030712', '#111827']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Device Status</Text>
              <Text style={styles.headerSubtitle}>
                {devices.length} device{devices.length !== 1 ? 's' : ''} connected
              </Text>
            </View>
            
            {/* Real-time Mode Card */}
            <TouchableOpacity 
              onPress={toggleRealtimeUpdates}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={realtimeEnabled ? ['#10B98120', '#10B98110'] : ['#F59E0B20', '#F59E0B10']}
                style={styles.modeCard}
              >
                <Ionicons 
                  name={realtimeEnabled ? "flash" : "battery-charging"} 
                  size={20} 
                  color={realtimeEnabled ? "#10B981" : "#F59E0B"} 
                />
                <Text style={[styles.modeText, { color: realtimeEnabled ? "#10B981" : "#F59E0B" }]}>
                  {realtimeEnabled ? "Real-time" : "Battery Saver"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* Scrollable Content */}
      <LinearGradient
        colors={['#030712', '#111827', '#000000']}
        style={styles.gradient}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={onScrollBeginDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollEndDrag={onScrollEndDrag}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor="#06b6d4"
              colors={['#06b6d4']}
            />
          }
        >
          {/* Filter Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Filter by Status</Text>
            <View style={styles.filtersGrid}>
              {[
                { key: 'all', label: 'All', icon: 'apps', color: '#3B82F6' },
                { key: 'online', label: 'Online', icon: 'checkmark-circle', color: '#10B981' },
                { key: 'offline', label: 'Offline', icon: 'close-circle', color: '#EF4444' },
                { key: 'warning', label: 'Warning', icon: 'warning', color: '#F59E0B' },
              ].map((filter, index) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterCard,
                    selectedFilter === filter.key && styles.filterCardActive
                  ]}
                  onPress={() => setSelectedFilter(filter.key)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={
                      selectedFilter === filter.key 
                        ? [`${filter.color}20`, `${filter.color}10`]
                        : ['#1f293780', '#11182780']
                    }
                    style={styles.filterGradient}
                  >
                    <View style={[styles.filterIcon, { backgroundColor: filter.color }]}>
                      <Ionicons name={filter.icon} size={20} color="#fff" />
                    </View>
                    <Text style={[
                      styles.filterCount,
                      selectedFilter === filter.key && styles.filterTextActive
                    ]}>
                      {statusCounts[filter.key]}
                    </Text>
                    <Text style={[
                      styles.filterLabel,
                      selectedFilter === filter.key && styles.filterTextActive
                    ]}>
                      {filter.label}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Devices Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {selectedFilter === 'all' ? 'All Devices' : `${selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1)} Devices`}
              </Text>
              {filteredDevices.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{filteredDevices.length}</Text>
                </View>
              )}
            </View>
            
            {filteredDevices.length > 0 ? (
              filteredDevices.map((device, index) => renderDeviceCard(device, index))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons 
                  name={selectedFilter === 'all' ? 'water-outline' : 'search-outline'} 
                  size={60} 
                  color="#37415180" 
                />
                <Text style={styles.emptyStateText}>
                  {selectedFilter === 'all' ? 'No Devices Connected' : `No ${selectedFilter} Devices`}
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  {selectedFilter === 'all' 
                    ? 'Tap "Add Device" to get started'
                    : `No devices with ${selectedFilter} status found`
                  }
                </Text>
                {selectedFilter === 'all' && (
                  <TouchableOpacity 
                    style={styles.addButton}
                    onPress={() => navigation.navigate('QRScan')}
                  >
                    <LinearGradient
                      colors={['#06b6d4', '#0891b2']}
                      style={styles.addButtonGradient}
                    >
                      <Ionicons name="qr-code" size={20} color="#fff" />
                      <Text style={styles.addButtonText}>Add Your First Device</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 140,
    paddingBottom: 20,
  },
  
  // Fixed Header
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
},
headerTitle: {
fontSize: 24,
fontWeight: 'bold',
color: '#fff',
marginBottom: 4,
},
headerSubtitle: {
fontSize: 14,
color: '#9ca3af',
},
// Real-time Mode Card
modeCard: {
flexDirection: 'row',
alignItems: 'center',
paddingHorizontal: 16,
paddingVertical: 10,
borderRadius: 12,
borderWidth: 1,
borderColor: '#37415140',
},
modeText: {
fontSize: 13,
fontWeight: '600',
marginLeft: 8,
},
// Section
section: {
marginBottom: 30,
},
sectionHeader: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
marginBottom: 16,
},
sectionTitle: {
fontSize: 20,
fontWeight: 'bold',
color: '#fff',
marginBottom: 16,
},
countBadge: {
backgroundColor: '#06b6d420',
paddingHorizontal: 12,
paddingVertical: 4,
borderRadius: 12,
borderWidth: 1,
borderColor: '#06b6d440',
},
countBadgeText: {
fontSize: 12,
color: '#06b6d4',
fontWeight: '600',
},
// Filters
filtersGrid: {
flexDirection: 'row',
flexWrap: 'wrap',
gap: 12,
},
filterCard: {
width: (width - 52) / 2,
borderRadius: 16,
overflow: 'hidden',
},
filterCardActive: {
shadowColor: '#06b6d4',
shadowOffset: { width: 0, height: 4 },
shadowOpacity: 0.3,
shadowRadius: 8,
elevation: 4,
},
filterGradient: {
padding: 16,
alignItems: 'center',
borderWidth: 1,
borderColor: '#37415140',
borderRadius: 16,
},
filterIcon: {
width: 44,
height: 44,
borderRadius: 22,
justifyContent: 'center',
alignItems: 'center',
marginBottom: 10,
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.3,
shadowRadius: 4,
elevation: 3,
},
filterCount: {
fontSize: 20,
fontWeight: 'bold',
color: '#fff',
marginBottom: 4,
},
filterLabel: {
fontSize: 12,
color: '#9ca3af',
fontWeight: '600',
},
filterTextActive: {
color: '#fff',
},
// Device Card
deviceCard: {
marginBottom: 16,
borderRadius: 16,
overflow: 'hidden',
},
deviceCardGradient: {
padding: 16,
borderWidth: 1,
borderColor: '#37415140',
borderRadius: 16,
},
deviceHeader: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'flex-start',
marginBottom: 12,
},
deviceHeaderLeft: {
flexDirection: 'row',
alignItems: 'flex-start',
flex: 1,
},
statusIndicator: {
width: 48,
height: 48,
borderRadius: 24,
justifyContent: 'center',
alignItems: 'center',
marginRight: 12,
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.4,
shadowRadius: 6,
elevation: 4,
},
deviceInfo: {
flex: 1,
paddingTop: 2,
},
deviceName: {
fontSize: 18,
fontWeight: 'bold',
color: '#fff',
marginBottom: 6,
},
statusBadge: {
flexDirection: 'row',
alignItems: 'center',
backgroundColor: '#1f293780',
paddingHorizontal: 10,
paddingVertical: 5,
borderRadius: 12,
alignSelf: 'flex-start',
},
statusDot: {
width: 6,
height: 6,
borderRadius: 3,
marginRight: 6,
},
statusText: {
fontSize: 12,
fontWeight: '600',
},
locationRow: {
flexDirection: 'row',
alignItems: 'center',
marginBottom: 16,
},
locationText: {
fontSize: 14,
color: '#9ca3af',
marginLeft: 6,
fontWeight: '500',
},
divider: {
height: 1,
backgroundColor: '#37415140',
marginVertical: 16,
},
// Valve Control
valveContainer: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
backgroundColor: '#1f293780',
padding: 14,
borderRadius: 14,
borderWidth: 1,
borderColor: '#37415140',
},
valveLeft: {
flexDirection: 'row',
alignItems: 'center',
flex: 1,
},
valveIconContainer: {
width: 40,
height: 40,
borderRadius: 20,
backgroundColor: '#06b6d420',
justifyContent: 'center',
alignItems: 'center',
marginRight: 12,
borderWidth: 1,
borderColor: '#06b6d440',
},
valveLabel: {
fontSize: 13,
color: '#9ca3af',
marginBottom: 3,
fontWeight: '600',
},
valveStatus: {
fontSize: 16,
fontWeight: '700',
},
toggleButton: {
padding: 4,
},
toggleTrack: {
width: 56,
height: 30,
borderRadius: 15,
backgroundColor: '#EF444420',
borderWidth: 2,
borderColor: '#EF4444',
padding: 2,
justifyContent: 'center',
},
toggleTrackActive: {
backgroundColor: '#10B98120',
borderColor: '#10B981',
},
toggleTrackDisabled: {
opacity: 0.4,
backgroundColor: '#6B728020',
borderColor: '#6B7280',
},
toggleThumb: {
width: 22,
height: 22,
borderRadius: 11,
backgroundColor: '#EF4444',
justifyContent: 'center',
alignItems: 'center',
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.3,
shadowRadius: 3,
elevation: 3,
},
toggleThumbActive: {
backgroundColor: '#10B981',
alignSelf: 'flex-end',
},
warningBanner: {
flexDirection: 'row',
alignItems: 'center',
marginTop: 12,
paddingHorizontal: 12,
paddingVertical: 8,
backgroundColor: '#F59E0B20',
borderRadius: 10,
borderWidth: 1,
borderColor: '#F59E0B40',
},
warningText: {
fontSize: 12,
color: '#F59E0B',
marginLeft: 8,
fontWeight: '600',
flex: 1,
},
flowRateContainer: {
flexDirection: 'row',
alignItems: 'center',
marginTop: 12,
paddingHorizontal: 12,
paddingVertical: 8,
backgroundColor: '#3B82F620',
borderRadius: 10,
borderWidth: 1,
borderColor: '#3B82F640',
},
flowRateText: {
fontSize: 12,
color: '#9ca3af',
marginLeft: 8,
fontWeight: '600',
},
flowRateValue: {
color: '#3B82F6',
fontWeight: '700',
},
separator: {
fontSize: 12,
color: '#6B7280',
marginHorizontal: 8,
},
// Stats Grid
statsGrid: {
flexDirection: 'row',
flexWrap: 'wrap',
},
statBox: {
width: '50%',
alignItems: 'center',
paddingVertical: 12,
},
statBoxBorder: {
borderLeftWidth: 1,
borderLeftColor: '#37415140',
},
statLabel: {
fontSize: 11,
color: '#9ca3af',
marginTop: 6,
marginBottom: 4,
fontWeight: '600',
},
statValue: {
fontSize: 15,
fontWeight: '700',
color: '#fff',
},
// GPS
gpsContainer: {
flexDirection: 'row',
alignItems: 'center',
justifyContent: 'space-between',
backgroundColor: '#10B98120',
padding: 12,
borderRadius: 12,
borderWidth: 1,
borderColor: '#10B98140',
},
gpsLeft: {
flexDirection: 'row',
alignItems: 'center',
flex: 1,
},
gpsIcon: {
width: 32,
height: 32,
borderRadius: 16,
backgroundColor: '#10B98140',
justifyContent: 'center',
alignItems: 'center',
marginRight: 10,
},
gpsLabel: {
fontSize: 12,
fontWeight: '600',
color: '#10B981',
marginBottom: 2,
},
gpsCoords: {
fontSize: 11,
color: '#10B981',
fontFamily: 'monospace',
fontWeight: '500',
},
// Empty State
emptyState: {
alignItems: 'center',
padding: 40,
backgroundColor: '#1f293780',
borderRadius: 16,
borderWidth: 1,
borderColor: '#37415140',
},
emptyStateText: {
fontSize: 18,
fontWeight: 'bold',
color: '#fff',
marginTop: 16,
},
emptyStateSubtext: {
fontSize: 14,
color: '#9ca3af',
marginTop: 8,
textAlign: 'center',
},
addButton: {
marginTop: 20,
borderRadius: 12,
overflow: 'hidden',
},
addButtonGradient: {
flexDirection: 'row',
alignItems: 'center',
paddingHorizontal: 20,
paddingVertical: 12,
},
addButtonText: {
color: '#fff',
fontSize: 14,
fontWeight: 'bold',
marginLeft: 8,
},
// Loading States
loadingText: {
color: '#9ca3af',
fontSize: 16,
marginTop: 16,
},
notAuthTitle: {
fontSize: 22,
fontWeight: 'bold',
color: '#fff',
marginTop: 20,
textAlign: 'center',
},
notAuthSubtitle: {
fontSize: 16,
color: '#9ca3af',
marginTop: 10,
textAlign: 'center',
paddingHorizontal: 40,
},
});

export default StatusScreen;