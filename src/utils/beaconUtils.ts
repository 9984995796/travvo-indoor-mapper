
export interface BeaconInfo {
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  txPower: number;
}

export interface BeaconData {
  id: number;
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  filteredRSSI: number;
  distance: number;
  actualDistance: number;
  x: number;
  y: number;
  name: string;
}

// Parse iBeacon advertisement data
export const parseIBeaconData = (manufacturerData: DataView, rssi: number): BeaconInfo | null => {
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

// RSSI to distance conversion using path-loss model
export const rssiToDistance = (rssi: number, txPower = -59) => {
  if (rssi === 0) return -1.0;
  
  const ratio = (txPower - rssi) / 20.0;
  return Math.pow(10, ratio);
};
