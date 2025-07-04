
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Navigation, Move, Target } from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface ControlPanelProps {
  simulatedPosition: Position;
  setSimulatedPosition: (position: Position) => void;
  isScanning: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  simulatedPosition,
  setSimulatedPosition,
  isScanning
}) => {
  const presetPositions = [
    { name: "Center", x: 2.5, y: 2.5, icon: Target },
    { name: "Corner NW", x: 0.5, y: 0.5, icon: Navigation },
    { name: "Corner NE", x: 4.5, y: 0.5, icon: Navigation },
    { name: "Corner SW", x: 0.5, y: 4.5, icon: Navigation },
    { name: "Corner SE", x: 4.5, y: 4.5, icon: Navigation },
  ];

  const moveToPosition = (x: number, y: number) => {
    setSimulatedPosition({ x, y });
  };

  const handleXChange = (value: number[]) => {
    setSimulatedPosition({ ...simulatedPosition, x: value[0] });
  };

  const handleYChange = (value: number[]) => {
    setSimulatedPosition({ ...simulatedPosition, y: value[0] });
  };

  return (
    <div className="space-y-6">
      {/* Position Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-700/30 border-slate-600 p-4">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Move className="h-4 w-4" />
            Manual Position Control
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-gray-300">X-Axis (meters)</label>
                <Badge variant="outline" className="text-xs">
                  {simulatedPosition.x.toFixed(1)}m
                </Badge>
              </div>
              <Slider
                value={[simulatedPosition.x]}
                onValueChange={handleXChange}
                max={5}
                min={0}
                step={0.1}
                className="w-full"
                disabled={isScanning}
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-gray-300">Y-Axis (meters)</label>
                <Badge variant="outline" className="text-xs">
                  {simulatedPosition.y.toFixed(1)}m
                </Badge>
              </div>
              <Slider
                value={[simulatedPosition.y]}
                onValueChange={handleYChange}
                max={5}
                min={0}
                step={0.1}
                className="w-full"
                disabled={isScanning}
              />
            </div>
          </div>
        </Card>

        <Card className="bg-slate-700/30 border-slate-600 p-4">
          <h3 className="text-white font-semibold mb-3">Quick Positions</h3>
          <div className="grid grid-cols-2 gap-2">
            {presetPositions.map((preset) => {
              const Icon = preset.icon;
              return (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => moveToPosition(preset.x, preset.y)}
                  disabled={isScanning}
                  className="flex items-center gap-2 text-xs"
                >
                  <Icon className="h-3 w-3" />
                  {preset.name}
                </Button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="bg-blue-900/20 border-blue-700/50 p-4">
        <h3 className="text-blue-200 font-semibold mb-2">How to Use</h3>
        <div className="text-sm text-blue-100 space-y-1">
          <p>1. <strong>Stop scanning</strong> to manually position the simulated user (green dot)</p>
          <p>2. <strong>Start scanning</strong> to see real-time positioning calculations (red dot)</p>
          <p>3. Compare the calculated position with the actual simulated position</p>
          <p>4. Observe how the Kalman filter smooths RSSI fluctuations</p>
        </div>
      </Card>

      {/* Status */}
      <div className="flex justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-gray-300">Simulated Position</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-600 rounded-full"></div>
          <span className="text-gray-300">Calculated Position</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
          <span className="text-gray-300">ESP32 Beacons</span>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
