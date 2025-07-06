
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

// Enhanced iBeacon parser with better error handling
export const parseIBeaconData = (manufacturerDataBuffer: ArrayBuffer, rssi: number): BeaconInfo | null => {
  try {
    console.log('🔍 parseIBeaconData called with buffer length:', manufacturerDataBuffer.byteLength);
    
    if (manufacturerDataBuffer.byteLength < 25) {
      console.log('❌ Buffer too short for iBeacon:', manufacturerDataBuffer.byteLength, 'bytes (need 25)');
      return null;
    }

    const dataView = new DataView(manufacturerDataBuffer);
    
    // Log the first few bytes for debugging
    const firstBytes = [];
    for (let i = 0; i < Math.min(8, manufacturerDataBuffer.byteLength); i++) {
      firstBytes.push('0x' + dataView.getUint8(i).toString(16).padStart(2, '0'));
    }
    console.log('📊 First bytes:', firstBytes.join(' '));
    
    // iBeacon format validation
    const companyId = dataView.getUint16(0, true); // Little endian
    const beaconType = dataView.getUint8(2);
    const beaconLength = dataView.getUint8(3);
    
    console.log('🏷️ iBeacon header:', {
      companyId: '0x' + companyId.toString(16),
      beaconType: '0x' + beaconType.toString(16),
      beaconLength: '0x' + beaconLength.toString(16)
    });
    
    // Check for Apple iBeacon format
    if (companyId !== 0x004C) {
      console.log('❌ Not Apple company ID:', '0x' + companyId.toString(16));
      return null;
    }
    
    if (beaconType !== 0x02) {
      console.log('❌ Not iBeacon type:', '0x' + beaconType.toString(16));
      return null;
    }
    
    if (beaconLength !== 0x15) {
      console.log('❌ Wrong iBeacon length:', '0x' + beaconLength.toString(16));
      return null;
    }
    
    // Extract UUID (16 bytes starting at offset 4)
    const uuidBytes = [];
    for (let i = 4; i < 20; i++) {
      uuidBytes.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
    }
    
    const uuid = [
      uuidBytes.slice(0, 4).join(''),
      uuidBytes.slice(4, 6).join(''),
      uuidBytes.slice(6, 8).join(''),
      uuidBytes.slice(8, 10).join(''),
      uuidBytes.slice(10, 16).join('')
    ].join('-');
    
    // Extract Major and Minor (big endian)
    const major = dataView.getUint16(20, false);
    const minor = dataView.getUint16(22, false);
    const txPowerByte = dataView.getInt8(24);
    
    const beaconInfo = {
      uuid: uuid,
      major: major,
      minor: minor,
      rssi: rssi,
      txPower: txPowerByte
    };
    
    console.log('✅ Successfully parsed iBeacon:', beaconInfo);
    return beaconInfo;
    
  } catch (error) {
    console.error('❌ Error parsing iBeacon data:', error);
    return null;
  }
};

// RSSI to distance conversion using path-loss model
export const rssiToDistance = (rssi: number, txPower = -59) => {
  if (rssi === 0) return -1.0;
  
  const ratio = (txPower - rssi) / 20.0;
  const distance = Math.pow(10, ratio);
  
  // Apply some bounds (0.1m to 50m)
  return Math.max(0.1, Math.min(50, distance));
};
