
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Capacitor } from '@capacitor/core';
import { BleClient, BleDevice, ScanResult, ScanMode } from '@capacitor-community/bluetooth-le';
import BeaconSimulator from '@/components/BeaconSimulator';
import PositionGrid from '@/components/PositionGrid';
import KalmanFilterDisplay from '@/components/KalmanFilterDisplay';
import ControlPanel from '@/components/ControlPanel';

const Index = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [currentPosition, setCurrentPosition] = useState({ x: 2.5, y: 2.5 });
  const [simulatedPosition, setSimulatedPosition] = useState({ x: 2.5, y: 2.5 });
  const [beaconData, setBeaconData] = useState([]);
  const [kalmanFilters, setKalmanFilters] = useState({});
  const [positionHistory, setPositionHistory] = useState([]);
  const [isNativePlatform, setIsNativePlatform] = useState(false);
  const intervalRef = useRef(null);

  // Your actual beacon configuration
  const beacons = [
    { id: 1001, x: 0, y: 0, name: "Corner NW" },
    { id: 1002, x: 5, y: 0, name: "Corner NE" },
    { id: 1003, x: 0, y: 5, name: "Corner SW" },
    { id: 1004, x: 5, y: 5, name: "Corner SE" },
    { id: 1005, x: 2.5, y: 2.5, name: "Center" }
  ];

  const uuid = "12345678-1234-1234-1234-1234567890ab";
  const txPower = -59;

  // Check if running on native platform
  useEffect(() => {
    setIsNativePlatform(Capacitor.isNativePlatform());
  }, []);

  // Kalman Filter Implementation
  class KalmanFilter {
    public Q: number; // Process noise
    public R: number; // Measurement noise
    public P: number; // Estimation error covariance
    public K: number; // Kalman gain
    public X: number; // Value

    constructor(processNoise = 0.0001, measurementNoise = 0.01, estimation = 0) {
      this.Q = processNoise;
      this.R = measurementNoise;
      this.P = 1.0;
      this.K = 0;
      this.X = estimation;
    }

    filter(measurement: number) {
      // Prediction update
      this.P = this.P + this.Q;
      
      // Measurement update
      this.K = this.P / (this.P + this.R);
      this.X = this.X + this.K * (measurement - this.X);
      this.P = (1 - this.K) * this.P;
      
      return this.X;
    }
  }

  // Initialize Kalman filters for each beacon
  useEffect(() => {
    const filters = {};
    beacons.forEach(beacon => {
      filters[beacon.id] = new KalmanFilter();
    });
    setKalmanFilters(filters);
  }, []);

  // RSSI to distance conversion using path-loss model
  const rssiToDistance = (rssi, txPower = -59) => {
    if (rssi === 0) return -1.0;
    
    const ratio = (txPower - rssi) / 20.0;
    return Math.pow(10, ratio);
  };

  // Parse iBeacon advertisement data
  const parseIBeaconData = (manufacturerData: DataView, rssi: number) => {
    try {
      // iBeacon format: 
      // Bytes 0-1: Company identifier (0x004C for Apple)
      // Byte 2: iBeacon type (0x02)
      // Byte 3: iBeacon length (0x15)
      // Bytes 4-19: UUID (16 bytes)
      // Bytes 20-21: Major (2 bytes)
      // Bytes 22-23: Minor (2 bytes)
      // Byte 24: TX Power (1 byte)
      
      if (manufacturerData.byteLength < 25) return null;
      
      const companyId = manufacturerData.getUint16(0, true);
      const beaconType = manufacturerData.getUint8(2);
      const beaconLength = manufacturerData.getUint8(3);
      
      // Check if it's an iBeacon (Apple company ID and correct format)
      if (companyId !== 0x004C || beaconType !== 0x02 || beaconLength !== 0x15) {
        return null;
      }
      
      // Extract UUID
      const uuidBytes = [];
      for (let i = 4; i < 20; i++) {
        uuidBytes.push(manufacturerData.getUint8(i).toString(16).padStart(2, '0'));
      }
      const extractedUuid = [
        uuidBytes.slice(0, 4).join(''),
        uuidBytes.slice(4, 6).join(''),
        uuidBytes.slice(6, 8).join(''),
        uuidBytes.slice(8, 10).join(''),
        uuidBytes.slice(10, 16).join('')
      ].join('-');
      
      // Extract Major and Minor
      const major = manufacturerData.getUint16(20, false); // Big endian
      const minor = manufacturerData.getUint16(22, false); // Big endian
      const txPowerByte = manufacturerData.getInt8(24);
      
      return {
        uuid: extractedUuid,
        major: major,
        minor: minor,
        rssi: rssi,
        txPower: txPowerByte
      };
    } catch (error) {
      console.error('Error parsing iBeacon data:', error);
      return null;
    }
  };

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

  // Process beacon data (real only)
  const processBeaconData = (beaconInfo) => {
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
      const newBeacon = {
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
  };

  // Trilateration algorithm
  const calculatePosition = (beaconDistances) => {
    // Use first three beacons for trilateration (1001, 1002, 1003)
    const b1 = beacons.find(b => b.id === 1001);
    const b2 = beacons.find(b => b.id === 1002);
    const b3 = beacons.find(b => b.id === 1003);
    
    const r1 = beaconDistances[1001];
    const r2 = beaconDistances[1002];
    const r3 = beaconDistances[1003];

    if (!r1 || !r2 || !r3) {
      console.log('Insufficient beacon data for trilateration');
      return currentPosition;
    }

    // Trilateration math
    const A = 2 * (b2.x - b1.x);
    const B = 2 * (b2.y - b1.y);
    const C = Math.pow(r1, 2) - Math.pow(r2, 2) - Math.pow(b1.x, 2) + Math.pow(b2.x, 2) - Math.pow(b1.y, 2) + Math.pow(b2.y, 2);
    const D = 2 * (b3.x - b2.x);
    const E = 2 * (b3.y - b2.y);
    const F = Math.pow(r2, 2) - Math.pow(r3, 2) - Math.pow(b2.x, 2) + Math.pow(b3.x, 2) - Math.pow(b2.y, 2) + Math.pow(b3.y, 2);

    const denominator = A * E - B * D;
    if (Math.abs(denominator) < 0.001) {
      console.log('Trilateration calculation failed - denominator too small');
      return currentPosition;
    }

    const x = (C * E - F * B) / denominator;
    const y = (A * F - D * C) / denominator;

    // Clamp to room boundaries (0-5 meters)
    const newPosition = {
      x: Math.max(0, Math.min(5, x)),
      y: Math.max(0, Math.min(5, y))
    };

    console.log('Calculated position from real beacons:', newPosition);
    return newPosition;
  };

  // Position calculation loop for real beacon data
  const calculateFromRealBeacons = useCallback(() => {
    if (!isScanning || !isNativePlatform) return;

    // Calculate position from real beacon data only
    if (beaconData.length >= 3) {
      const distances = {};
      beaconData.forEach(beacon => {
        distances[beacon.id] = beacon.distance;
      });

      const newPosition = calculatePosition(distances);
      setCurrentPosition(newPosition);
      setPositionHistory(prev => [...prev.slice(-50), newPosition]);
    }
  }, [isScanning, beaconData, currentPosition, isNativePlatform]);

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

  const resetSimulation = () => {
    setIsScanning(false);
    setCurrentPosition({ x: 2.5, y: 2.5 });
    setSimulatedPosition({ x: 2.5, y: 2.5 });
    setBeaconData([]);
    setPositionHistory([]);
    
    // Reset Kalman filters
    const filters = {};
    beacons.forEach(beacon => {
      filters[beacon.id] = new KalmanFilter();
    });
    setKalmanFilters(filters);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Travvo Indoor Positioning System</h1>
          <p className="text-blue-200 text-lg">Real BLE Beacon-Based Navigation</p>
          <div className="flex justify-center gap-4 items-center">
            <Badge variant="outline" className="text-blue-200 border-blue-300">
              UUID: {uuid.slice(0, 8)}...
            </Badge>
            <Badge variant="outline" className="text-blue-200 border-blue-300">
              5×5m Room
            </Badge>
            <Badge variant="outline" className="text-blue-200 border-blue-300">
              5 ESP32 Beacons
            </Badge>
            <Badge variant="outline" className={`${isNativePlatform ? 'text-green-200 border-green-300' : 'text-red-200 border-red-300'}`}>
              {isNativePlatform ? 'Real BLE Mode' : 'Web Platform - BLE Not Available'}
            </Badge>
          </div>
        </div>

        {/* Control Panel */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <div className="p-6">
            <div className="flex justify-center gap-4 mb-4">
              <Button 
                onClick={toggleScanning}
                variant={isScanning ? "destructive" : "default"}
                size="lg"
                className="min-w-32"
                disabled={!isNativePlatform}
              >
                {isScanning ? "Stop Scanning" : "Start BLE Scan"}
              </Button>
              <Button 
                onClick={resetSimulation}
                variant="outline"
                size="lg"
              >
                Reset
              </Button>
            </div>
            
            {!isNativePlatform && (
              <div className="text-center p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                <p className="text-red-200 font-semibold">⚠️ Real BLE Scanning Not Available</p>
                <p className="text-red-300 text-sm mt-2">
                  This app requires a native mobile platform (Android/iOS) to scan for real BLE beacons.
                  Deploy to your mobile device to use real beacon functionality.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Position Grid */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Real-Time Position Tracking</h2>
              <PositionGrid 
                beacons={beacons}
                currentPosition={currentPosition}
                simulatedPosition={simulatedPosition}
                positionHistory={positionHistory}
                isScanning={isScanning}
              />
              <div className="mt-4 text-center">
                <p className="text-blue-200">
                  Calculated Position: ({Math.round(currentPosition.x * 100) / 100}, {Math.round(currentPosition.y * 100) / 100})m
                </p>
                {isNativePlatform && isScanning && (
                  <p className="text-green-400 text-sm mt-1">
                    📡 Scanning for real BLE beacons...
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Beacon Data */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Real Beacon Scanner</h2>
              <BeaconSimulator 
                beacons={beaconData}
                isScanning={isScanning && isNativePlatform}
              />
            </div>
          </Card>
        </div>

        {/* Kalman Filter Visualization */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Real-Time Kalman Filter Analysis</h2>
            <KalmanFilterDisplay 
              beaconData={beaconData}
              isScanning={isScanning && isNativePlatform}
            />
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-gray-400 text-sm">
          <p>Travvo Heritage Navigation System | Real BLE Indoor Positioning</p>
          <p>Deploy to Android/iOS device for full functionality</p>
          {isNativePlatform ? (
            <p className="text-green-400">🟢 Native platform detected - Real BLE scanning available</p>
          ) : (
            <p className="text-red-400">🔴 Web platform - Deploy to mobile device for real BLE functionality</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
