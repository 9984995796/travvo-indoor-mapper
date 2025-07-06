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
      // Since isAvailable doesn't exist, we'll try to initialize to check support
      await BleClient.initialize();
      console.log('BLE Available: true');
      return true;
    } catch (error) {
      console.error('BLE availability check failed:', error);
      return false;
    }
  };

  // Check Bluetooth state
  const checkBluetoothState = async () => {
    try {
      const isEnabled = await BleClient.isEnabled();
      setBluetoothEnabled(isEnabled);
      console.log('Bluetooth enabled:', isEnabled);
      
      if (!isEnabled) {
        setBleError('Bluetooth is disabled. Please enable Bluetooth and try again.');
        setScanStatus('Bluetooth disabled');
        return false;
      }
      
      setScanStatus('Bluetooth enabled');
      return true;
    } catch (error) {
      console.error('Error checking Bluetooth state:', error);
      setBleError(`Bluetooth state check failed: ${error}`);
      setScanStatus('Bluetooth check failed');
      return false;
    }
  };

  // Request all necessary permissions
  const requestAllPermissions = async () => {
    try {
      console.log('🔐 Requesting BLE permissions...');
      
      // Request location permission first
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, () => {});
      
      // Stop the permission scan immediately
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
      
      console.log('=== BLE Initialization ===');
      console.log('Platform:', platform);
      console.log('Is Native:', isNative);
      console.log('User Agent:', navigator.userAgent);
      
      setIsNativePlatform(isNative);
      
      if (isNative) {
        try {
          // Check BLE support first
          const bleSupported = await checkBLESupport();
          if (!bleSupported) {
            setBleError('BLE not supported on this device');
            setScanStatus('BLE not supported');
            return;
          }

          console.log('✅ BLE Client initialized');
          setBleInitialized(true);
          
          // Check Bluetooth state
          const bluetoothOk = await checkBluetoothState();
          if (bluetoothOk) {
            setBleError(null);
            setScanStatus('BLE ready');
          }
        } catch (error) {
          console.error('❌ BLE initialization failed:', error);
          setBleError(`BLE initialization failed: ${error}`);
          setBleInitialized(false);
          setScanStatus(`Init failed: ${error}`);
        }
      } else {
        console.log('❌ Not running on native platform');
        setBleError('BLE requires native platform (Android/iOS)');
        setScanStatus('Not native platform');
      }
    };
    
    initializeBLE();
  }, []);

  // Process beacon data from scan results
  const processBeaconData = useCallback((beaconInfo: BeaconInfo) => {
    const beacon = beacons.find(b => b.id === beaconInfo.major);
    if (!beacon) {
      console.log('⚠️ Unknown beacon major:', beaconInfo.major, 'Expected:', beacons.map(b => b.id));
      return;
    }

    console.log('✅ Processing beacon:', {
      name: beacon.name,
      major: beaconInfo.major,
      minor: beaconInfo.minor,
      rssi: beaconInfo.rssi,
      uuid: beaconInfo.uuid
    });

    // Apply Kalman filter
    let filteredRSSI = beaconInfo.rssi;
    if (kalmanFilters[beacon.id]) {
      filteredRSSI = kalmanFilters[beacon.id].filter(beaconInfo.rssi);
    }

    const calculatedDistance = rssiToDistance(filteredRSSI, beaconInfo.txPower || txPower);
    
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
      return [...filtered, newBeacon];
    });
  }, [beacons, kalmanFilters, txPower]);

  // Enhanced BLE scanning with better manufacturer data handling
  const scanForBeacons = async () => {
    if (!isNativePlatform || !bleInitialized) {
      const errorMsg = !isNativePlatform ? 
        'BLE scanning requires native platform' : 
        'BLE not initialized';
      setBleError(errorMsg);
      setScanStatus(errorMsg);
      return;
    }

    try {
      console.log('=== Starting Enhanced BLE Scan ===');
      console.log('Target UUID:', uuid);
      console.log('Expected Majors:', beacons.map(b => b.id));
      
      // Check Bluetooth state
      const bluetoothOk = await checkBluetoothState();
      if (!bluetoothOk) {
        return;
      }

      // Request permissions
      const permissionsOk = await requestAllPermissions();
      if (!permissionsOk) {
        return;
      }

      setBleError(null);
      setScanStatus('Scanning active...');
      setDevicesFound(0);
      
      // Start scanning with optimized settings
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, (result: ScanResult) => {
        setDevicesFound(prev => prev + 1);
        
        console.log('📡 BLE Device Found:', {
          deviceId: result.device?.deviceId,
          name: result.device?.name || 'Unknown',
          rssi: result.rssi,
          txPower: result.txPower,
          hasManufacturerData: !!result.manufacturerData
        });

        // Check manufacturer data for iBeacon
        if (result.manufacturerData) {
          console.log('📊 Manufacturer Data Keys:', Object.keys(result.manufacturerData));
          
          // Check for Apple manufacturer data (0x004C)
          const appleData = result.manufacturerData['76'] || result.manufacturerData['004C'] || result.manufacturerData[76];
          
          if (appleData) {
            console.log('🍎 Apple manufacturer data found:', {
              type: typeof appleData,
              constructor: appleData?.constructor?.name,
              byteLength: appleData instanceof DataView ? appleData.byteLength : 
                         appleData instanceof ArrayBuffer ? appleData.byteLength :
                         Array.isArray(appleData) ? appleData.length : 'unknown'
            });
            
            try {
              // Convert data to ArrayBuffer
              let arrayBuffer: ArrayBuffer;
              
              if (appleData instanceof ArrayBuffer) {
                arrayBuffer = appleData;
              } else if (appleData instanceof DataView) {
                arrayBuffer = appleData.buffer.slice(appleData.byteOffset, appleData.byteOffset + appleData.byteLength);
              } else if (appleData && typeof appleData === 'object' && 'buffer' in appleData) {
                const typedArray = appleData as any;
                arrayBuffer = typedArray.buffer.slice(typedArray.byteOffset, typedArray.byteOffset + typedArray.byteLength);
              } else if (Array.isArray(appleData)) {
                arrayBuffer = new Uint8Array(appleData).buffer;
              } else {
                console.error('❌ Unknown manufacturer data format:', typeof appleData);
                return;
              }
              
              console.log('🔍 Parsing iBeacon from ArrayBuffer, length:', arrayBuffer.byteLength);
              
              // Parse iBeacon data
              const beaconInfo = parseIBeaconData(arrayBuffer, result.rssi || -100);
              
              if (beaconInfo) {
                console.log('📍 Parsed iBeacon:', beaconInfo);
                
                // Check UUID match (case insensitive)
                if (beaconInfo.uuid.toLowerCase() === uuid.toLowerCase()) {
                  console.log('🎯 UUID MATCH! Processing beacon...');
                  setScanStatus(`Found beacon ${beaconInfo.major}!`);
                  processBeaconData(beaconInfo);
                } else {
                  console.log('❌ UUID mismatch:', beaconInfo.uuid, 'vs', uuid);
                  setScanStatus(`Wrong UUID: ${beaconInfo.uuid.slice(0, 8)}...`);
                }
              } else {
                console.log('❌ Failed to parse iBeacon data');
              }
            } catch (parseError) {
              console.error('❌ Error parsing manufacturer data:', parseError);
            }
          } else {
            console.log('📱 No Apple manufacturer data found');
          }
        } else {
          console.log('📱 No manufacturer data in advertisement');
        }
      });

      console.log('✅ BLE scan started successfully');
      setScanStatus('Scanning for beacons...');
      
    } catch (error) {
      console.error('❌ BLE scanning error:', error);
      setBleError(`Scan failed: ${error}`);
      setScanStatus(`Scan error: ${error}`);
      setIsScanning(false);
    }
  };

  // Position calculation from real beacon data
  const calculateFromRealBeacons = useCallback(() => {
    if (!isScanning || !isNativePlatform || !bleInitialized) return;

    if (beaconData.length >= 3) {
      const distances: { [key: number]: number } = {};
      beaconData.forEach(beacon => {
        distances[beacon.id] = beacon.distance;
      });

      const newPosition = calculatePosition(beacons, distances, currentPosition);
      setCurrentPosition(newPosition);
      setPositionHistory(prev => [...prev.slice(-50), newPosition]);
      
      console.log('📍 Position calculated:', newPosition, 'from', beaconData.length, 'beacons');
      setScanStatus(`Position from ${beaconData.length} beacons`);
    } else {
      setScanStatus(`Need 3+ beacons (have ${beaconData.length})`);
    }
  }, [isScanning, beaconData, currentPosition, isNativePlatform, bleInitialized, beacons]);

  // Start/stop scanning effect
  useEffect(() => {
    if (isScanning) {
      if (isNativePlatform && bleInitialized) {
        scanForBeacons();
        intervalRef.current = setInterval(calculateFromRealBeacons, 2000); // Every 2 seconds
      } else {
        setIsScanning(false);
        setScanStatus('Cannot scan - platform/init issue');
      }
    } else {
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
    if (!isNativePlatform) {
      setBleError('BLE requires native platform');
      return;
    }
    
    if (!bleInitialized) {
      setBleError('BLE not initialized');
      return;
    }

    // Check Bluetooth before starting
    if (!isScanning) {
      const bluetoothOk = await checkBluetoothState();
      if (!bluetoothOk) {
        return;
      }
    }
    
    console.log('Toggle scanning:', !isScanning);
    setIsScanning(!isScanning);
    
    if (!isScanning) {
      setBeaconData([]);
      setPositionHistory([]);
      setBleError(null);
      setDevicesFound(0);
    }
  };

  const resetScanning = () => {
    console.log('Resetting scanner...');
    setIsScanning(false);
    setCurrentPosition({ x: 2.5, y: 2.5 });
    setBeaconData([]);
    setPositionHistory([]);
    setBleError(null);
    setScanStatus('Reset complete');
    setDevicesFound(0);
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
