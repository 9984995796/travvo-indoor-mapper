
import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient, ScanResult, ScanMode } from '@capacitor-community/bluetooth-le';
import { rssiToDistance, BeaconData } from '@/utils/beaconUtils';
import { KalmanFilter } from '@/utils/kalmanFilter';
import { calculatePosition } from '@/utils/trilateration';

interface Beacon {
  id: number;
  x: number;
  y: number;
  name: string;
  deviceName: string;
}

interface Position {
  x: number;
  y: number;
}

export const useBLEScanner = (
  beacons: Beacon[],
  kalmanFilters: { [key: number]: KalmanFilter },
  uuid: string,
  txPower: number
) => {
  const [isScanning, setIsScanning] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Position>({ x: 2.5, y: 2.5 });
  const [beaconData, setBeaconData] = useState<BeaconData[]>([]);
  const [positionHistory, setPositionHistory] = useState<Position[]>([]);
  const [isNativePlatform, setIsNativePlatform] = useState(false);
  const [bleError, setBleError] = useState<string | null>(null);
  const [bleInitialized, setBleInitialized] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [devicesFound, setDevicesFound] = useState<number>(0);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const positionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if device supports BLE
  const checkBLESupport = async () => {
    try {
      await BleClient.initialize();
      console.log('✅ BLE Available: true');
      return true;
    } catch (error) {
      console.error('❌ BLE availability check failed:', error);
      return false;
    }
  };

  // Check Bluetooth state
  const checkBluetoothState = async () => {
    try {
      const isEnabled = await BleClient.isEnabled();
      setBluetoothEnabled(isEnabled);
      console.log('🔵 Bluetooth enabled:', isEnabled);
      
      if (!isEnabled) {
        setBleError('Bluetooth is disabled. Please enable Bluetooth and try again.');
        setScanStatus('Bluetooth disabled');
        return false;
      }
      
      setScanStatus('Bluetooth enabled');
      return true;
    } catch (error) {
      console.error('❌ Error checking Bluetooth state:', error);
      setBleError(`Bluetooth state check failed: ${error}`);
      setScanStatus('Bluetooth check failed');
      return false;
    }
  };

  // Request all necessary permissions
  const requestAllPermissions = async () => {
    try {
      console.log('🔐 Requesting BLE permissions...');
      
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, () => {});
      
      await BleClient.stopLEScan();
      
      console.log('✅ All BLE permissions granted');
      setScanStatus('Permissions granted');
      return true;
    } catch (error) {
      console.error('❌ Permission request failed:', error);
      setBleError(`Permission denied: ${error}`);
      setScanStatus(`Permission failed: ${error}`);
      return false;
    }
  };

  // Enhanced platform detection
  useEffect(() => {
    const initializeBLE = async () => {
      const platform = Capacitor.getPlatform();
      const isNative = Capacitor.isNativePlatform();
      
      console.log('=== REAL-TIME BEACON TRACKING INITIALIZATION ===');
      console.log('🔍 Platform:', platform);
      console.log('🔍 Is Native:', isNative);
      console.log('🔍 Expected beacon names:', beacons.map(b => `${b.deviceName} (ID: ${b.id}, Position: ${b.x},${b.y})`));
      console.log('🔍 Update Rate: 1Hz (every 1000ms)');
      console.log('🔍 TxPower:', txPower, 'dBm');
      
      setIsNativePlatform(isNative);
      
      if (isNative) {
        try {
          const bleSupported = await checkBLESupport();
          if (!bleSupported) {
            setBleError('BLE not supported on this device');
            setScanStatus('BLE not supported');
            return;
          }

          console.log('✅ BLE Client initialized for real-time beacon tracking');
          setBleInitialized(true);
          
          const bluetoothOk = await checkBluetoothState();
          if (bluetoothOk) {
            setBleError(null);
            setScanStatus('BLE ready for real-time tracking');
          }
        } catch (error) {
          console.error('❌ BLE initialization failed:', error);
          setBleError(`BLE initialization failed: ${error}`);
          setBleInitialized(false);
          setScanStatus(`Init failed: ${error}`);
        }
      } else {
        console.log('❌ Not running on native platform - beacon tracking disabled');
        setBleError('BLE requires native platform (Android/iOS)');
        setScanStatus('Not native platform');
      }
    };
    
    initializeBLE();
  }, [beacons, txPower]);

  // Process beacon data from scan results with IMPROVED filtering and calculations
  const processBeaconByName = useCallback((deviceName: string, rssi: number, txPowerFromDevice?: number) => {
    console.log('🎯 ===========================================');
    console.log('🎯 PROCESSING BEACON WITH LIVE RSSI UPDATE');
    console.log('🎯 ===========================================');
    console.log(`📡 Device: ${deviceName}`);
    console.log(`📊 Raw RSSI: ${rssi} dBm`);
    console.log(`⚡ TxPower: ${txPowerFromDevice || txPower} dBm`);
    
    const beacon = beacons.find(b => b.deviceName === deviceName);
    if (!beacon) {
      console.log('⚠️ Unknown beacon name:', deviceName);
      console.log('📝 Expected names:', beacons.map(b => `${b.deviceName} (ID: ${b.id})`));
      return;
    }

    console.log('✅ BEACON MATCHED:', {
      displayName: beacon.name,
      deviceName: beacon.deviceName,
      id: beacon.id,
      position: `(${beacon.x}, ${beacon.y})`
    });

    // Apply Kalman filter for RSSI smoothing
    let filteredRSSI = rssi;
    if (kalmanFilters[beacon.id]) {
      const rawRSSI = rssi;
      filteredRSSI = kalmanFilters[beacon.id].filter(rssi);
      console.log('📊 KALMAN FILTER APPLIED:');
      console.log(`   Raw RSSI: ${rawRSSI} dBm`);
      console.log(`   Filtered RSSI: ${filteredRSSI.toFixed(1)} dBm`);
      console.log(`   Smoothing: ${(filteredRSSI - rawRSSI).toFixed(1)} dBm`);
    }

    // Calculate distance with corrected formula
    const calculatedDistance = rssiToDistance(filteredRSSI, txPowerFromDevice || txPower);
    console.log('📏 DISTANCE CALCULATION COMPLETE:', calculatedDistance.toFixed(2), 'meters');
    
    // Update beacon data state with timestamp
    setBeaconData(prev => {
      const timestamp = new Date().toISOString();
      const newBeacon: BeaconData = {
        id: beacon.id,
        uuid: 'name-based',
        major: beacon.id,
        minor: 0,
        rssi: Math.round(rssi),
        filteredRSSI: Math.round(filteredRSSI * 10) / 10,
        distance: Math.round(calculatedDistance * 100) / 100,
        actualDistance: calculatedDistance,
        x: beacon.x,
        y: beacon.y,
        name: beacon.name
      };

      const filtered = prev.filter(b => b.id !== beacon.id);
      const updated = [...filtered, newBeacon];
      
      console.log('🔄 BEACON DATA UPDATED:');
      updated.forEach(b => {
        console.log(`   ${b.name}(${b.id}): RSSI=${b.rssi}dBm, Filtered=${b.filteredRSSI}dBm, Distance=${b.distance}m`);
      });
      console.log(`⏰ Update timestamp: ${timestamp}`);
      
      return updated;
    });
  }, [beacons, kalmanFilters, txPower]);

  // Enhanced BLE scanning with 1Hz update rate
  const scanForBeacons = async () => {
    if (!isNativePlatform || !bleInitialized) {
      const errorMsg = !isNativePlatform ? 
        'BLE scanning requires native platform' : 
        'BLE not initialized';
      setBleError(errorMsg);
      setScanStatus(errorMsg);
      console.log('❌ Cannot start beacon scan:', errorMsg);
      return;
    }

    try {
      console.log('🚀 ===========================================');
      console.log('🚀 STARTING REAL-TIME BEACON TRACKING (1Hz)');
      console.log('🚀 ===========================================');
      console.log('🎯 Target beacons:', beacons.map(b => b.deviceName));
      console.log('🎯 TxPower:', txPower, 'dBm');
      console.log('🎯 Update rate: 1Hz (1000ms intervals)');
      
      // Check Bluetooth state
      const bluetoothOk = await checkBluetoothState();
      if (!bluetoothOk) {
        console.log('❌ Bluetooth check failed, stopping scan');
        return;
      }

      // Request permissions
      const permissionsOk = await requestAllPermissions();
      if (!permissionsOk) {
        console.log('❌ Permissions check failed, stopping scan');
        return;
      }

      setBleError(null);
      setScanStatus('Real-time tracking active (1Hz)...');
      setDevicesFound(0);
      
      console.log('📡 Starting continuous BLE scan...');
      
      // Start scanning with optimized settings for 1Hz updates
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, (result: ScanResult) => {
        setDevicesFound(prev => prev + 1);
        
        const deviceName = result.device?.name || result.localName || 'Unknown';
        const deviceId = result.device?.deviceId || 'unknown';
        
        // Check if this device name matches any of our expected beacon names
        const targetNames = beacons.map(b => b.deviceName);
        const isTargetBeacon = targetNames.includes(deviceName) || 
                              (result.localName && targetNames.includes(result.localName));

        if (isTargetBeacon) {
          const matchedName = targetNames.includes(deviceName) ? deviceName : result.localName!;
          console.log('🎯 TARGET BEACON DETECTED:', {
            name: matchedName,
            rssi: result.rssi,
            txPower: result.txPower,
            timestamp: new Date().toISOString()
          });
          setScanStatus(`Live tracking: ${matchedName} (${result.rssi}dBm)`);
          processBeaconByName(matchedName, result.rssi || -100, result.txPower);
        }
      });

      console.log('✅ Real-time BLE scan started successfully');
      setScanStatus('Scanning at 1Hz for live updates...');
      
    } catch (error) {
      console.error('❌ Real-time BLE scanning error:', error);
      setBleError(`Scan failed: ${error}`);
      setScanStatus(`Scan error: ${error}`);
      setIsScanning(false);
    }
  };

  // Real-time position calculation with live trilateration
  const calculateFromRealBeacons = useCallback(() => {
    if (!isScanning || !isNativePlatform || !bleInitialized) {
      return;
    }

    console.log('📍 ===========================================');
    console.log('📍 REAL-TIME POSITION CALCULATION (1Hz)');
    console.log('📍 ===========================================');
    console.log(`📊 Available beacons: ${beaconData.length}/5`);
    
    if (beaconData.length >= 3) {
      const distances: { [key: number]: number } = {};
      console.log('🎯 Using beacons for trilateration:');
      
      beaconData.forEach(beacon => {
        distances[beacon.id] = beacon.actualDistance;
        console.log(`   ${beacon.name} (${beacon.id}): Distance=${beacon.actualDistance.toFixed(2)}m, RSSI=${beacon.rssi}dBm, Filtered=${beacon.filteredRSSI}dBm`);
      });

      const newPosition = calculatePosition(beacons, distances, currentPosition);
      
      console.log('📍 TRILATERATION RESULT:');
      console.log(`   Previous position: (${currentPosition.x.toFixed(2)}, ${currentPosition.y.toFixed(2)})`);
      console.log(`   New position: (${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)})`);
      console.log(`   Movement: ${Math.sqrt(Math.pow(newPosition.x - currentPosition.x, 2) + Math.pow(newPosition.y - currentPosition.y, 2)).toFixed(2)}m`);
      
      setCurrentPosition(newPosition);
      setPositionHistory(prev => [...prev.slice(-49), newPosition]); // Keep last 50 positions
      
      console.log('✅ Position updated successfully');
      setScanStatus(`Position: (${newPosition.x.toFixed(1)}, ${newPosition.y.toFixed(1)})m from ${beaconData.length} beacons`);
    } else {
      console.log('⚠️ Need at least 3 beacons for trilateration');
      console.log(`   Current beacons: ${beaconData.length}`);
      setScanStatus(`Need 3+ beacons for positioning (have ${beaconData.length})`);
    }
    
    console.log('📍 POSITION CALCULATION COMPLETE');
  }, [isScanning, beaconData, currentPosition, isNativePlatform, bleInitialized, beacons]);

  // Start/stop scanning with 1Hz position updates
  useEffect(() => {
    if (isScanning) {
      console.log('🟢 Starting real-time beacon tracking with 1Hz updates...');
      if (isNativePlatform && bleInitialized) {
        scanForBeacons();
        
        // Position calculation every 1 second (1Hz)
        positionIntervalRef.current = setInterval(() => {
          console.log('⏰ 1Hz Position update triggered');
          calculateFromRealBeacons();
        }, 1000); // 1000ms = 1Hz
        
        console.log('✅ 1Hz position updates started');
      } else {
        console.log('❌ Cannot start scan - platform or init issue');
        setIsScanning(false);
        setScanStatus('Cannot scan - platform/init issue');
      }
    } else {
      console.log('🔴 Stopping real-time beacon tracking...');
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
        positionIntervalRef.current = null;
        console.log('🛑 1Hz position updates stopped');
      }
      if (isNativePlatform && bleInitialized) {
        BleClient.stopLEScan().catch(console.error);
        setScanStatus('Scan stopped');
      }
    }

    return () => {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }
    };
  }, [isScanning, calculateFromRealBeacons, isNativePlatform, bleInitialized]);

  const toggleScanning = async () => {
    console.log('🔄 Toggle scanning requested. Current state:', isScanning);
    
    if (!isNativePlatform) {
      setBleError('BLE requires native platform');
      console.log('❌ Cannot toggle - not native platform');
      return;
    }
    
    if (!bleInitialized) {
      setBleError('BLE not initialized');
      console.log('❌ Cannot toggle - BLE not initialized');
      return;
    }

    if (!isScanning) {
      const bluetoothOk = await checkBluetoothState();
      if (!bluetoothOk) {
        console.log('❌ Cannot start - Bluetooth not OK');
        return;
      }
    }
    
    console.log('✅ Toggling scanning to:', !isScanning);
    setIsScanning(!isScanning);
    
    if (!isScanning) {
      console.log('🧹 Clearing previous data for fresh tracking');
      setBeaconData([]);
      setPositionHistory([]);
      setBleError(null);
      setDevicesFound(0);
    }
  };

  const resetScanning = () => {
    console.log('🔄 Resetting real-time beacon scanner...');
    setIsScanning(false);
    setCurrentPosition({ x: 2.5, y: 2.5 });
    setBeaconData([]);
    setPositionHistory([]);
    setBleError(null);
    setScanStatus('Reset complete');
    setDevicesFound(0);
    console.log('✅ Real-time beacon scanner reset complete');
  };

  return {
    isScanning,
    currentPosition,
    beaconData,
    positionHistory,
    isNativePlatform,
    bleError,
    bleInitialized,
    bluetoothEnabled,
    scanStatus,
    devicesFound,
    toggleScanning,
    resetScanning
  };
};
