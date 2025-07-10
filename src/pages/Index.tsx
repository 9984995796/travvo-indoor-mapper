import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BeaconSimulator from '@/components/BeaconSimulator';
import PositionGrid from '@/components/PositionGrid';
import KalmanFilterDisplay from '@/components/KalmanFilterDisplay';
import BLEDeviceScanner from '@/components/BLEDeviceScanner';
import { createKalmanFilters } from '@/utils/kalmanFilter';
import { useBLEScanner } from '@/hooks/useBLEScanner';
import { Capacitor } from '@capacitor/core';
import IndividualBeaconScanner from '@/components/IndividualBeaconScanner';

const Index = () => {
  const [simulatedPosition, setSimulatedPosition] = useState({ x: 2.5, y: 2.5 });
  const [kalmanFilters, setKalmanFilters] = useState({});
  const [platformInfo, setPlatformInfo] = useState({
    platform: '',
    isNative: false,
    userAgent: ''
  });

  // Updated beacon configuration for real-time tracking
  const beacons = [
    { id: 1001, x: 0, y: 0, name: "Corner NW", deviceName: "POI-1" },
    { id: 1002, x: 5, y: 0, name: "Corner NE", deviceName: "POI-2" },
    { id: 1003, x: 0, y: 5, name: "Corner SW", deviceName: "POI-3" },
    { id: 1004, x: 5, y: 5, name: "Corner SE", deviceName: "POI-4" },
    { id: 1005, x: 2.5, y: 2.5, name: "Center", deviceName: "POI-5" }
  ];

  // CORRECTED UUID and TxPower for accurate distance calculation
  const uuid = "AB907856-3412-3412-3412-341278563412"; // Corrected format
  const txPower = -59; // Your beacons broadcast at -59 dBm

  // Get platform info for debugging
  useEffect(() => {
    setPlatformInfo({
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
      userAgent: navigator.userAgent
    });
    console.log('🎯 REAL-TIME BEACON TRACKING CONFIGURATION:');
    console.log('🎯 Target device names:', beacons.map(b => `${b.deviceName} (${b.name})`));
    console.log('🎯 UUID (corrected):', uuid);
    console.log('🎯 TxPower:', txPower, 'dBm');
    console.log('🎯 Update rate: 1Hz for live tracking');
    console.log('🎯 Expected distance range: 1-2m indoors');
    console.log('Platform Info:', {
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
      userAgent: navigator.userAgent
    });
  }, []);

  // Initialize Kalman filters for each beacon
  useEffect(() => {
    const filters = createKalmanFilters(beacons);
    setKalmanFilters(filters);
    console.log('📊 Kalman filters initialized for all beacons');
  }, []);

  const {
    isScanning,
    currentPosition,
    beaconData,
    positionHistory,
    isNativePlatform,
    bleError,
    bluetoothEnabled,
    scanStatus,
    devicesFound,
    toggleScanning,
    resetScanning,
    restartScanning
  } = useBLEScanner(beacons, kalmanFilters, uuid, txPower);

  const resetSimulation = () => {
    resetScanning();
    setSimulatedPosition({ x: 2.5, y: 2.5 });
    
    // Reset Kalman filters
    const filters = createKalmanFilters(beacons);
    setKalmanFilters(filters);
    console.log('🔄 Full system reset complete');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Travvo Indoor Positioning System</h1>
          <p className="text-blue-200 text-lg">Real-Time BLE Beacon Navigation (1Hz Updates)</p>
          <div className="flex justify-center gap-4 items-center flex-wrap">
            <Badge variant="outline" className="text-blue-200 border-blue-300">
              Method: Name-Based + Live RSSI
            </Badge>
            <Badge variant="outline" className="text-blue-200 border-blue-300">
              5×5m Room
            </Badge>
            <Badge variant="outline" className="text-blue-200 border-blue-300">
              POI-1 to POI-5
            </Badge>
            <Badge variant="outline" className="text-blue-200 border-blue-300">
              TxPower: {txPower}dBm
            </Badge>
            <Badge variant="outline" className={`${isNativePlatform ? 'text-green-200 border-green-300' : 'text-red-200 border-red-300'}`}>
              {isNativePlatform ? 'Native Platform Detected' : `Platform: ${platformInfo.platform}`}
            </Badge>
            <Badge variant="outline" className={`${bluetoothEnabled ? 'text-green-200 border-green-300' : 'text-red-200 border-red-300'}`}>
              Bluetooth: {bluetoothEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="beacon-tracking" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border-slate-700">
            <TabsTrigger value="beacon-tracking" className="data-[state=active]:bg-slate-700">
              Real-Time Beacon Tracking
            </TabsTrigger>
            <TabsTrigger value="ble-scanner" className="data-[state=active]:bg-slate-700">
              BLE Device Scanner
            </TabsTrigger>
          </TabsList>

          {/* Beacon Tracking Tab */}
          <TabsContent value="beacon-tracking" className="space-y-6">
            {/* ENHANCED Control Panel with Restart Button */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex justify-center gap-4 mb-4">
                  <Button 
                    onClick={toggleScanning}
                    variant={isScanning ? "destructive" : "default"}
                    size="lg"
                    className="min-w-32"
                    disabled={!isNativePlatform || !bluetoothEnabled}
                  >
                    {isScanning ? "Stop Live Tracking" : "Start Live Tracking (1Hz)"}
                  </Button>
                  <Button 
                    onClick={restartScanning}
                    variant="outline"
                    size="lg"
                    disabled={!isNativePlatform || !bluetoothEnabled}
                  >
                    Restart Scan
                  </Button>
                  <Button 
                    onClick={resetScanning}
                    variant="outline"
                    size="lg"
                  >
                    Reset
                  </Button>
                </div>
                
                {/* ENHANCED Live Status Display */}
                {isNativePlatform && (
                  <div className="mb-4 p-4 bg-slate-700/30 border border-slate-600 rounded-lg">
                    <h3 className="text-white font-semibold mb-2">Live Tracking Status (Optimized)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Status:</p>
                        <p className={`font-mono text-xs ${isScanning ? 'text-green-400' : 'text-gray-300'}`}>
                          {scanStatus || 'Ready for tracking'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">BLE Devices:</p>
                        <p className="text-blue-400 font-mono">{devicesFound}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Active Beacons:</p>
                        <p className="text-green-400 font-mono">{beaconData.length}/5</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Live Position:</p>
                        <p className="text-yellow-400 font-mono text-xs">
                          ({currentPosition.x.toFixed(2)}, {currentPosition.y.toFixed(2)})m
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ENHANCED Live Beacon Data Display */}
                {beaconData.length > 0 && (
                  <div className="mb-4 p-4 bg-slate-700/30 border border-slate-600 rounded-lg">
                    <h3 className="text-white font-semibold mb-3">Live Beacon Data (Optimized Updates)</h3>
                    <div className="space-y-2">
                      {beaconData.map(beacon => (
                        <div key={beacon.id} className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                          <div>
                            <span className="text-gray-400">{beacon.name}:</span>
                          </div>
                          <div>
                            <span className="text-blue-400">RSSI: {beacon.rssi}dBm</span>
                          </div>
                          <div>
                            <span className="text-green-400">Filtered: {beacon.filteredRSSI}dBm</span>
                          </div>
                          <div>
                            <span className="text-yellow-400">Dist: {beacon.distance}m</span>
                          </div>
                          <div>
                            <span className="text-purple-400">Pos: ({beacon.x},{beacon.y})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* ENHANCED Debug Information */}
                <div className="mb-4 p-4 bg-slate-700/30 border border-slate-600 rounded-lg">
                  <h3 className="text-white font-semibold mb-2">Live Calculations & Debug</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Distance Formula:</p>
                      <p className="text-blue-300 text-xs font-mono">10^((TxPower - RSSI) / (10 * 2.0))</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Trilateration:</p>
                      <p className="text-green-300 text-xs font-mono">Linear system (POI-1,POI-2,POI-3)</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Performance:</p>
                      <p className="text-yellow-300 text-xs font-mono">Optimized for Android</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-gray-400 text-xs">Expected Range: 0.5-10m | TxPower: {txPower}dBm | Path Loss: n=2.0</p>
                  </div>
                </div>
                
                {/* Status Messages */}
                {!bluetoothEnabled && isNativePlatform && (
                  <div className="text-center p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                    <p className="text-orange-200 font-semibold">🔵 Bluetooth Required</p>
                    <p className="text-orange-300 text-sm mt-2">
                      Please enable Bluetooth in your device settings and restart the app.
                    </p>
                  </div>
                )}

                {!isNativePlatform && (
                  <div className="text-center p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <p className="text-red-200 font-semibold">⚠️ BLE Scanning Issue Detected</p>
                    <p className="text-red-300 text-sm mt-2">
                      Platform: {platformInfo.platform} | Native: {platformInfo.isNative ? 'Yes' : 'No'}
                    </p>
                    <p className="text-red-300 text-sm mt-1">
                      To fix this: Build the app natively using `npm run build && npx cap sync && npx cap run android`
                    </p>
                  </div>
                )}

                {bleError && (
                  <div className="text-center p-4 bg-red-900/20 border border-red-500/30 rounded-lg mt-4">
                    <p className="text-red-200 font-semibold">BLE Error</p>
                    <p className="text-red-300 text-sm mt-2">{bleError}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Position Grid with Live Updates */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Real-Time Position Tracking (500×500px Grid)</h2>
                  <PositionGrid 
                    beacons={beacons}
                    currentPosition={currentPosition}
                    simulatedPosition={simulatedPosition}
                    positionHistory={positionHistory}
                    isScanning={isScanning}
                  />
                  <div className="mt-4 text-center">
                    <p className="text-blue-200">
                      Live Position: ({Math.round(currentPosition.x * 100) / 100}, {Math.round(currentPosition.y * 100) / 100})m
                    </p>
                    <p className="text-gray-400 text-sm">
                      Grid: 500×500px | Scale: 100px/meter | Red dot: 20×20px
                    </p>
                    {isNativePlatform && isScanning && (
                      <p className="text-green-400 text-sm mt-1">
                        📡 Live tracking at 1Hz with trilateration...
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Individual Beacon Scanners */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Individual Beacon Scanner</h2>
                  <p className="text-gray-300 text-sm mb-6">
                    Scan each POI beacon individually by device name to test connectivity and view detailed information.
                  </p>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {beacons.map(beacon => (
                      <IndividualBeaconScanner
                        key={beacon.id}
                        beacon={beacon}
                        uuid={uuid}
                        txPower={txPower}
                        isNativePlatform={isNativePlatform}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Combined Data Display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Real-Time Beacon Data */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Live Beacon Data (1Hz)</h2>
                  <p className="text-gray-300 text-sm mb-4">
                    Real-time RSSI, filtered values, and distance calculations updated every second.
                  </p>
                  <BeaconSimulator 
                    beacons={beaconData}
                    isScanning={isScanning && isNativePlatform}
                  />
                </div>
              </Card>

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
            </div>
          </TabsContent>

          {/* BLE Device Scanner Tab */}
          <TabsContent value="ble-scanner" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-white mb-4">General BLE Device Scanner</h2>
                <p className="text-gray-300 text-sm mb-6">
                  This scanner finds ALL BLE devices nearby (like nRF Connect). Use it to verify if your ESP32 beacons are advertising with names POI-1 to POI-5.
                </p>
                <BLEDeviceScanner />
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center text-gray-400 text-sm">
          <p>Travvo Heritage Navigation System | Real-Time BLE Indoor Positioning (1Hz)</p>
          <p>Build natively with: npm run build && npx cap sync && npx cap run android</p>
          {isNativePlatform ? (
            <p className="text-green-400">🟢 Native platform detected - Real-time BLE tracking active</p>
          ) : (
            <p className="text-red-400">🔴 Web platform detected - Build natively for BLE functionality</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
