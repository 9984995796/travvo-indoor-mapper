
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

    console.log('Processing real beacon data:', beaconInfo);

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
        actualDistance: calculatedDistance, // Real distance calculation
        x: beacon.x,
        y: beacon.y,
        name: beacon.name
      };

      return prev.filter(b => b.id !== beacon.id).concat(newBeacon);
    });
  }, [beacons, kalmanFilters, txPower]);

  // Real BLE scanning function
  const scanForBeacons = async () => {
    if (!isNativePlatform || !bleInitialized) {
      const errorMsg = !isNativePlatform ? 
        'BLE scanning requires native platform (Android/iOS)' : 
        'BLE not initialized - check permissions';
      setBleError(errorMsg);
      console.error('Cannot start scan:', errorMsg);
      return;
    }

    try {
      console.log('=== Starting BLE Scan ===');
      console.log('Looking for UUID:', uuid);
      setBleError(null);
      
      // Start scanning with proper configuration
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, (result: ScanResult) => {
        console.log('📡 BLE scan result:', {
          deviceId: result.device?.deviceId,
          name: result.device?.name,
          rssi: result.rssi,
          manufacturerData: result.manufacturerData
        });
        
        // Parse iBeacon data from advertisement
        const manufacturerData = result.manufacturerData;
        if (manufacturerData && manufacturerData['76']) { // Apple company identifier
          const rawData = manufacturerData['76'] as any; // Type assertion to handle unknown type
          console.log('Found Apple manufacturer data, parsing iBeacon...');
          console.log('Raw data type:', rawData?.constructor?.name);
          
          // Convert to ArrayBuffer safely
          let arrayBuffer: ArrayBuffer;
          
          try {
            if (rawData instanceof ArrayBuffer) {
              arrayBuffer = rawData;
            } else if (rawData && typeof rawData === 'object' && rawData.buffer instanceof ArrayBuffer) {
              // Handle DataView or Uint8Array
              arrayBuffer = rawData.buffer.slice(
                rawData.byteOffset || 0, 
                (rawData.byteOffset || 0) + (rawData.byteLength || rawData.buffer.byteLength)
              );
            } else {
              console.log('Unknown manufacturer data type, attempting direct conversion');
              // Try to convert unknown type to ArrayBuffer
              const uint8Array = new Uint8Array(rawData);
              arrayBuffer = uint8Array.buffer;
            }
            
            console.log('ArrayBuffer byteLength:', arrayBuffer.byteLength);
            
            // Pass ArrayBuffer directly to parseIBeaconData
            const beaconInfo = parseIBeaconData(arrayBuffer, result.rssi || -100);
            
            if (beaconInfo && beaconInfo.uuid.toLowerCase() === uuid.toLowerCase()) {
              console.log('✅ Found matching beacon:', beaconInfo);
              processBeaconData(beaconInfo);
            } else if (beaconInfo) {
              console.log('Found iBeacon but UUID mismatch:', beaconInfo.uuid, 'vs', uuid);
            }
          } catch (conversionError) {
            console.error('Error converting manufacturer data to ArrayBuffer:', conversionError);
          }
        } else {
          console.log('No Apple manufacturer data found');
        }
      });

      console.log('✅ BLE scanning started successfully');
    } catch (error) {
      console.error('❌ BLE scanning error:', error);
      setBleError(`BLE scanning failed: ${error}`);
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
      
      console.log('Position calculated:', newPosition, 'from', beaconData.length, 'beacons');
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
        setIsScanning(false);
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (isNativePlatform && bleInitialized) {
        BleClient.stopLEScan().catch(console.error);
        console.log('BLE scan stopped');
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isScanning, calculateFromRealBeacons, isNativePlatform, bleInitialized]);

  const toggleScanning = () => {
    if (!isNativePlatform) {
      setBleError('BLE scanning requires native platform (Android/iOS)');
      return;
    }
    
    if (!bleInitialized) {
      setBleError('BLE not initialized - check app permissions');
      return;
    }
    
    console.log('Toggle scanning:', !isScanning);
    setIsScanning(!isScanning);
    if (!isScanning) {
      setPositionHistory([]);
      setBleError(null);
    }
  };

  const resetScanning = () => {
    console.log('Resetting scanner...');
    setIsScanning(false);
    setCurrentPosition({ x: 2.5, y: 2.5 });
    setBeaconData([]);
    setPositionHistory([]);
    setBleError(null);
  };

  return {
    isScanning,
    currentPosition,
    beaconData,
    positionHistory,
    isNativePlatform,
    bleError,
    bleInitialized,
    toggleScanning,
    resetScanning
  };
};
