
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

// Enhanced iBeacon parser with better error handling and multiple format support
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
    for (let i = 0; i < Math.min(10, manufacturerDataBuffer.byteLength); i++) {
      firstBytes.push('0x' + dataView.getUint8(i).toString(16).padStart(2, '0'));
    }
    console.log('📊 First bytes:', firstBytes.join(' '));
    
    // Try multiple iBeacon format variations
    const formats = [
      { companyIdOffset: 0, companyId: 0x004C, typeOffset: 2, type: 0x02, lengthOffset: 3, length: 0x15, uuidOffset: 4 }, // Standard Apple iBeacon
      { companyIdOffset: 0, companyId: 0x4C00, typeOffset: 2, type: 0x02, lengthOffset: 3, length: 0x15, uuidOffset: 4 }, // Big endian company ID
      { companyIdOffset: 2, companyId: 0x004C, typeOffset: 4, type: 0x02, lengthOffset: 5, length: 0x15, uuidOffset: 6 }, // Some beacons have 2-byte prefix
    ];
    
    for (const format of formats) {
      try {
        if (manufacturerDataBuffer.byteLength < format.uuidOffset + 21) continue;
        
        // Check company ID (try both endianness)
        const companyId1 = dataView.getUint16(format.companyIdOffset, true); // Little endian
        const companyId2 = dataView.getUint16(format.companyIdOffset, false); // Big endian
        
        console.log(`🏷️ Trying format: Company ID LE: 0x${companyId1.toString(16)}, BE: 0x${companyId2.toString(16)}`);
        
        if (companyId1 !== format.companyId && companyId2 !== format.companyId) {
          continue;
        }
        
        const beaconType = dataView.getUint8(format.typeOffset);
        const beaconLength = dataView.getUint8(format.lengthOffset);
        
        console.log(`🏷️ Format check:`, {
          companyId: `0x${(companyId1 === format.companyId ? companyId1 : companyId2).toString(16)}`,
          beaconType: `0x${beaconType.toString(16)}`,
          beaconLength: `0x${beaconLength.toString(16)}`
        });
        
        if (beaconType !== format.type || beaconLength !== format.length) {
          continue;
        }
        
        // Extract UUID (16 bytes)
        const uuidBytes = [];
        for (let i = format.uuidOffset; i < format.uuidOffset + 16; i++) {
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
        const major = dataView.getUint16(format.uuidOffset + 16, false);
        const minor = dataView.getUint16(format.uuidOffset + 18, false);
        const txPowerByte = dataView.getInt8(format.uuidOffset + 20);
        
        const beaconInfo = {
          uuid: uuid,
          major: major,
          minor: minor,
          rssi: rssi,
          txPower: txPowerByte
        };
        
        console.log('✅ Successfully parsed iBeacon with format:', format, beaconInfo);
        return beaconInfo;
      } catch (formatError) {
        console.log('❌ Format failed:', formatError);
        continue;
      }
    }
    
    // If standard iBeacon parsing fails, try to parse as custom beacon format
    console.log('🔄 Trying custom beacon format parsing...');
    
    // Some ESP32 beacons might use different manufacturer data formats
    // Try to find UUID pattern in the data
    if (manufacturerDataBuffer.byteLength >= 21) {
      for (let offset = 0; offset <= manufacturerDataBuffer.byteLength - 21; offset++) {
        try {
          const uuidBytes = [];
          for (let i = offset; i < offset + 16; i++) {
            uuidBytes.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
          }
          
          const uuid = [
            uuidBytes.slice(0, 4).join(''),
            uuidBytes.slice(4, 6).join(''),
            uuidBytes.slice(6, 8).join(''),
            uuidBytes.slice(8, 10).join(''),
            uuidBytes.slice(10, 16).join('')
          ].join('-');
          
          // Check if this looks like our target UUID
          if (uuid.toLowerCase().includes('ab907856') || uuid.toLowerCase().includes('3412')) {
            const major = dataView.getUint16(offset + 16, false);
            const minor = dataView.getUint16(offset + 18, false);
            const txPowerByte = dataView.getInt8(offset + 20);
            
            const beaconInfo = {
              uuid: uuid,
              major: major,
              minor: minor,
              rssi: rssi,
              txPower: txPowerByte
            };
            
            console.log('✅ Successfully parsed custom beacon format:', beaconInfo);
            return beaconInfo;
          }
        } catch (customError) {
          continue;
        }
      }
    }
    
    console.log('❌ Could not parse as any known beacon format');
    return null;
    
  } catch (error) {
    console.error('❌ Error parsing beacon data:', error);
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
