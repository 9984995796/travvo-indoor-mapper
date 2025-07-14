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
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      
      console.log('=== OPTIMIZED BEACON TRACKING INIT ===');
      console.log('🔍 Platform:', platform);
      console.log('🔍 Is Native:', isNative);
      
      setIsNativePlatform(isNative);
      
      if (isNative) {
        try {
          const bleSupported = await checkBLESupport();
          if (!bleSupported) {
            setBleError('BLE not supported on this device');
            setScanStatus('BLE not supported');
            return;
          }

          console.log('✅ BLE Client initialized for optimized tracking');
          setBleInitialized(true);
          
          const bluetoothOk = await checkBluetoothState();
          if (bluetoothOk) {
            setBleError(null);
            setScanStatus('BLE ready - optimized scanning');
          }
        } catch (error) {
          console.error('❌ BLE initialization failed:', error);
          setBleError(`BLE initialization failed: ${error}`);
          setBleInitialized(false);
          setScanStatus(`Init failed: ${error}`);
        }
      } else {
        setBleError('BLE requires native platform (Android/iOS)');
        setScanStatus('Not native platform');
      }
    };
    
    initializeBLE();
  }, [beacons, txPower]);

  // OPTIMIZED: Process beacon data with reduced logging
  const processBeaconByName = useCallback((deviceName: string, rssi: number, txPowerFromDevice?: number) => {
    const beacon = beacons.find(b => b.deviceName === deviceName);
    if (!beacon) {
      return;
    }

    // Apply Kalman filter for RSSI smoothing
    let filteredRSSI = rssi;
    if (kalmanFilters[beacon.id]) {
      filteredRSSI = kalmanFilters[beacon.id].filter(rssi);
    }

  // CORRECTED: Calculate distance with fixed formula and logging
    const calculatedDistance = rssiToDistance(filteredRSSI, txPowerFromDevice || txPower);
    console.log(`🔧 ${deviceName}: Raw=${rssi}dBm → Filtered=${filteredRSSI.toFixed(1)}dBm → Distance=${calculatedDistance.toFixed(2)}m`);
    
    // Update beacon data state
    setBeaconData(prev => {
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
      return [...filtered, newBeacon];
    });
  }, [beacons, kalmanFilters, txPower]);

  // OPTIMIZED: Enhanced BLE scanning with retry logic
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
      console.log('🚀 Starting optimized beacon scan...');
      
      // Check Bluetooth state
      const bluetoothOk = await checkBluetoothState();
      if (!bluetoothOk) {
        // Retry after 5 seconds
        console.log('⏰ Bluetooth not ready, retrying in 5s...');
        retryTimeoutRef.current = setTimeout(() => {
          scanForBeacons();
        }, 5000);
        return;
      }

      // Request permissions
      const permissionsOk = await requestAllPermissions();
      if (!permissionsOk) {
        console.log('⏰ Permissions not ready, retrying in 5s...');
        retryTimeoutRef.current = setTimeout(() => {
          scanForBeacons();
        }, 5000);
        return;
      }

      setBleError(null);
      setScanStatus('Optimized scanning active...');
      setDevicesFound(0);
      
      // OPTIMIZED: Start scanning with better settings
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, (result: ScanResult) => {
        setDevicesFound(prev => prev + 1);
        
        const deviceName = result.device?.name || result.localName || 'Unknown';
        const targetNames = beacons.map(b => b.deviceName);
        const isTargetBeacon = targetNames.includes(deviceName) || 
                              (result.localName && targetNames.includes(result.localName));

        if (isTargetBeacon) {
          const matchedName = targetNames.includes(deviceName) ? deviceName : result.localName!;
          setScanStatus(`Live: ${matchedName} (${result.rssi}dBm)`);
          console.log(`🎯 LIVE BEACON: ${matchedName} RSSI=${result.rssi}dBm TxPower=${result.txPower || txPower}dBm`);
          processBeaconByName(matchedName, result.rssi || -100, result.txPower || txPower);
        }
      });

      console.log('✅ Optimized BLE scan started');
      setScanStatus('Scanning optimized for performance...');
      
    } catch (error) {
      console.error('❌ BLE scanning error:', error);
      setBleError(`Scan failed: ${error}`);
      setScanStatus(`Scan error: ${error}`);
      setIsScanning(false);
      
      // Auto-retry after 5 seconds
      console.log('⏰ Auto-retry in 5 seconds...');
      retryTimeoutRef.current = setTimeout(() => {
        if (isScanning) {
          scanForBeacons();
        }
      }, 5000);
    }
  };

  // CORRECTED: Real-time position calculation with guaranteed updates
  const calculateFromRealBeacons = useCallback(() => {
    console.log(`🔄 POSITION CALC: scanning=${isScanning}, native=${isNativePlatform}, init=${bleInitialized}, beacons=${beaconData.length}`);
    
    if (!isScanning || !isNativePlatform || !bleInitialized) {
      console.log('❌ Position calc skipped - prerequisites not met');
      return;
    }

    if (beaconData.length < 3) {
      console.log(`❌ Position calc skipped - need 3+ beacons, have ${beaconData.length}`);
      return;
    }

    console.log('📊 Starting trilateration with beacon data:', beaconData.map(b => `${b.name}=${b.actualDistance.toFixed(2)}m`));

    const distances: { [key: number]: number } = {};
    beaconData.forEach(beacon => {
      distances[beacon.id] = beacon.actualDistance;
      console.log(`  ${beacon.name} (ID:${beacon.id}): ${beacon.actualDistance.toFixed(2)}m`);
    });

    const newPosition = calculatePosition(beacons, distances, currentPosition);
    
    console.log(`📍 TRILATERATION: (${currentPosition.x.toFixed(3)}, ${currentPosition.y.toFixed(3)}) → (${newPosition.x.toFixed(3)}, ${newPosition.y.toFixed(3)})`);
    
    // CORRECTED: Always update position, even small changes are important for live tracking
    const moved = Math.abs(newPosition.x - currentPosition.x) > 0.001 || 
                  Math.abs(newPosition.y - currentPosition.y) > 0.001;
    
    if (moved || true) { // Force updates for live tracking
      console.log(`📍 POSITION UPDATE: (${newPosition.x.toFixed(3)}, ${newPosition.y.toFixed(3)})`);
      setCurrentPosition(newPosition);
      setPositionHistory(prev => [...prev.slice(-49), newPosition]);
      setScanStatus(`Live Position: (${newPosition.x.toFixed(1)}, ${newPosition.y.toFixed(1)})m`);
    } else {
      console.log(`📍 Position stable at (${newPosition.x.toFixed(3)}, ${newPosition.y.toFixed(3)})`);
    }
  }, [isScanning, beaconData, currentPosition, isNativePlatform, bleInitialized, beacons]);

  // OPTIMIZED: Start/stop scanning with better management
  useEffect(() => {
    if (isScanning) {
      if (isNativePlatform && bleInitialized) {
        scanForBeacons();
        
        // Position calculation every 1 second
        positionIntervalRef.current = setInterval(calculateFromRealBeacons, 1000);
      } else {
        setIsScanning(false);
        setScanStatus('Cannot scan - platform/init issue');
      }
    } else {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
        positionIntervalRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
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
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
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

    if (!isScanning) {
      const bluetoothOk = await checkBluetoothState();
      if (!bluetoothOk) {
        return;
      }
    }
    
    setIsScanning(!isScanning);
    
    if (!isScanning) {
      setBeaconData([]);
      setPositionHistory([]);
      setBleError(null);
      setDevicesFound(0);
    }
  };

  // ADDED: Manual scan restart function
  const restartScanning = async () => {
    console.log('🔄 Manually restarting scan...');
    setIsScanning(false);
    
    // Clear all intervals and timeouts
    if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current);
      positionIntervalRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    // Stop current scan
    if (isNativePlatform && bleInitialized) {
      try {
        await BleClient.stopLEScan();
      } catch (error) {
        console.log('Stop scan error (ignored):', error);
      }
    }
    
    // Reset data
    setBeaconData([]);
    setPositionHistory([]);
    setBleError(null);
    setDevicesFound(0);
    setScanStatus('Manual restart...');
    
    // Restart after short delay
    setTimeout(() => {
      setIsScanning(true);
    }, 1000);
  };

  const resetScanning = () => {
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
    resetScanning,
    restartScanning
  };
};
