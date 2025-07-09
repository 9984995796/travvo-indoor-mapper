
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

  // Your actual beacon configuration
  const beacons = [
    { id: 1001, x: 0, y: 0, name: "Corner NW" },
    { id: 1002, x: 5, y: 0, name: "Corner NE" },
    { id: 1003, x: 0, y: 5, name: "Corner SW" },
    { id: 1004, x: 5, y: 5, name: "Corner SE" },
    { id: 1005, x: 2.5, y: 2.5, name: "Center" }
  ];

  // CORRECTED UUID based on NRF Connect screenshots
  const uuid = "ab907856-3412-3412-3412-341278563412";
  const txPower = -59;

  // Get platform info for debugging
  useEffect(() => {
    setPlatformInfo({
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
      userAgent: navigator.userAgent
    });
    console.log('🎯 CORRECTED BEACON CONFIGURATION:');
    console.log('🎯 UUID (corrected):', uuid);
    console.log('🎯 Expected from NRF:', 'AB90 7856-3412 3412-3412 3412-7856 3412');
    console.log('🎯 Manufacturer data format should be: AB90 7856 3412 3412 3412 3412 7856 3412');
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
          <div className="flex justify-center gap-4 items-center flex-wrap">
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
              Beacon Tracking
            </TabsTrigger>
            <TabsTrigger value="ble-scanner" className="data-[state=active]:bg-slate-700">
              BLE Device Scanner
            </TabsTrigger>
          </TabsList>

          {/* Beacon Tracking Tab */}
          <TabsContent value="beacon-tracking" className="space-y-6">
            {/* Control Panel */}
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
                
                {/* Enhanced Scan Status */}
                {isNativePlatform && (
                  <div className="mb-4 p-4 bg-slate-700/30 border border-slate-600 rounded-lg">
                    <h3 className="text-white font-semibold mb-2">BLE Scan Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Status:</p>
                        <p className={`font-mono ${isScanning ? 'text-green-400' : 'text-gray-300'}`}>
                          {scanStatus || 'Ready to scan'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Devices Found:</p>
                        <p className="text-blue-400 font-mono">{devicesFound}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Beacons Detected:</p>
                        <p className="text-green-400 font-mono">{beaconData.length}/5</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Debug Information */}
                <div className="mb-4 p-4 bg-slate-700/30 border border-slate-600 rounded-lg">
                  <h3 className="text-white font-semibold mb-2">Debug Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Platform:</p>
                      <p className="text-white font-mono">{platformInfo.platform}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Native Platform:</p>
                      <p className={`font-mono ${platformInfo.isNative ? 'text-green-400' : 'text-red-400'}`}>
                        {platformInfo.isNative ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-gray-400 text-xs">User Agent:</p>
                    <p className="text-gray-300 text-xs font-mono break-all">{platformInfo.userAgent}</p>
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

              {/* Individual Beacon Scanners */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Individual Beacon Scanner</h2>
                  <p className="text-gray-300 text-sm mb-6">
                    Scan each POI beacon individually to test connectivity and view detailed information.
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

            {/* Combined Beacon Data Display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Original Beacon Data */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Combined Beacon Scanner</h2>
                  <p className="text-gray-300 text-sm mb-4">
                    This scans for all beacons simultaneously for position calculation.
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
                  This scanner finds ALL BLE devices nearby (like nRF Connect). Use it to verify if your ESP32 beacons are advertising and if the app can detect BLE devices at all.
                </p>
                <BLEDeviceScanner />
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center text-gray-400 text-sm">
          <p>Travvo Heritage Navigation System | Real BLE Indoor Positioning</p>
          <p>Build natively with: npm run build && npx cap sync && npx cap run android</p>
          {isNativePlatform ? (
            <p className="text-green-400">🟢 Native platform detected - BLE scanning available</p>
          ) : (
            <p className="text-red-400">🔴 Web platform detected - Build natively for BLE functionality</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
