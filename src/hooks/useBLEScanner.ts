
import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient, ScanResult, ScanMode, BleDevice } from '@capacitor-community/bluetooth-le';
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

// Helper function to safely convert data to ArrayBuffer
const convertToArrayBuffer = (data: unknown): ArrayBuffer | null => {
  try {
    // Direct ArrayBuffer
    if (data instanceof ArrayBuffer) {
      return data;
    }
    
    // DataView
    if (data instanceof DataView) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    
    // Uint8Array or other TypedArray
    if (data && typeof data === 'object' && 'buffer' in data && 'byteOffset' in data && 'byteLength' in data) {
      const typedArray = data as { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
      return typedArray.buffer.slice(typedArray.byteOffset, typedArray.byteOffset + typedArray.byteLength);
    }
    
    // Array of numbers
    if (Array.isArray(data) && data.every(item => typeof item === 'number')) {
      const uint8Array = new Uint8Array(data);
      return uint8Array.buffer;
    }
    
    // String (hex or base64)
    if (typeof data === 'string') {
      // Try hex string
      if (/^[0-9a-fA-F]+$/.test(data) && data.length % 2 === 0) {
        const bytes = [];
        for (let i = 0; i < data.length; i += 2) {
          bytes.push(parseInt(data.substr(i, 2), 16));
        }
        const uint8Array = new Uint8Array(bytes);
        return uint8Array.buffer;
      }
    }
    
    console.error('Unable to convert data to ArrayBuffer:', typeof data, data);
    return null;
  } catch (error) {
    console.error('Error in convertToArrayBuffer:', error);
    return null;
  }
};

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

  // Request permissions
  const requestPermissions = async () => {
    try {
      console.log('Requesting BLE permissions...');
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: false
      }, () => {});
      
      // Stop immediately after permission request
      await BleClient.stopLEScan();
      console.log('✅ BLE permissions granted');
      return true;
    } catch (error) {
      console.error('❌ Permission request failed:', error);
      setBleError(`Permission denied: ${error}`);
      return false;
    }
  };

  // Enhanced platform detection with detailed logging
  useEffect(() => {
    const checkPlatform = async () => {
      const platform = Capacitor.getPlatform();
      const isNative = Capacitor.isNativePlatform();
      
      console.log('=== Platform Detection ===');
      console.log('Platform:', platform);
      console.log('Is Native:', isNative);
      console.log('User Agent:', navigator.userAgent);
      console.log('Capacitor Available:', typeof Capacitor !== 'undefined');
      
      setIsNativePlatform(isNative);
      
      if (isNative) {
        try {
          console.log('Attempting BLE initialization...');
          await BleClient.initialize();
          console.log('✅ BLE Client initialized successfully');
          setBleInitialized(true);
          
          // Check Bluetooth state after initialization
          await checkBluetoothState();
          setBleError(null);
        } catch (error) {
          console.error('❌ BLE initialization failed:', error);
          setBleError(`BLE initialization failed: ${error}`);
          setBleInitialized(false);
        }
      } else {
        console.log('❌ Not running on native platform - BLE unavailable');
        setBleError('BLE requires native platform (Android/iOS)');
        setBleInitialized(false);
      }
    };
    
    checkPlatform();
  }, []);

  // Process beacon data (real only)
  const processBeaconData = useCallback((beaconInfo: BeaconInfo) => {
    const beacon = beacons.find(b => b.id === beaconInfo.major);
    if (!beacon) {
      console.log('Unknown beacon major:', beaconInfo.major);
      return;
    }

    console.log('✅ Processing real beacon data:', beaconInfo);

    // Apply Kalman filter
    let filteredRSSI = beaconInfo.rssi;
    if (kalmanFilters[beacon.id]) {
      filteredRSSI = kalmanFilters[beacon.id].filter(beaconInfo.rssi);
    }

    const calculatedDistance = rssiToDistance(filteredRSSI, beaconInfo.txPower || txPower);
    
    // Update beacon data state with real values only
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

      return prev.filter(b => b.id !== beacon.id).concat(newBeacon);
    });
  }, [beacons, kalmanFilters, txPower]);

  // Real BLE scanning function with enhanced error handling
  const scanForBeacons = async () => {
    if (!isNativePlatform || !bleInitialized) {
      const errorMsg = !isNativePlatform ? 
        'BLE scanning requires native platform (Android/iOS)' : 
        'BLE not initialized - check permissions';
      setBleError(errorMsg);
      setScanStatus('Cannot scan - ' + errorMsg);
      console.error('Cannot start scan:', errorMsg);
      return;
    }

    try {
      console.log('=== Starting Enhanced BLE Scan ===');
      
      // Check Bluetooth state first
      const bluetoothOk = await checkBluetoothState();
      if (!bluetoothOk) {
        return;
      }

      // Request permissions if needed
      const permissionsOk = await requestPermissions();
      if (!permissionsOk) {
        return;
      }

      console.log('Looking for UUID:', uuid);
      setBleError(null);
      setScanStatus('Scanning for beacons...');
      setDevicesFound(0);
      
      // Start scanning with enhanced configuration
      await BleClient.requestLEScan({
        services: [], // Empty to scan all devices
        allowDuplicates: true, // Allow multiple readings from same device
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY // Fastest scanning
      }, (result: ScanResult) => {
        console.log('📡 BLE device detected:', {
          deviceId: result.device?.deviceId,
          name: result.device?.name || 'Unknown',
          rssi: result.rssi,
          hasManufacturerData: !!result.manufacturerData
        });
        
        setDevicesFound(prev => prev + 1);
        setScanStatus(`Scanning... (${devicesFound + 1} devices found)`);
        
        // Parse iBeacon data from advertisement
        const manufacturerData = result.manufacturerData;
        if (manufacturerData && manufacturerData['76']) { // Apple company identifier
          const rawData = manufacturerData['76'];
          console.log('🍎 Found Apple manufacturer data, parsing iBeacon...');
          console.log('Raw data type:', rawData?.constructor?.name);
          
          // Convert to ArrayBuffer safely
          const arrayBuffer = convertToArrayBuffer(rawData);
          
          if (arrayBuffer) {
            console.log('ArrayBuffer byteLength:', arrayBuffer.byteLength);
            
            // Pass ArrayBuffer directly to parseIBeaconData
            const beaconInfo = parseIBeaconData(arrayBuffer, result.rssi || -100);
            
            if (beaconInfo && beaconInfo.uuid.toLowerCase() === uuid.toLowerCase()) {
              console.log('🎯 Found matching beacon:', beaconInfo);
              setScanStatus(`Found beacon ${beaconInfo.major}!`);
              processBeaconData(beaconInfo);
            } else if (beaconInfo) {
              console.log('🔍 Found iBeacon but UUID mismatch:', beaconInfo.uuid, 'vs', uuid);
              setScanStatus(`Found other beacon (UUID: ${beaconInfo.uuid.slice(0, 8)}...)`);
            }
          } else {
            console.error('Failed to convert manufacturer data to ArrayBuffer');
          }
        } else {
          console.log('📱 Device without Apple manufacturer data:', result.device?.name || 'Unknown');
        }
      });

      console.log('✅ BLE scanning started successfully');
      setScanStatus('Scanning active...');
    } catch (error) {
      console.error('❌ BLE scanning error:', error);
      setBleError(`BLE scanning failed: ${error}`);
      setScanStatus(`Scan failed: ${error}`);
      setIsScanning(false);
    }
  };

  // Position calculation loop for real beacon data
  const calculateFromRealBeacons = useCallback(() => {
    if (!isScanning || !isNativePlatform || !bleInitialized) return;

    // Calculate position from real beacon data only
    if (beaconData.length >= 3) {
      const distances: { [key: number]: number } = {};
      beaconData.forEach(beacon => {
        distances[beacon.id] = beacon.distance;
      });

      const newPosition = calculatePosition(beacons, distances, currentPosition);
      setCurrentPosition(newPosition);
      setPositionHistory(prev => [...prev.slice(-50), newPosition]);
      
      console.log('📍 Position calculated:', newPosition, 'from', beaconData.length, 'beacons');
      setScanStatus(`Position calculated from ${beaconData.length} beacons`);
    } else {
      setScanStatus(`Need 3+ beacons for positioning (have ${beaconData.length})`);
    }
  }, [isScanning, beaconData, currentPosition, isNativePlatform, bleInitialized, beacons]);

  // Start/stop scanning
  useEffect(() => {
    if (isScanning) {
      if (isNativePlatform && bleInitialized) {
        console.log('Starting scan and position calculation...');
        scanForBeacons();
        intervalRef.current = setInterval(calculateFromRealBeacons, 1000);
      } else {
        console.log('Cannot scan - native platform:', isNativePlatform, 'BLE initialized:', bleInitialized);
        setScanStatus('Cannot scan - platform/init issue');
        setIsScanning(false);
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (isNativePlatform && bleInitialized) {
        BleClient.stopLEScan().catch(console.error);
        console.log('🛑 BLE scan stopped');
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
      setBleError('BLE scanning requires native platform (Android/iOS)');
      setScanStatus('Platform not supported');
      return;
    }
    
    if (!bleInitialized) {
      setBleError('BLE not initialized - check app permissions');
      setScanStatus('BLE not initialized');
      return;
    }

    // Check Bluetooth state before toggling
    if (!isScanning) {
      const bluetoothOk = await checkBluetoothState();
      if (!bluetoothOk) {
        return;
      }
    }
    
    console.log('Toggle scanning:', !isScanning);
    setIsScanning(!isScanning);
    if (!isScanning) {
      setPositionHistory([]);
      setBleError(null);
      setScanStatus('Starting scan...');
      setDevicesFound(0);
    } else {
      setScanStatus('Stopping scan...');
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
