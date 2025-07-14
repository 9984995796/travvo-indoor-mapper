import React from 'react';
import { Card } from '@/components/ui/card';
import { BeaconData } from '@/utils/beaconUtils';

interface Position {
  x: number;
  y: number;
}

interface CalculationBreakdownProps {
  beaconData: BeaconData[];
  currentPosition: Position;
  txPower: number;
  isLive: boolean;
}

const CalculationBreakdown: React.FC<CalculationBreakdownProps> = ({
  beaconData,
  currentPosition,
  txPower,
  isLive
}) => {
  // Find the three beacons used for trilateration
  const trilaterationBeacons = beaconData.filter(b => 
    b.id === 1001 || b.id === 1002 || b.id === 1003
  ).sort((a, b) => a.id - b.id);

  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Live Calculation Flow</h2>
          {isLive && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-sm">Live Updates</span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Step 1: RSSI to Distance */}
          <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Step 1: RSSI to Distance Conversion</h3>
            <div className="text-sm text-gray-300 mb-3">
              <p>Formula: <code className="text-blue-300">distance = 10^((TxPower - RSSI) / (10 * n))</code></p>
              <p>Where: TxPower = {txPower}dBm, n = 2.0 (indoor path loss)</p>
            </div>
            <div className="space-y-2">
              {beaconData.slice(0, 3).map(beacon => {
                const exponent = (txPower - beacon.rssi) / (10 * 2.0);
                const rawDistance = Math.pow(10, exponent);
                return (
                  <div key={beacon.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
                    <div className="text-yellow-400">{beacon.name}:</div>
                    <div className="text-blue-400">RSSI: {beacon.rssi}dBm</div>
                    <div className="text-green-400">Exponent: {exponent.toFixed(3)}</div>
                    <div className="text-purple-400">Distance: {beacon.distance}m</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Kalman Filtering */}
          <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Step 2: Kalman Filtering</h3>
            <div className="text-sm text-gray-300 mb-3">
              <p>Process Noise (Q): 0.0001, Measurement Noise (R): 0.01</p>
            </div>
            <div className="space-y-2">
              {beaconData.slice(0, 3).map(beacon => (
                <div key={beacon.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="text-yellow-400">{beacon.name}:</div>
                  <div className="text-red-400">Raw: {beacon.rssi}dBm</div>
                  <div className="text-green-400">Filtered: {beacon.filteredRSSI}dBm</div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Trilateration */}
          {trilaterationBeacons.length >= 3 && (
            <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3">Step 3: Trilateration</h3>
              <div className="text-sm text-gray-300 mb-3">
                <p>Using three beacons to solve for position (x, y)</p>
                <p>Linear system: Ax + By = C, Dx + Ey = F</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mb-4">
                {trilaterationBeacons.map((beacon, idx) => {
                  const positions = [
                    { name: "NW", pos: "(0, 0)" },
                    { name: "NE", pos: "(5, 0)" }, 
                    { name: "SW", pos: "(0, 5)" }
                  ];
                  return (
                    <div key={beacon.id} className="bg-slate-600/30 p-2 rounded">
                      <div className="text-yellow-400">{positions[idx]?.name} ({beacon.name})</div>
                      <div className="text-blue-400">Position: {positions[idx]?.pos}</div>
                      <div className="text-green-400">Distance: {beacon.distance}m</div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-slate-600/30 p-3 rounded">
                <div className="text-white font-semibold mb-2">Solution:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="text-green-400">X coordinate: {currentPosition.x.toFixed(3)}m</div>
                  <div className="text-green-400">Y coordinate: {currentPosition.y.toFixed(3)}m</div>
                </div>
                <div className="text-blue-400 mt-2 text-xs">
                  Grid Position: ({Math.round(currentPosition.x * 100)}, {Math.round(currentPosition.y * 100)})px
                </div>
              </div>
            </div>
          )}

          {/* File References */}
          <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Implementation Files</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-yellow-400 font-semibold mb-2">Core Files:</div>
                <div className="space-y-1 text-gray-300">
                  <div>• <code className="text-blue-300">useBLEScanner.ts</code> - Live RSSI processing</div>
                  <div>• <code className="text-blue-300">beaconUtils.ts</code> - Distance calculation</div>
                  <div>• <code className="text-blue-300">kalmanFilter.ts</code> - RSSI smoothing</div>
                </div>
              </div>
              <div>
                <div className="text-yellow-400 font-semibold mb-2">UI Files:</div>
                <div className="space-y-1 text-gray-300">
                  <div>• <code className="text-blue-300">trilateration.ts</code> - Position solver</div>
                  <div>• <code className="text-blue-300">PositionGrid.tsx</code> - Visual display</div>
                  <div>• <code className="text-blue-300">LiveCalculationDisplay.tsx</code> - Debug UI</div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Info */}
          <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Performance Optimizations</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-300">
              <div>
                <div className="text-green-400 font-semibold">Update Rate:</div>
                <div>1Hz guaranteed updates</div>
                <div>Live distance calculation</div>
              </div>
              <div>
                <div className="text-blue-400 font-semibold">Memory:</div>
                <div>Optimized state updates</div>
                <div>Minimal re-renders</div>
              </div>
              <div>
                <div className="text-purple-400 font-semibold">Platform:</div>
                <div>Android optimized</div>
                <div>Low-latency BLE scan</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CalculationBreakdown;