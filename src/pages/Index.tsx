
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BeaconSimulator from '@/components/BeaconSimulator';
import PositionGrid from '@/components/PositionGrid';
import KalmanFilterDisplay from '@/components/KalmanFilterDisplay';
import { createKalmanFilters } from '@/utils/kalmanFilter';
import { useBLEScanner } from '@/hooks/useBLEScanner';

const Index = () => {
  const [simulatedPosition, setSimulatedPosition] = useState({ x: 2.5, y: 2.5 });
  const [kalmanFilters, setKalmanFilters] = useState({});

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

  // Initialize Kalman filters for each beacon
  useEffect(() => {
    const filters = createKalmanFilters(beacons);
    setKalmanFilters(filters);
  }, []);

  const {
    isScanning,
    currentPosition,
    beaconData,
    positionHistory,
    isNativePlatform,
    toggleScanning,
    resetScanning
  } = useBLEScanner(beacons, kalmanFilters, uuid, txPower);

  const resetSimulation = () => {
    resetScanning();
    setSimulatedPosition({ x: 2.5, y: 2.5 });
    
    // Reset Kalman filters
    const filters = createKalmanFilters(beacons);
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
