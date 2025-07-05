
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if running on native platform
  useEffect(() => {
    setIsNativePlatform(Capacitor.isNativePlatform());
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
    if (!isNativePlatform) {
      console.log('Not on native platform - real BLE scanning not available');
      return;
    }

    try {
      // Initialize BLE
      await BleClient.initialize();
      
      // Request permissions
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, (result: ScanResult) => {
        // Parse iBeacon data from advertisement
        const manufacturerData = result.manufacturerData;
        if (manufacturerData && manufacturerData['76']) { // Apple company identifier
          const dataView = new DataView(manufacturerData['76']);
          const beaconInfo = parseIBeaconData(dataView, result.rssi || -100);
          if (beaconInfo && beaconInfo.uuid.toLowerCase() === uuid.toLowerCase()) {
            processBeaconData(beaconInfo);
          }
        }
      });

      console.log('Real BLE scanning started - looking for beacons with UUID:', uuid);
    } catch (error) {
      console.error('BLE scanning error:', error);
    }
  };

  // Position calculation loop for real beacon data
  const calculateFromRealBeacons = useCallback(() => {
    if (!isScanning || !isNativePlatform) return;

    // Calculate position from real beacon data only
    if (beaconData.length >= 3) {
      const distances: { [key: number]: number } = {};
      beaconData.forEach(beacon => {
        distances[beacon.id] = beacon.distance;
      });

      const newPosition = calculatePosition(beacons, distances, currentPosition);
      setCurrentPosition(newPosition);
      setPositionHistory(prev => [...prev.slice(-50), newPosition]);
    }
  }, [isScanning, beaconData, currentPosition, isNativePlatform, beacons]);

  // Start/stop scanning
  useEffect(() => {
    if (isScanning) {
      if (isNativePlatform) {
        scanForBeacons();
        intervalRef.current = setInterval(calculateFromRealBeacons, 1000); // 1 Hz
      } else {
        console.log('Web platform detected - real BLE scanning not available');
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (isNativePlatform) {
        BleClient.stopLEScan().catch(console.error);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isScanning, calculateFromRealBeacons, isNativePlatform]);

  const toggleScanning = () => {
    setIsScanning(!isScanning);
    if (!isScanning) {
      setPositionHistory([]);
    }
  };

  const resetScanning = () => {
    setIsScanning(false);
    setCurrentPosition({ x: 2.5, y: 2.5 });
    setBeaconData([]);
    setPositionHistory([]);
  };

  return {
    isScanning,
    currentPosition,
    beaconData,
    positionHistory,
    isNativePlatform,
    toggleScanning,
    resetScanning
  };
};
