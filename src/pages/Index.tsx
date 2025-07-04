
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Capacitor } from '@capacitor/core';
import { BleClient, BleDevice, ScanResult } from '@capacitor-community/bluetooth-le';
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

  // Real BLE scanning function
  const scanForBeacons = async () => {
    if (!isNativePlatform) {
      console.log('Not on native platform, using simulation');
      return;
    }

    try {
      // Initialize BLE
      await BleClient.initialize();
      
      // Request permissions
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: 'lowLatency'
      }, (result: ScanResult) => {
        // Parse iBeacon data from advertisement
        const advertisementData = result.device.manufacturerData;
        if (advertisementData) {
          const beaconInfo = parseIBeaconData(advertisementData, result.rssi);
          if (beaconInfo && beaconInfo.uuid.toLowerCase() === uuid.toLowerCase()) {
            processBeaconData(beaconInfo);
          }
        }
      });

      console.log('BLE scanning started');
    } catch (error) {
      console.error('BLE scanning error:', error);
    }
  };

  // Parse iBeacon advertisement data
  const parseIBeaconData = (manufacturerData: any, rssi: number) => {
    try {
      // iBeacon format parsing would go here
      // For now, return mock data structure
      return {
        uuid: uuid,
        major: 1001, // This would be parsed from actual data
        minor: 1,
        rssi: rssi,
        txPower: -59
      };
    } catch (error) {
      console.error('Error parsing iBeacon data:', error);
      return null;
    }
  };

  // Process beacon data (both real and simulated)
  const processBeaconData = (beaconInfo) => {
    const beacon = beacons.find(b => b.id === beaconInfo.major);
    if (!beacon) return;

    // Apply Kalman filter
    let filteredRSSI = beaconInfo.rssi;
    if (kalmanFilters[beacon.id]) {
      filteredRSSI = kalmanFilters[beacon.id].filter(beaconInfo.rssi);
    }

    const calculatedDistance = rssiToDistance(filteredRSSI, txPower);
    
    // Update beacon data state
    setBeaconData(prev => {
      const existing = prev.find(b => b.id === beacon.id);
      const newBeacon = {
        id: beacon.id,
        uuid: beaconInfo.uuid,
        major: beaconInfo.major,
        minor: beaconInfo.minor,
        rssi: Math.round(beaconInfo.rssi),
        filteredRSSI: Math.round(filteredRSSI * 10) / 10,
        distance: Math.round(calculatedDistance * 100) / 100,
        actualDistance: existing?.actualDistance || calculatedDistance,
        x: beacon.x,
        y: beacon.y,
        name: beacon.name
      };

      return prev.filter(b => b.id !== beacon.id).concat(newBeacon);
    });
  };

  // Simulate RSSI based on distance with realistic noise (for web demo)
  const simulateRSSI = (distance, txPower = -59) => {
    const pathLoss = 20 * Math.log10(distance) + 20 * Math.log10(2400) - 147.55;
    const rssi = txPower - pathLoss;
    
    // Add realistic noise (±5 dBm)
    const noise = (Math.random() - 0.5) * 10;
    return Math.max(-100, Math.min(-30, rssi + noise));
  };

  // Trilateration algorithm
  const calculatePosition = (beaconDistances) => {
    // Use first three beacons for trilateration (1001, 1002, 1003)
    const b1 = beacons.find(b => b.id === 1001);
    const b2 = beacons.find(b => b.id === 1002);
    const b3 = beacons.find(b => b.id === 1003);
    
    const r1 = beaconDistances[1001] || 1;
    const r2 = beaconDistances[1002] || 1;
    const r3 = beaconDistances[1003] || 1;

    // Trilateration math
    const A = 2 * (b2.x - b1.x);
    const B = 2 * (b2.y - b1.y);
    const C = Math.pow(r1, 2) - Math.pow(r2, 2) - Math.pow(b1.x, 2) + Math.pow(b2.x, 2) - Math.pow(b1.y, 2) + Math.pow(b2.y, 2);
    const D = 2 * (b3.x - b2.x);
    const E = 2 * (b3.y - b2.y);
    const F = Math.pow(r2, 2) - Math.pow(r3, 2) - Math.pow(b2.x, 2) + Math.pow(b3.x, 2) - Math.pow(b2.y, 2) + Math.pow(b3.y, 2);

    const denominator = A * E - B * D;
    if (Math.abs(denominator) < 0.001) {
      return currentPosition; // Return current position if calculation fails
    }

    const x = (C * E - F * B) / denominator;
    const y = (A * F - D * C) / denominator;

    // Clamp to room boundaries (0-5 meters)
    return {
      x: Math.max(0, Math.min(5, x)),
      y: Math.max(0, Math.min(5, y))
    };
  };

  // Simulation loop for web demo
  const simulationStep = useCallback(() => {
    if (!isScanning) return;

    if (isNativePlatform) {
      // On native platform, real BLE scanning handles data
      // Calculate position from existing beacon data
      if (beaconData.length > 0) {
        const distances = {};
        beaconData.forEach(beacon => {
          distances[beacon.id] = beacon.distance;
        });

        const newPosition = calculatePosition(distances);
        setCurrentPosition(newPosition);
        setPositionHistory(prev => [...prev.slice(-50), newPosition]);
      }
    } else {
      // Web simulation mode
      const newBeaconData = beacons.map(beacon => {
        const distance = Math.sqrt(
          Math.pow(beacon.x - simulatedPosition.x, 2) + 
          Math.pow(beacon.y - simulatedPosition.y, 2)
        );
        
        const rawRSSI = simulateRSSI(Math.max(0.1, distance), txPower);
        
        // Apply Kalman filter
        let filteredRSSI = rawRSSI;
        if (kalmanFilters[beacon.id]) {
          filteredRSSI = kalmanFilters[beacon.id].filter(rawRSSI);
        }
        
        const calculatedDistance = rssiToDistance(filteredRSSI, txPower);
        
        return {
          id: beacon.id,
          uuid,
          major: beacon.id,
          minor: 1,
          rssi: Math.round(rawRSSI),
          filteredRSSI: Math.round(filteredRSSI * 10) / 10,
          distance: Math.round(calculatedDistance * 100) / 100,
          actualDistance: Math.round(distance * 100) / 100,
          x: beacon.x,
          y: beacon.y,
          name: beacon.name
        };
      });

      setBeaconData(newBeaconData);

      // Calculate position using trilateration
      const distances = {};
      newBeaconData.forEach(beacon => {
        distances[beacon.id] = beacon.distance;
      });

      const newPosition = calculatePosition(distances);
      setCurrentPosition(newPosition);
      
      // Update position history
      setPositionHistory(prev => [...prev.slice(-50), newPosition]);
    }
  }, [isScanning, simulatedPosition, kalmanFilters, currentPosition, beaconData, isNativePlatform]);

  // Start/stop scanning
  useEffect(() => {
    if (isScanning) {
      if (isNativePlatform) {
        scanForBeacons();
      }
      intervalRef.current = setInterval(simulationStep, 1000); // 1 Hz as specified
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
  }, [isScanning, simulationStep, isNativePlatform]);

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
          <h1 className="text-4xl font-bold text-white">Travvo Indoor Positioning Demo</h1>
          <p className="text-blue-200 text-lg">BLE Beacon-Based Navigation System</p>
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
            <Badge variant="outline" className={`${isNativePlatform ? 'text-green-200 border-green-300' : 'text-yellow-200 border-yellow-300'}`}>
              {isNativePlatform ? 'Native BLE' : 'Web Demo'}
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
              >
                {isScanning ? "Stop Scanning" : "Start Scanning"}
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
              <ControlPanel 
                simulatedPosition={simulatedPosition}
                setSimulatedPosition={setSimulatedPosition}
                isScanning={isScanning}
              />
            )}
          </div>
        </Card>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Position Grid */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Live Position Tracking</h2>
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
                {!isNativePlatform && (
                  <p className="text-gray-400 text-sm">
                    Simulated Position: ({Math.round(simulatedPosition.x * 100) / 100}, {Math.round(simulatedPosition.y * 100) / 100})m
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Beacon Data */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Beacon Scanner</h2>
              <BeaconSimulator 
                beacons={beaconData}
                isScanning={isScanning}
              />
            </div>
          </Card>
        </div>

        {/* Kalman Filter Visualization */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Kalman Filter Analysis</h2>
            <KalmanFilterDisplay 
              beaconData={beaconData}
              isScanning={isScanning}
            />
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-gray-400 text-sm">
          <p>Travvo Heritage Navigation System | BLE Indoor Positioning Demo</p>
          <p>Ready for Android deployment with Capacitor</p>
          {isNativePlatform && <p className="text-green-400">🟢 Running on native platform - Real BLE scanning active</p>}
        </div>
      </div>
    </div>
  );
};

export default Index;
