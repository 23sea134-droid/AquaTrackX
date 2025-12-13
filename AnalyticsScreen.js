import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getAuth } from 'firebase/auth';

// Import Firebase database
import { getDatabase, ref, query, orderByChild, limitToLast, onValue, off, get, startAt, endAt } from 'firebase/database';

// Import device service for proper data access
import { deviceService } from '../services/deviceService';

// Import TabBar context for auto-hide functionality
import { useTabBar } from '../context/TabBarContext';
import { useScrollHandler } from '../hooks/useScrollHandler';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const AnalyticsScreen = ({ navigation, route }) => {
  const [activeTab, setActiveTab] = useState('D');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [error, setError] = useState(null);

  const auth = getAuth();
  
  // Get Firebase database instance
  const database = getDatabase();

  // Add TabBar context for auto-hide functionality
  const { showTabBar } = useTabBar();
  
  // Add scroll handler for auto-hide navigation bar
  const { 
    handleScroll, 
    onScrollBeginDrag,
    onMomentumScrollEnd,
    onScrollEndDrag 
  } = useScrollHandler();

  // Show tab bar when screen is focused
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => showTabBar(), 100);
      return () => clearTimeout(timer);
    }, [showTabBar])
  );

  // Fetch all user devices using deviceService
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const userId = auth.currentUser?.uid;
        
        if (!userId) {
          Alert.alert('Error', 'Please login to view analytics');
          navigation.goBack();
          return;
        }

        // Use deviceService to get user devices
        const response = await deviceService.getUserDevices(userId);
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch devices');
        }

        const devicesList = response.devices || [];
        
        if (devicesList.length === 0) {
          Alert.alert('No Device', 'Please add a device first');
          navigation.goBack();
          return;
        }

        setDevices(devicesList);
        
        // Set first device as selected by default
        setSelectedDevice(devicesList[0]);
        
      } catch (error) {
        console.error('❌ Error fetching devices:', error);
        setError('Failed to load devices: ' + error.message);
        Alert.alert('Error', 'Failed to load device information');
      }
    };

    fetchDevices();
  }, []);

  // Fetch historical data when device or tab changes
  useEffect(() => {
    if (!selectedDevice) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // CRITICAL FIX: Use deviceId not id
        const fetchedData = await fetchDataFromFirebase(activeTab, selectedDevice.deviceId);
        setData(fetchedData);
      } catch (error) {
        console.error('❌ Error loading data:', error);
        setError('Failed to load analytics: ' + error.message);
        
        // Set empty data so UI can render
        const now = new Date();
        setData(createEmptyData(activeTab, now.toLocaleDateString()));
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [activeTab, selectedDevice, database]);

  // Fetch data directly from Firebase history
  const fetchDataFromFirebase = async (period, deviceId) => {
    const now = new Date();
    let timeRange, dateLabel, startTime, endTime;
    
    switch(period) {
      case 'D': // Today - last 24 hours
        timeRange = 24 * 60 * 60 * 1000;
        dateLabel = `Today - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        startTime = now.getTime() - timeRange;
        endTime = now.getTime();
        break;
      case 'W': // This week - last 7 days
        timeRange = 7 * 24 * 60 * 60 * 1000;
        dateLabel = 'This Week';
        startTime = now.getTime() - timeRange;
        endTime = now.getTime();
        break;
      case 'M': // This month - last 30 days
        timeRange = 30 * 24 * 60 * 60 * 1000;
        dateLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        startTime = now.getTime() - timeRange;
        endTime = now.getTime();
        break;
      case 'Y': // This year - last 12 months
        timeRange = 365 * 24 * 60 * 60 * 1000;
        dateLabel = now.getFullYear().toString();
        startTime = now.getTime() - timeRange;
        endTime = now.getTime();
        break;
      default:
        timeRange = 24 * 60 * 60 * 1000;
        dateLabel = now.toLocaleDateString();
        startTime = now.getTime() - timeRange;
        endTime = now.getTime();
    }

    try {
      console.log('📊 Fetching history for device:', deviceId);
      console.log('📊 Time range:', new Date(startTime).toISOString(), 'to', new Date(endTime).toISOString());
      
      const historyRef = ref(database, `history/${deviceId}`);
      
      // ✅ USE TIME-BASED QUERY (more efficient)
      const historyQuery = query(
        historyRef,
        orderByChild('timestamp'),
        startAt(startTime),
        endAt(endTime)
      );

      const snapshot = await get(historyQuery);
      
      if (!snapshot.exists()) {
        console.log('ℹ️ No history data found for time range');
        return createEmptyData(period, dateLabel);
      }

      const historyData = [];
      snapshot.forEach((childSnapshot) => {
        const record = childSnapshot.val();
        // Double-check timestamp is in range (Firebase sometimes includes boundary records)
        if (record.timestamp >= startTime && record.timestamp <= endTime) {
          historyData.push(record);
        }
      });

      if (historyData.length === 0) {
        console.log('ℹ️ No history data in time range after filtering');
        return createEmptyData(period, dateLabel);
      }

      console.log('✅ Retrieved', historyData.length, 'history records');

      // Sort by timestamp
      historyData.sort((a, b) => a.timestamp - b.timestamp);

      return processHistoryData(historyData, period, dateLabel, startTime, endTime);
    } catch (error) {
      console.error('❌ Firebase fetch error:', error);
      throw error;
    }
  };

  const processHistoryData = (historyData, period, dateLabel, startTime, endTime) => {
    let chartData = [];
    let totalUsage = 0;
    let flowRates = [];
    let peakFlow = 0;
    let duration = 0;

    // Calculate total usage from first and last records
    if (historyData.length > 1) {
      totalUsage = historyData[historyData.length - 1].totalLitres - historyData[0].totalLitres;
    }

    switch(period) {
      case 'D': // Hourly breakdown
        chartData = Array.from({ length: 24 }, (_, hour) => ({
          label: hour === 0 ? '12 AM' : hour === 6 ? '6 AM' : hour === 12 ? '12 PM' : hour === 18 ? '6 PM' : '',
          hour,
          usage: 0,
          startTotal: null,
          endTotal: null
        }));

        historyData.forEach(entry => {
          const date = new Date(entry.timestamp);
          const hour = date.getHours();
          
          // Track first and last totalLitres reading for each hour
          if (chartData[hour].startTotal === null) {
            chartData[hour].startTotal = entry.totalLitres;
          }
          chartData[hour].endTotal = entry.totalLitres;
          
          // Still collect flow rates for stats
          flowRates.push(entry.flowRate);
          if (entry.flowRate > peakFlow) peakFlow = entry.flowRate;
        });

        // Calculate actual usage per hour
        chartData = chartData.map(item => ({
          ...item,
          usage: item.startTotal !== null && item.endTotal !== null 
            ? Math.max(0, item.endTotal - item.startTotal)
            : 0
        }));
        break;

      case 'W': // Daily breakdown
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        chartData = daysOfWeek.map((day, index) => ({
          label: day,
          usage: 0,
          startTotal: null,
          endTotal: null
        }));

        historyData.forEach(entry => {
          const date = new Date(entry.timestamp);
          const dayIndex = date.getDay();
          
          if (chartData[dayIndex].startTotal === null) {
            chartData[dayIndex].startTotal = entry.totalLitres;
          }
          chartData[dayIndex].endTotal = entry.totalLitres;
          
          flowRates.push(entry.flowRate);
          if (entry.flowRate > peakFlow) peakFlow = entry.flowRate;
        });

        chartData = chartData.map(item => ({
          ...item,
          usage: item.startTotal !== null && item.endTotal !== null 
            ? Math.max(0, item.endTotal - item.startTotal)
            : 0
        }));
        break;

      case 'M': // Daily breakdown for month
        const daysInMonth = new Date().getDate();
        chartData = Array.from({ length: daysInMonth }, (_, day) => ({
          label: (day + 1).toString(),
          day: day + 1,
          usage: 0,
          startTotal: null,
          endTotal: null
        }));

        historyData.forEach(entry => {
          const date = new Date(entry.timestamp);
          const day = date.getDate() - 1;
          if (day >= 0 && day < daysInMonth) {
            if (chartData[day].startTotal === null) {
              chartData[day].startTotal = entry.totalLitres;
            }
            chartData[day].endTotal = entry.totalLitres;
            
            flowRates.push(entry.flowRate);
            if (entry.flowRate > peakFlow) peakFlow = entry.flowRate;
          }
        });

        chartData = chartData.map(item => ({
          ...item,
          usage: item.startTotal !== null && item.endTotal !== null 
            ? Math.max(0, item.endTotal - item.startTotal)
            : 0
        }));
        break;

      case 'Y': // Monthly breakdown
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        chartData = months.map((month, index) => ({
          label: month,
          usage: 0,
          startTotal: null,
          endTotal: null
        }));

        historyData.forEach(entry => {
          const date = new Date(entry.timestamp);
          const monthIndex = date.getMonth();
          
          if (chartData[monthIndex].startTotal === null) {
            chartData[monthIndex].startTotal = entry.totalLitres;
          }
          chartData[monthIndex].endTotal = entry.totalLitres;
          
          flowRates.push(entry.flowRate);
          if (entry.flowRate > peakFlow) peakFlow = entry.flowRate;
        });

        chartData = chartData.map(item => ({
          ...item,
          usage: item.startTotal !== null && item.endTotal !== null 
            ? Math.max(0, item.endTotal - item.startTotal)
            : 0
        }));
        break;
    }

    const averageFlow = flowRates.length > 0 
      ? flowRates.reduce((sum, rate) => sum + rate, 0) / flowRates.length 
      : 0;

    // Calculate duration in hours
    duration = Math.floor((endTime - startTime) / (1000 * 60 * 60));

    // Calculate comparison with previous period (mock for now)
    const comparison = { value: 12.5, trend: 'up' };

    return {
      date: dateLabel,
      totalUsage: Math.max(0, totalUsage),
      averageFlow: Math.max(0, averageFlow),
      peakFlow: Math.max(0, peakFlow),
      duration,
      comparison,
      chartData
    };
  };

  const createEmptyData = (period, dateLabel) => {
    let chartData = [];
    
    switch(period) {
      case 'D':
        chartData = Array.from({ length: 24 }, (_, hour) => ({
          label: hour === 0 ? '12 AM' : hour === 6 ? '6 AM' : hour === 12 ? '12 PM' : hour === 18 ? '6 PM' : '',
          hour,
          usage: 0
        }));
        break;
      case 'W':
        chartData = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => ({
          label: day,
          usage: 0
        }));
        break;
      case 'M':
        // Get actual days in current month
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        chartData = Array.from({ length: daysInMonth }, (_, day) => ({
          label: (day + 1).toString(),
          day: day + 1,
          usage: 0
        }));
        break;
      case 'Y':
        chartData = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => ({
          label: month,
          usage: 0
        }));
        break;
    }

    return {
      date: dateLabel,
      totalUsage: 0,
      averageFlow: 0,
      peakFlow: 0,
      duration: 0,
      comparison: { value: 0, trend: 'up' },
      chartData
    };
  };

  const exportToPDF = async () => {
    if (!data || !selectedDevice) return;

    try {
      const chartDataRows = data.chartData
        .map((item, idx) => `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${item.label || item.hour || idx + 1}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${item.usage.toFixed(1)} L</td>
          </tr>
        `)
        .join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 40px;
                color: #333;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 3px solid #06b6d4;
                padding-bottom: 20px;
              }
              .title {
                font-size: 32px;
                color: #06b6d4;
                margin: 0;
              }
              .subtitle {
                font-size: 18px;
                color: #666;
                margin-top: 10px;
              }
              .device-info {
                background: #f0f9ff;
                border: 2px solid #06b6d4;
                border-radius: 12px;
                padding: 15px;
                margin: 20px 0;
              }
              .stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
                margin: 30px 0;
              }
              .stat-card {
                background: #f0f9ff;
                border: 2px solid #06b6d4;
                border-radius: 12px;
                padding: 20px;
              }
              .stat-title {
                font-size: 12px;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 8px;
              }
              .stat-value {
                font-size: 28px;
                font-weight: bold;
                color: #06b6d4;
              }
              .table-container {
                margin: 30px 0;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
              }
              th {
                background-color: #06b6d4;
                color: white;
                padding: 12px;
                text-align: left;
                font-size: 14px;
              }
              td {
                padding: 8px;
                border: 1px solid #ddd;
              }
              tr:nth-child(even) {
                background-color: #f9f9f9;
              }
              .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 12px;
                color: #999;
                border-top: 1px solid #ddd;
                padding-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 class="title">Water Usage Analytics Report</h1>
              <p class="subtitle">${data.date}</p>
            </div>

            <div class="device-info">
              <strong>Device:</strong> ${selectedDevice.name}<br>
              <strong>Location:</strong> ${selectedDevice.location}<br>
              <strong>Device ID:</strong> ${selectedDevice.deviceId}
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-title">Total Usage</div>
                <div class="stat-value">${activeTab === 'Y' ? `${(data.totalUsage / 1000).toFixed(1)}k` : data.totalUsage.toFixed(1)} L</div>
              </div>
              <div class="stat-card">
                <div class="stat-title">Average Flow</div>
                <div class="stat-value">${data.averageFlow.toFixed(1)} L/min</div>
              </div>
              <div class="stat-card">
                <div class="stat-title">Peak Flow</div>
                <div class="stat-value">${data.peakFlow.toFixed(1)} L/min</div>
              </div>
              <div class="stat-card">
                <div class="stat-title">Duration</div>
                <div class="stat-value">${activeTab === 'Y' || activeTab === 'M' ? `${Math.floor(data.duration / 60)}h` : `${data.duration}m`}</div>
              </div>
            </div>

            <div class="table-container">
              <h2 style="color: #06b6d4;">Detailed Breakdown</h2>
              <table>
                <thead>
                  <tr>
                    <th>${activeTab === 'D' ? 'Time' : activeTab === 'W' ? 'Day' : activeTab === 'M' ? 'Date' : 'Month'}</th>
                    <th style="text-align: right;">Usage (L)</th>
                  </tr>
                </thead>
                <tbody>
                  ${chartDataRows}
                </tbody>
              </table>
            </div>

            <div class="table-container">
              <h2 style="color: #06b6d4;">Summary Statistics</h2>
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th style="text-align: right;">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">Highest Usage</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.max(...data.chartData.map(d => d.usage)).toFixed(1)} L</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">Average Usage</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${(data.chartData.reduce((sum, d) => sum + d.usage, 0) / data.chartData.length).toFixed(1)} L</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">Lowest Usage</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.min(...data.chartData.map(d => d.usage)).toFixed(1)} L</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="footer">
              <p>Generated on ${new Date().toLocaleString()}</p>
              <p>Water Usage Analytics System</p>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Water Usage Report',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Success', 'PDF Report generated successfully!');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF report. Please try again.');
    }
  };

  const DeviceSelectorModal = () => (
    <Modal
      visible={showDeviceModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDeviceModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Device</Text>
              <TouchableOpacity onPress={() => setShowDeviceModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.deviceList}>
              {devices.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  style={[
                    styles.deviceItem,
                    selectedDevice?.id === device.id && styles.selectedDeviceItem
                  ]}
                  onPress={() => {
                    setSelectedDevice(device);
                    setShowDeviceModal(false);
                  }}
                >
                  <View style={styles.deviceItemIcon}>
                    <Ionicons 
                      name="water" 
                      size={24} 
                      color={selectedDevice?.id === device.id ? '#06b6d4' : '#9ca3af'} 
                    />
                  </View>
                  <View style={styles.deviceItemContent}>
                    <Text style={[
                      styles.deviceItemName,
                      selectedDevice?.id === device.id && styles.selectedDeviceText
                    ]}>
                      {device.name}
                    </Text>
                    <Text style={styles.deviceItemLocation}>{device.location}</Text>
                  </View>
                  {selectedDevice?.id === device.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#06b6d4" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  const StatCard = ({ icon, title, value, unit, gradient, comparison }) => (
    <LinearGradient
      colors={gradient}
      style={styles.statCard}
    >
      <View style={styles.statHeader}>
        <View style={[styles.iconContainer, { backgroundColor: gradient[0] + '33' }]}>
          <Ionicons name={icon} size={20} color={gradient[0].replace('20', '')} />
        </View>
        {comparison && comparison.value > 0 && (
          <View style={styles.comparisonBadge}>
            <Ionicons 
              name={comparison.trend === 'up' ? 'trending-up' : 'trending-down'} 
              size={12} 
              color={comparison.trend === 'up' ? '#f87171' : '#4ade80'} 
            />
            <Text style={[styles.comparisonText, { 
              color: comparison.trend === 'up' ? '#f87171' : '#4ade80' 
            }]}>
              {comparison.value}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.statTitle}>{title}</Text>
      <View style={styles.statValueContainer}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statUnit}>{unit}</Text>
      </View>
    </LinearGradient>
  );

  const BarChart = () => {
    if (!data) return null;
    
    const chartHeight = 280; // Increased from 200
    const maxValue = Math.max(...data.chartData.map(d => d.usage), 1);
    
    // Calculate nice round numbers for Y-axis matching screenshots
    const getYAxisLabels = () => {
      let topValue = maxValue;
      
      // Round up to nice numbers based on magnitude
      if (topValue <= 1) {
        topValue = 1;
      } else if (topValue <= 2) {
        topValue = 2;
      } else if (topValue <= 3) {
        topValue = 3;
      } else if (topValue <= 5) {
        topValue = 5;
      } else {
        // Round to nearest whole number or 5
        topValue = Math.ceil(topValue);
      }
      
      return [topValue, topValue * 0.5, 0];
    };

    const yAxisLabels = getYAxisLabels();
    const chartMaxValue = yAxisLabels[0];
    
    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Usage Pattern</Text>
          <Text style={styles.chartSubtitle}>
            {activeTab === 'D' ? 'Hourly breakdown' :
             activeTab === 'W' ? 'Daily breakdown' :
             activeTab === 'M' ? 'Daily breakdown' : 'Monthly breakdown'}
          </Text>
        </View>

        {/* Chart area - direct, no inner card */}
        <View style={styles.chartWrapper}>
          {/* Chart area */}
          <View style={styles.chartArea}>
            {/* Horizontal Grid lines */}
            <View style={styles.gridContainer}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.gridLine} />
              ))}
            </View>

            {/* Vertical dotted lines */}
            <View style={styles.verticalGridContainer}>
              {data.chartData.map((item, idx) => {
                // Show vertical line for labeled items
                let showLine = false;
                
                if (activeTab === 'M') {
                  const day = item.day || parseInt(item.label);
                  showLine = [1, 8, 15, 22, 29].includes(day);
                } else if (activeTab === 'D') {
                  showLine = item.label && item.label !== '';
                } else if (activeTab === 'W' || activeTab === 'Y') {
                  showLine = true; // Show for all in week and year
                }
                
                return (
                  <View key={idx} style={styles.verticalGridWrapper}>
                    {showLine && (
                      <View style={styles.verticalGridLine}>
                        {/* Create dotted effect with small segments */}
                        {[...Array(28)].map((_, i) => (
                          <View key={i} style={styles.dottedSegment} />
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Bars */}
            <View style={styles.barsContainer}>
              {data.chartData.map((item, idx) => {
                const heightPercent = chartMaxValue > 0 ? (item.usage / chartMaxValue) : 0;
                
                return (
                  <View key={idx} style={styles.barWrapper}>
                    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                      {item.usage > 0 && (
                        <LinearGradient
                          colors={['#22d3ee', '#06b6d4', '#0891b2']}
                          style={[
                            styles.bar,
                            { height: Math.max(chartHeight * heightPercent, 3) }
                          ]}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* X-axis labels */}
            <View style={styles.xAxisContainer}>
              {data.chartData.map((item, idx) => {
                let showLabel = '';
                
                // For monthly view, show only days: 1, 8, 15, 22, 29
                if (activeTab === 'M') {
                  const day = item.day || parseInt(item.label);
                  if ([1, 8, 15, 22, 29].includes(day)) {
                    showLabel = day.toString();
                  }
                }
                // For daily view, only show labeled hours (12 AM, 6 AM, 12 PM, 6 PM)
                else if (activeTab === 'D') {
                  if (item.label && item.label !== '') {
                    showLabel = item.label;
                  }
                }
                // For week and year, show all labels
                else {
                  showLabel = item.label;
                }
                
                return (
                  <Text key={idx} style={styles.xAxisLabel}>
                    {showLabel}
                  </Text>
                );
              })}
            </View>
          </View>

          {/* Y-axis labels on right */}
          <View style={styles.yAxisContainer}>
            {yAxisLabels.map((value, i) => (
              <Text key={i} style={styles.yAxisLabel}>
                {value.toFixed(2)}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  };

  if (loading && devices.length > 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#030712', '#111827', '#000000']}
          style={[styles.gradient, { justifyContent: 'center', alignItems: 'center' }]}
        >
          <ActivityIndicator size="large" color="#06b6d4" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
          {selectedDevice && (
            <Text style={[styles.loadingText, { fontSize: 14, marginTop: 8 }]}>
              Device: {selectedDevice.name}
            </Text>
          )}
        </LinearGradient>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#030712', '#111827', '#000000']}
          style={[styles.gradient, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}
        >
          <Ionicons name="alert-circle" size={64} color="#ef4444" />
          <Text style={[styles.loadingText, { color: '#ef4444', fontSize: 18, marginTop: 16 }]}>
            Error Loading Data
          </Text>
          <Text style={[styles.loadingText, { textAlign: 'center', marginTop: 8 }]}>
            {error}
          </Text>
          <TouchableOpacity 
            style={{ marginTop: 20, backgroundColor: '#06b6d4', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go Back</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  if (!data) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Fixed Header - Matches HomeScreen */}
      <View style={styles.fixedHeader}>
        <LinearGradient
          colors={['#030712', '#111827']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Analytics</Text>
              <Text style={styles.headerSubtitle}>{data.date}</Text>
            </View>
            
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>
      </View>

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
        >
          {/* Device Selector */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Device Analytics</Text>
              {devices.length > 0 && (
                <View style={styles.deviceCountBadge}>
                  <Text style={styles.deviceCountText}>{devices.length}</Text>
                </View>
              )}
            </View>
            
            {devices.length > 1 && selectedDevice && (
              <TouchableOpacity 
                style={styles.deviceSelector}
                onPress={() => setShowDeviceModal(true)}
              >
                <LinearGradient
                  colors={['#1f293780', '#11182780']}
                  style={styles.deviceCardGradient}
                >
                  <View style={styles.deviceHeader}>
                    <View style={styles.deviceIconContainer}>
                      <Ionicons name="water" size={24} color="#06b6d4" />
                    </View>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{selectedDevice.name}</Text>
                      <Text style={styles.deviceLocation}>{selectedDevice.location}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={20} color="#9ca3af" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Single Device Display */}
            {devices.length === 1 && selectedDevice && (
              <View style={styles.deviceSelector}>
                <LinearGradient
                  colors={['#1f293780', '#11182780']}
                  style={styles.deviceCardGradient}
                >
                  <View style={styles.deviceHeader}>
                    <View style={styles.deviceIconContainer}>
                      <Ionicons name="water" size={24} color="#06b6d4" />
                    </View>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{selectedDevice.name}</Text>
                      <Text style={styles.deviceLocation}>{selectedDevice.location}</Text>
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                  </View>
                </LinearGradient>
              </View>
            )}
          </View>

          {/* Time Period Tabs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time Period</Text>
            <View style={styles.tabsContainer}>
              {[
                { key: 'D', label: 'Day' },
                { key: 'W', label: 'Week' },
                { key: 'M', label: 'Month' },
                { key: 'Y', label: 'Year' }
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tab,
                    activeTab === tab.key && styles.activeTab
                  ]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[
                    styles.tabText,
                    activeTab === tab.key && styles.activeTabText
                  ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.statsGrid}>
              <StatCard
                icon="water"
                title="Total Usage"
                value={activeTab === 'Y' ? `${(data.totalUsage / 1000).toFixed(1)}k` : data.totalUsage.toFixed(1)}
                unit="L"
                gradient={['#06b6d420', '#0284c720']}
                comparison={data.comparison}
              />
              <StatCard
                icon="flash"
                title="Avg Flow"
                value={data.averageFlow.toFixed(1)}
                unit="L/min"
                gradient={['#a78bfa20', '#c084fc20']}
              />
              <StatCard
                icon="trending-up"
                title="Peak Flow"
                value={data.peakFlow.toFixed(1)}
                unit="L/min"
                gradient={['#f97316420', '#dc262620']}
              />
              <StatCard
                icon="time"
                title="Duration"
                value={activeTab === 'Y' || activeTab === 'M'
                  ? `${Math.floor(data.duration / 60)}h`
                  : `${data.duration}m`}
                unit=""
                gradient={['#10b98120', '#059e6a20']}
              />
            </View>
          </View>

          {/* Bar Chart */}
          <View style={styles.section}>
            <BarChart />
          </View>

          {/* Usage Statistics Card */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Usage Statistics</Text>
            <View style={styles.usageStatsCard}>
              <View style={styles.usageStatItem}>
                <View style={styles.usageStatHeader}>
                  <View style={[styles.usageStatDot, { backgroundColor: '#22d3ee' }]} />
                  <Text style={styles.usageStatLabel}>Highest</Text>
                </View>
                <Text style={[styles.usageStatValue, { color: '#22d3ee' }]}>
                  {Math.max(...data.chartData.map(d => d.usage)).toFixed(1)}L
                </Text>
              </View>
              
              <View style={styles.usageStatDivider} />
              
              <View style={styles.usageStatItem}>
                <View style={styles.usageStatHeader}>
                  <View style={[styles.usageStatDot, { backgroundColor: '#a78bfa' }]} />
                  <Text style={styles.usageStatLabel}>Average</Text>
                </View>
                <Text style={[styles.usageStatValue, { color: '#a78bfa' }]}>
                  {(data.chartData.reduce((sum, d) => sum + d.usage, 0) / data.chartData.length).toFixed(1)}L
                </Text>
              </View>
              
              <View style={styles.usageStatDivider} />
              
              <View style={styles.usageStatItem}>
                <View style={styles.usageStatHeader}>
                  <View style={[styles.usageStatDot, { backgroundColor: '#4ade80' }]} />
                  <Text style={styles.usageStatLabel}>Lowest</Text>
                </View>
                <Text style={[styles.usageStatValue, { color: '#4ade80' }]}>
                  {Math.min(...data.chartData.map(d => d.usage)).toFixed(1)}L
                </Text>
              </View>
            </View>
          </View>

          {/* Export Button */}
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.exportButton} 
              onPress={exportToPDF}
              disabled={!data || data.totalUsage === 0}
            >
              <LinearGradient
                colors={data && data.totalUsage > 0 ? ['#06b6d4', '#0891b2'] : ['#4b5563', '#374151']}
                style={styles.exportGradient}
              >
                <Ionicons name="download-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.exportText}>Export Data Report</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
        
        {/* Device Selector Modal */}
        <DeviceSelectorModal />
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
  
  // Fixed Header - Matches HomeScreen
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
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1f293780',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  
  // Section Styles
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
  deviceCountBadge: {
    backgroundColor: '#06b6d420',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#06b6d440',
  },
  deviceCountText: {
    fontSize: 12,
    color: '#06b6d4',
    fontWeight: '600',
  },
  
  // Device Selector
  deviceSelector: {
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
    alignItems: 'center',
  },
  deviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#06b6d420',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#06b6d440',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  deviceLocation: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1f293750',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#37415150',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#06b6d4',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9ca3af',
  },
  activeTabText: {
    color: '#fff',
  },
  
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (width - 52) / 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#06b6d440',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  comparisonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statTitle: {
    fontSize: 10,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statUnit: {
    fontSize: 14,
    color: '#9ca3af',
    marginLeft: 4,
  },
  
  // Chart
  chartContainer: {
    backgroundColor: '#1f293780',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  chartHeader: {
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#d1d5db',
    fontWeight: '500',
  },
  chartWrapper: {
    flexDirection: 'row',
    paddingTop: 10,
  },
  yAxisContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: 280, // Updated from 200
    marginLeft: 8,
    paddingTop: 4,
  },
  yAxisLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9ca3af',
    textAlign: 'right',
  },
  chartArea: {
    flex: 1,
  },
  gridContainer: {
    height: 280, // Updated from 200
    justifyContent: 'space-between',
  },
  gridLine: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  verticalGridContainer: {
    position: 'absolute',
    flexDirection: 'row',
    height: 280, // Updated from 200
    width: '100%',
    justifyContent: 'space-between',
  },
  verticalGridWrapper: {
    flex: 1,
    height: 280, // Updated from 200
    alignItems: 'center',
  },
  verticalGridLine: {
    width: 1,
    height: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  dottedSegment: {
    width: 1,
    height: 6,
    backgroundColor: '#374151',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 280, // Updated from 200
    marginTop: -280, // Updated from -200
    gap: 2,
  },
  barWrapper: {
    flex: 1,
    height: 280, // Updated from 200
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 3,
  },
  xAxisContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 4,
  },
  xAxisLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: '500',
    color: '#9ca3af',
    textAlign: 'center',
  },
  
  // Usage Statistics Card
  usageStatsCard: {
    backgroundColor: '#1f293780',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  usageStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  usageStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  usageStatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  usageStatLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  usageStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  usageStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#374151',
    marginHorizontal: 12,
  },
  
  // Export Button
  exportButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  exportGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  exportText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: 24,
    borderWidth: 1,
    borderColor: '#37415140',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  deviceList: {
    maxHeight: 400,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  selectedDeviceItem: {
    backgroundColor: '#06b6d420',
    borderColor: '#06b6d4',
  },
  deviceItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#37415180',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceItemContent: {
    flex: 1,
  },
  deviceItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  selectedDeviceText: {
    color: '#06b6d4',
  },
  deviceItemLocation: {
    fontSize: 14,
    color: '#9ca3af',
  },
  
  // Loading/Auth States
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 16,
  },
});

export default AnalyticsScreen;
