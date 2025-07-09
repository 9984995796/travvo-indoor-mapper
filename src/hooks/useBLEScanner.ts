
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
  deviceName: string; // Add device name for matching
}

interface Position {
  x: number;
  y: number;
}

export const useBLEScanner = (
  beacons: Beacon[],
  kalmanFilters: { [key: number]: KalmanFilter },
  uuid: string, // Keep for backward compatibility but won't be used
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
      
      console.log('=== BEACON TRACKING BLE INITIALIZATION (NAME-BASED) ===');
      console.log('🔍 Platform:', platform);
      console.log('🔍 Is Native:', isNative);
      console.log('🔍 Expected beacon names:', beacons.map(b => `${b.deviceName} (ID: ${b.id}, Position: ${b.x},${b.y})`));
      console.log('🔍 Note: Now matching by device names instead of UUID');
      
      setIsNativePlatform(isNative);
      
      if (isNative) {
        try {
          const bleSupported = await checkBLESupport();
          if (!bleSupported) {
            setBleError('BLE not supported on this device');
            setScanStatus('BLE not supported');
            return;
          }

          console.log('✅ BLE Client initialized for name-based beacon tracking');
          setBleInitialized(true);
          
          const bluetoothOk = await checkBluetoothState();
          if (bluetoothOk) {
            setBleError(null);
            setScanStatus('BLE ready for name-based beacon tracking');
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
  }, [beacons]);

  // Process beacon data from scan results (name-based matching)
  const processBeaconByName = useCallback((deviceName: string, rssi: number, txPowerFromDevice?: number) => {
    console.log('🎯 PROCESSING BEACON BY NAME:', { deviceName, rssi, txPowerFromDevice });
    
    const beacon = beacons.find(b => b.deviceName === deviceName);
    if (!beacon) {
      console.log('⚠️ Unknown beacon name:', deviceName);
      console.log('📝 Expected names:', beacons.map(b => `${b.deviceName} (ID: ${b.id})`));
      return;
    }

    console.log('✅ BEACON FOUND & MATCHED BY NAME:', {
      displayName: beacon.name,
      deviceName: beacon.deviceName,
      id: beacon.id,
      rssi: rssi,
      position: `(${beacon.x}, ${beacon.y})`
    });

    // Apply Kalman filter
    let filteredRSSI = rssi;
    if (kalmanFilters[beacon.id]) {
      filteredRSSI = kalmanFilters[beacon.id].filter(rssi);
      console.log('📊 Kalman filter applied:', rssi, '→', filteredRSSI);
    }

    const calculatedDistance = rssiToDistance(filteredRSSI, txPowerFromDevice || txPower);
    console.log('📏 Distance calculated:', calculatedDistance, 'meters');
    
    // Update beacon data state
    setBeaconData(prev => {
      const newBeacon: BeaconData = {
        id: beacon.id,
        uuid: 'name-based', // Placeholder since we're not using UUID
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
      
      console.log('🔄 Updated beacon data:', updated.map(b => `${b.name}(${b.id}): ${b.rssi}dBm, ${b.distance}m`));
      return updated;
    });
  }, [beacons, kalmanFilters, txPower]);

  // Enhanced BLE scanning with name-based matching
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
      console.log('🚀 STARTING NAME-BASED BEACON TRACKING SCAN');
      console.log('🚀 ===========================================');
      console.log('🎯 Looking for device names:', beacons.map(b => b.deviceName));
      console.log('🎯 TX Power:', txPower);
      
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
      setScanStatus('Name-based beacon tracking scan active...');
      setDevicesFound(0);
      
      console.log('📡 Starting BLE scan for name-based beacon tracking...');
      
      // Start scanning with optimized settings
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, (result: ScanResult) => {
        setDevicesFound(prev => prev + 1);
        
        const deviceName = result.device?.name || result.localName || 'Unknown';
        const deviceId = result.device?.deviceId || 'unknown';
        
        console.log('📱 BLE Device Found in Name-Based Beacon Scan:', {
          deviceId: deviceId.slice(0, 12) + '...',
          deviceName: deviceName,
          localName: result.localName,
          rssi: result.rssi,
          txPower: result.txPower
        });

        // Check if this device name matches any of our expected beacon names
        const targetNames = beacons.map(b => b.deviceName);
        const isTargetBeacon = targetNames.includes(deviceName) || 
                              (result.localName && targetNames.includes(result.localName));

        if (isTargetBeacon) {
          const matchedName = targetNames.includes(deviceName) ? deviceName : result.localName!;
          console.log('🎯 TARGET BEACON FOUND BY NAME:', matchedName);
          setScanStatus(`Found beacon: ${matchedName}!`);
          processBeaconByName(matchedName, result.rssi || -100, result.txPower);
        } else {
          // Log non-matching devices for debugging
          if (deviceName.includes('POI') || deviceName.includes('ESP32') || deviceName.includes('Beacon')) {
            console.log('🤔 POI-like device found but name doesn\'t match exactly:', {
              deviceName,
              localName: result.localName,
              expectedNames: targetNames
            });
          }
        }
      });

      console.log('✅ Name-based beacon tracking BLE scan started successfully');
      setScanStatus('Scanning for named beacons...');
      
    } catch (error) {
      console.error('❌ Name-based beacon tracking BLE scanning error:', error);
      setBleError(`Scan failed: ${error}`);
      setScanStatus(`Scan error: ${error}`);
      setIsScanning(false);
    }
  };

  // Position calculation from real beacon data
  const calculateFromRealBeacons = useCallback(() => {
    if (!isScanning || !isNativePlatform || !bleInitialized) {
      console.log('⏸️ Skipping position calculation: scanning=', isScanning, 'native=', isNativePlatform, 'init=', bleInitialized);
      return;
    }

    console.log('📍 Position calculation attempt with', beaconData.length, 'named beacons');
    
    if (beaconData.length >= 3) {
      const distances: { [key: number]: number } = {};
      beaconData.forEach(beacon => {
        distances[beacon.id] = beacon.distance;
        console.log(`   ${beacon.name} (${beacon.id}): ${beacon.distance}m`);
      });

      const newPosition = calculatePosition(beacons, distances, currentPosition);
      setCurrentPosition(newPosition);
      setPositionHistory(prev => [...prev.slice(-50), newPosition]);
      
      console.log('✅ Position calculated:', `(${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)})`, 'from', beaconData.length, 'named beacons');
      setScanStatus(`Position from ${beaconData.length} named beacons`);
    } else {
      console.log('⚠️ Need at least 3 beacons for position calculation (have', beaconData.length, ')');
      setScanStatus(`Need 3+ beacons (have ${beaconData.length})`);
    }
  }, [isScanning, beaconData, currentPosition, isNativePlatform, bleInitialized, beacons]);

  // Start/stop scanning effect
  useEffect(() => {
    if (isScanning) {
      console.log('🟢 Starting name-based beacon tracking scan...');
      if (isNativePlatform && bleInitialized) {
        scanForBeacons();
        intervalRef.current = setInterval(() => {
          console.log('⏰ Position calculation interval triggered');
          calculateFromRealBeacons();
        }, 2000);
      } else {
        console.log('❌ Cannot start scan - platform or init issue');
        setIsScanning(false);
        setScanStatus('Cannot scan - platform/init issue');
      }
    } else {
      console.log('🔴 Stopping name-based beacon tracking scan...');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (isNativePlatform && bleInitialized) {
        BleClient.stopLEScan().catch(console.error);
        setScanStatus('Scan stopped');
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
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
      console.log('🧹 Clearing previous beacon data for fresh scan');
      setBeaconData([]);
      setPositionHistory([]);
      setBleError(null);
      setDevicesFound(0);
    }
  };

  const resetScanning = () => {
    console.log('🔄 Resetting name-based beacon scanner...');
    setIsScanning(false);
    setCurrentPosition({ x: 2.5, y: 2.5 });
    setBeaconData([]);
    setPositionHistory([]);
    setBleError(null);
    setScanStatus('Reset complete');
    setDevicesFound(0);
    console.log('✅ Name-based beacon scanner reset complete');
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
