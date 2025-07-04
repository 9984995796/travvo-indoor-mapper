
import React from 'react';

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

interface PositionGridProps {
  beacons: Beacon[];
  currentPosition: Position;
  simulatedPosition: Position;
  positionHistory: Position[];
  isScanning: boolean;
}

const PositionGrid: React.FC<PositionGridProps> = ({ 
  beacons, 
  currentPosition, 
  simulatedPosition, 
  positionHistory, 
  isScanning 
}) => {
  const gridSize = 500; // 500x500 pixels as specified
  const roomSize = 5; // 5x5 meters
  const scale = gridSize / roomSize; // 100 pixels per meter

  const meterToPixel = (meter: number) => meter * scale;

  return (
    <div className="flex justify-center">
      <div 
        className="relative bg-gray-200 border-2 border-gray-400 rounded-lg"
        style={{ width: gridSize, height: gridSize }}
      >
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full">
          {/* Vertical lines */}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <line
              key={`v-${i}`}
              x1={meterToPixel(i)}
              y1={0}
              x2={meterToPixel(i)}
              y2={gridSize}
              stroke="#ccc"
              strokeWidth="1"
              strokeDasharray={i % 1 === 0 ? "none" : "2,2"}
            />
          ))}
          {/* Horizontal lines */}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <line
              key={`h-${i}`}
              x1={0}
              y1={meterToPixel(i)}
              x2={gridSize}
              y2={meterToPixel(i)}
              stroke="#ccc"
              strokeWidth="1"
              strokeDasharray={i % 1 === 0 ? "none" : "2,2"}
            />
          ))}
          
          {/* Position history trail */}
          {positionHistory.length > 1 && (
            <polyline
              points={positionHistory.map(pos => 
                `${meterToPixel(pos.x)},${meterToPixel(pos.y)}`
              ).join(' ')}
              fill="none"
              stroke="rgba(239, 68, 68, 0.3)"
              strokeWidth="2"
            />
          )}
        </svg>

        {/* Beacons */}
        {beacons.map(beacon => (
          <div
            key={beacon.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: meterToPixel(beacon.x),
              top: meterToPixel(beacon.y)
            }}
          >
            <div className="relative">
              {/* Beacon indicator */}
              <div className="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
              
              {/* Beacon label */}
              <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                {beacon.id}
              </div>
              
              {/* Pulsing animation when scanning */}
              {isScanning && (
                <div className="absolute inset-0 w-6 h-6 bg-blue-400 rounded-full animate-ping opacity-25"></div>
              )}
            </div>
          </div>
        ))}

        {/* Simulated position (green dot) */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: meterToPixel(simulatedPosition.x),
            top: meterToPixel(simulatedPosition.y)
          }}
        >
          <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg opacity-70">
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs px-1 py-0.5 rounded text-center whitespace-nowrap">
              Actual
            </div>
          </div>
        </div>

        {/* Calculated position (red dot - 20x20 pixels as specified) */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
          style={{
            left: meterToPixel(currentPosition.x),
            top: meterToPixel(currentPosition.y)
          }}
        >
          <div className="w-5 h-5 bg-red-600 rounded-full border-2 border-white shadow-lg">
            {isScanning && (
              <div className="absolute inset-0 w-5 h-5 bg-red-400 rounded-full animate-pulse"></div>
            )}
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-xs px-1 py-0.5 rounded text-center whitespace-nowrap">
              Calculated
            </div>
          </div>
        </div>

        {/* Corner labels */}
        <div className="absolute top-2 left-2 text-xs text-gray-600 font-mono">(0,0)</div>
        <div className="absolute top-2 right-2 text-xs text-gray-600 font-mono">(5,0)</div>
        <div className="absolute bottom-2 left-2 text-xs text-gray-600 font-mono">(0,5)</div>
        <div className="absolute bottom-2 right-2 text-xs text-gray-600 font-mono">(5,5)</div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs text-gray-600 font-mono">(2.5,2.5)</div>
      </div>
    </div>
  );
};

export default PositionGrid;
