import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BeaconData {
  id: number;
  name: string;
  rssi: number;
  filteredRSSI: number;
  distance: number;
}

interface LiveCalculationDisplayProps {
  beaconData: BeaconData[];
  currentPosition: { x: number; y: number };
  txPower: number;
  isScanning: boolean;
}

const LiveCalculationDisplay: React.FC<LiveCalculationDisplayProps> = ({
  beaconData,
  currentPosition,
  txPower,
  isScanning
}) => {
  // Get the primary beacons for trilateration
  const poi1 = beaconData.find(b => b.name.includes("NW"));
  const poi2 = beaconData.find(b => b.name.includes("NE"));
  const poi3 = beaconData.find(b => b.name.includes("SW"));

  const formatNumber = (num: number, decimals: number = 2) => {
    return num?.toFixed(decimals) || "0.00";
  };

  const calculateExponent = (rssi: number, txPower: number) => {
    return (txPower - rssi) / (10 * 2.0);
  };

  const calculateRawDistance = (exponent: number) => {
    return Math.pow(10, exponent);
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Live Position Calculations</h2>
          <Badge variant={isScanning ? "default" : "secondary"}>
            {isScanning ? "Live Updates" : "Stopped"}
          </Badge>
        </div>

        {/* Distance Calculation Steps */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[poi1, poi2, poi3].map((beacon, index) => {
              if (!beacon) return (
                <div key={index} className="p-3 bg-slate-700/30 border border-slate-600 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">
                    POI-{index + 1} (Missing)
                  </h3>
                  <p className="text-red-400 text-xs">No data available</p>
                </div>
              );

              const exponent = calculateExponent(beacon.filteredRSSI, txPower);
              const rawDistance = calculateRawDistance(exponent);
              const boundedDistance = Math.max(0.3, Math.min(15, rawDistance));

              return (
                <div key={beacon.id} className="p-3 bg-slate-700/30 border border-slate-600 rounded-lg">
                  <h3 className="text-sm font-semibold text-white mb-2">
                    {beacon.name}
                  </h3>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Raw RSSI:</span>
                      <span className="text-blue-400 font-mono">{beacon.rssi} dBm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Filtered RSSI:</span>
                      <span className="text-green-400 font-mono">{formatNumber(beacon.filteredRSSI, 1)} dBm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">TxPower:</span>
                      <span className="text-yellow-400 font-mono">{txPower} dBm</span>
                    </div>
                    <hr className="border-slate-600 my-1" />
                    <div className="flex justify-between">
                      <span className="text-gray-400">Exponent:</span>
                      <span className="text-purple-400 font-mono">{formatNumber(exponent, 3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">10^exponent:</span>
                      <span className="text-orange-400 font-mono">{formatNumber(rawDistance, 2)}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Final Distance:</span>
                      <span className="text-cyan-400 font-mono font-semibold">{formatNumber(boundedDistance, 2)}m</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trilateration Steps */}
          <div className="p-4 bg-slate-700/30 border border-slate-600 rounded-lg">
            <h3 className="text-sm font-semibold text-white mb-3">Trilateration Process</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-300 mb-2">Beacon Positions:</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">POI-1 (NW):</span>
                    <span className="text-blue-400 font-mono">(0, 0) - {poi1 ? formatNumber(poi1.distance, 2) : "N/A"}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">POI-2 (NE):</span>
                    <span className="text-blue-400 font-mono">(5, 0) - {poi2 ? formatNumber(poi2.distance, 2) : "N/A"}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">POI-3 (SW):</span>
                    <span className="text-blue-400 font-mono">(0, 5) - {poi3 ? formatNumber(poi3.distance, 2) : "N/A"}m</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-300 mb-2">Linear System Result:</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">X coordinate:</span>
                    <span className="text-green-400 font-mono">{formatNumber(currentPosition.x, 3)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Y coordinate:</span>
                    <span className="text-green-400 font-mono">{formatNumber(currentPosition.y, 3)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Grid Position:</span>
                    <span className="text-purple-400 font-mono">
                      ({Math.round(currentPosition.x * 100)}, {Math.round(currentPosition.y * 100)})px
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Formula Reference */}
          <div className="p-3 bg-slate-700/30 border border-slate-600 rounded-lg">
            <h3 className="text-xs font-semibold text-white mb-2">Calculation Formulas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-400">Distance Formula:</p>
                <p className="text-blue-300 font-mono">distance = 10^((TxPower - RSSI) / (10 * n))</p>
                <p className="text-gray-500">where n = 2.0 (indoor path loss)</p>
              </div>
              <div>
                <p className="text-gray-400">Trilateration:</p>
                <p className="text-green-300 font-mono">Linear system solver</p>
                <p className="text-gray-500">3 circles intersection → (x, y)</p>
              </div>
            </div>
          </div>

          {/* Update Rate */}
          <div className="text-center">
            <p className="text-gray-400 text-xs">
              🔄 Updates every 1000ms | 
              🎯 Real-time RSSI filtering with Kalman | 
              📡 Live trilateration calculation
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default LiveCalculationDisplay;