
import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient, ScanResult, ScanMode } from '@capacitor-community/bluetooth-le';
import { parseIBeaconData, rssiToDistance, BeaconData, BeaconInfo } from '@/utils/beaconUtils';
import { KalmanFilter } from '@/utils/kalmanFilter';
import { calculatePosition } from '@/utils/trilateration';

interface Beacon {
  id: number;
  x: number;
  y: number;
  name: string;
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
      
      console.log('=== BEACON TRACKING BLE INITIALIZATION ===');
      console.log('🔍 Platform:', platform);
      console.log('🔍 Is Native:', isNative);
      console.log('🔍 Expected beacon IDs:', beacons.map(b => `${b.id} (${b.name})`));
      console.log('🔍 Target UUID:', uuid);
      
      setIsNativePlatform(isNative);
      
      if (isNative) {
        try {
          const bleSupported = await checkBLESupport();
          if (!bleSupported) {
            setBleError('BLE not supported on this device');
            setScanStatus('BLE not supported');
            return;
          }

          console.log('✅ BLE Client initialized for beacon tracking');
          setBleInitialized(true);
          
          const bluetoothOk = await checkBluetoothState();
          if (bluetoothOk) {
            setBleError(null);
            setScanStatus('BLE ready for beacon tracking');
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
  }, [beacons, uuid]);

  // Process beacon data from scan results
  const processBeaconData = useCallback((beaconInfo: BeaconInfo) => {
    console.log('🎯 PROCESSING BEACON DATA:', beaconInfo);
    
    const beacon = beacons.find(b => b.id === beaconInfo.major);
    if (!beacon) {
      console.log('⚠️ Unknown beacon major:', beaconInfo.major);
      console.log('📝 Expected majors:', beacons.map(b => `${b.id} (${b.name})`));
      return;
    }

    console.log('✅ BEACON FOUND & MATCHED:', {
      name: beacon.name,
      major: beaconInfo.major,
      minor: beaconInfo.minor,
      rssi: beaconInfo.rssi,
      uuid: beaconInfo.uuid,
      position: `(${beacon.x}, ${beacon.y})`
    });

    // Apply Kalman filter
    let filteredRSSI = beaconInfo.rssi;
    if (kalmanFilters[beacon.id]) {
      filteredRSSI = kalmanFilters[beacon.id].filter(beaconInfo.rssi);
      console.log('📊 Kalman filter applied:', beaconInfo.rssi, '→', filteredRSSI);
    }

    const calculatedDistance = rssiToDistance(filteredRSSI, beaconInfo.txPower || txPower);
    console.log('📏 Distance calculated:', calculatedDistance, 'meters');
    
    // Update beacon data state
    setBeaconData(prev => {
      const newBeacon: BeaconData = {
        id: beacon.id,
        uuid: beaconInfo.uuid,
        major: beaconInfo.major,
        minor: beaconInfo.minor,
        rssi: Math.round(beaconInfo.rssi),
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

  // Helper function to safely convert manufacturer data to ArrayBuffer
  const convertToArrayBuffer = (data: any): ArrayBuffer | null => {
    try {
      console.log('🔄 Converting data to ArrayBuffer:', typeof data, data);
      
      if (data instanceof ArrayBuffer) {
        console.log('✅ Already ArrayBuffer, length:', data.byteLength);
        return data;
      }
      
      if (data instanceof DataView) {
        console.log('✅ DataView detected, converting...');
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      }
      
      if (data && typeof data === 'object' && 'buffer' in data && 'byteOffset' in data && 'byteLength' in data) {
        console.log('✅ Typed array detected, converting...');
        const typedArray = data as any;
        return typedArray.buffer.slice(typedArray.byteOffset, typedArray.byteOffset + typedArray.byteLength);
      }
      
      if (Array.isArray(data)) {
        console.log('✅ Array detected, converting to Uint8Array...');
        return new Uint8Array(data).buffer;
      }
      
      if (data && typeof data === 'object') {
        const keys = Object.keys(data).filter(k => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));
        if (keys.length > 0) {
          console.log('✅ Object with numeric keys detected, converting...');
          const bytes = keys.map(k => data[k]);
          return new Uint8Array(bytes).buffer;
        }
      }
      
      console.log('❌ Cannot convert to ArrayBuffer');
      return null;
    } catch (error) {
      console.error('❌ Error converting to ArrayBuffer:', error);
      return null;
    }
  };

  // Enhanced BLE scanning with detailed logging
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
      console.log('🚀 STARTING BEACON TRACKING SCAN');
      console.log('🚀 ===========================================');
      console.log('🎯 Target UUID:', uuid);
      console.log('🎯 Looking for majors:', beacons.map(b => `${b.id} (${b.name})`));
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
      setScanStatus('Beacon tracking scan active...');
      setDevicesFound(0);
      
      console.log('📡 Starting BLE scan for beacon tracking...');
      
      // Start scanning with optimized settings
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, (result: ScanResult) => {
        setDevicesFound(prev => prev + 1);
        
        const deviceName = result.device?.name || 'Unknown';
        const deviceId = result.device?.deviceId || 'unknown';
        
        console.log('📱 BLE Device Found in Beacon Scan:', {
          deviceId: deviceId.slice(0, 12) + '...',
          name: deviceName,
          rssi: result.rssi,
          txPower: result.txPower,
          hasManufacturerData: !!result.manufacturerData,
          serviceUuids: result.uuids || []
        });

        // Check if this device might be one of our beacons
        const isPotentialBeacon = deviceName.includes('POI') || 
                                 deviceName.includes('ESP32') || 
                                 deviceName.includes('Beacon') ||
                                 result.manufacturerData;

        if (isPotentialBeacon) {
          console.log('🔍 POTENTIAL BEACON DETECTED:', deviceName);
        }

        // Process manufacturer data
        if (result.manufacturerData) {
          console.log('🏭 Manufacturer data found, processing...');
          
          const manufacturerKeys = Object.keys(result.manufacturerData);
          console.log('🔑 Manufacturer keys:', manufacturerKeys);
          
          manufacturerKeys.forEach(key => {
            const data = result.manufacturerData![key];
            console.log(`🔍 Processing manufacturer ${key}:`, data);
            
            const arrayBuffer = convertToArrayBuffer(data);
            
            if (arrayBuffer && arrayBuffer.byteLength >= 25) {
              console.log(`✅ Valid data length (${arrayBuffer.byteLength} bytes), parsing as iBeacon...`);
              const beaconInfo = parseIBeaconData(arrayBuffer, result.rssi || -100);
              
              if (beaconInfo) {
                console.log('🎯 PARSED IBEACON:', beaconInfo);
                
                // UUID matching with flexible comparison
                const cleanTargetUuid = uuid.toLowerCase().replace(/-/g, '');
                const cleanBeaconUuid = beaconInfo.uuid.toLowerCase().replace(/-/g, '');
                
                console.log('🔍 UUID Comparison:');
                console.log('   Target: ', cleanTargetUuid);
                console.log('   Beacon: ', cleanBeaconUuid);
                console.log('   Match:  ', cleanBeaconUuid === cleanTargetUuid);
                
                if (cleanBeaconUuid === cleanTargetUuid) {
                  console.log('🎉 UUID MATCH! This is our beacon!');
                  console.log('🎉 Beacon details:', {
                    major: beaconInfo.major,
                    minor: beaconInfo.minor,
                    rssi: beaconInfo.rssi,
                    txPower: beaconInfo.txPower
                  });
                  setScanStatus(`Found beacon ${beaconInfo.major}!`);
                  processBeaconData(beaconInfo);
                } else {
                  console.log('❌ UUID mismatch - not our beacon');
                  console.log('💡 If this should be our beacon, check the UUID configuration');
                }
              } else {
                console.log('❌ Failed to parse as iBeacon format');
              }
            } else {
              const length = arrayBuffer ? arrayBuffer.byteLength : 0;
              console.log(`❌ Insufficient data length: ${length} bytes (need 25+)`);
            }
          });
        } else {
          console.log('📱 No manufacturer data - not an iBeacon');
        }

        // Also check service UUIDs
        if (result.uuids && result.uuids.length > 0) {
          console.log('🔧 Service UUIDs found:', result.uuids);
          result.uuids.forEach(serviceUuid => {
            const cleanServiceUuid = serviceUuid.toLowerCase().replace(/-/g, '');
            const cleanTargetUuid = uuid.toLowerCase().replace(/-/g, '');
            if (cleanServiceUuid.includes(cleanTargetUuid.slice(0, 8)) || 
                cleanTargetUuid.includes(cleanServiceUuid.slice(0, 8))) {
              console.log('🎯 Service UUID might match our beacon UUID!');
              setScanStatus(`Service UUID match found`);
            }
          });
        }
      });

      console.log('✅ Beacon tracking BLE scan started successfully');
      setScanStatus('Scanning for beacons...');
      
    } catch (error) {
      console.error('❌ Beacon tracking BLE scanning error:', error);
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

    console.log('📍 Position calculation attempt with', beaconData.length, 'beacons');
    
    if (beaconData.length >= 3) {
      const distances: { [key: number]: number } = {};
      beaconData.forEach(beacon => {
        distances[beacon.id] = beacon.distance;
        console.log(`   ${beacon.name} (${beacon.id}): ${beacon.distance}m`);
      });

      const newPosition = calculatePosition(beacons, distances, currentPosition);
      setCurrentPosition(newPosition);
      setPositionHistory(prev => [...prev.slice(-50), newPosition]);
      
      console.log('✅ Position calculated:', `(${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)})`, 'from', beaconData.length, 'beacons');
      setScanStatus(`Position from ${beaconData.length} beacons`);
    } else {
      console.log('⚠️ Need at least 3 beacons for position calculation (have', beaconData.length, ')');
      setScanStatus(`Need 3+ beacons (have ${beaconData.length})`);
    }
  }, [isScanning, beaconData, currentPosition, isNativePlatform, bleInitialized, beacons]);

  // Start/stop scanning effect
  useEffect(() => {
    if (isScanning) {
      console.log('🟢 Starting beacon tracking scan...');
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
      console.log('🔴 Stopping beacon tracking scan...');
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
    console.log('🔄 Resetting beacon scanner...');
    setIsScanning(false);
    setCurrentPosition({ x: 2.5, y: 2.5 });
    setBeaconData([]);
    setPositionHistory([]);
    setBleError(null);
    setScanStatus('Reset complete');
    setDevicesFound(0);
    console.log('✅ Beacon scanner reset complete');
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
