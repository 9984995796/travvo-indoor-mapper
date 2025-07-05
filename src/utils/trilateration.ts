
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

// Trilateration algorithm
export const calculatePosition = (beacons: Beacon[], beaconDistances: { [key: number]: number }, currentPosition: Position): Position => {
  // Use first three beacons for trilateration (1001, 1002, 1003)
  const b1 = beacons.find(b => b.id === 1001);
  const b2 = beacons.find(b => b.id === 1002);
  const b3 = beacons.find(b => b.id === 1003);
  
  const r1 = beaconDistances[1001];
  const r2 = beaconDistances[1002];
  const r3 = beaconDistances[1003];

  if (!r1 || !r2 || !r3 || !b1 || !b2 || !b3) {
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
