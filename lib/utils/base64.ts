// Safe base64 to Uint8Array conversion without relying on atob/Buffer
// Works in React Native and web.

export function base64ToUint8Array(base64: string): Uint8Array {
  try {
    // Remove whitespace/newlines and invalid characters
    const sanitized = (base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

    let bufferLength = (sanitized.length * 3) / 4;
    if (sanitized.endsWith('==')) bufferLength -= 2;
    else if (sanitized.endsWith('=')) bufferLength -= 1;

    const bytes = new Uint8Array(bufferLength);
    let p = 0;

    for (let i = 0; i < sanitized.length; i += 4) {
      const enc1 = chars.indexOf(sanitized.charAt(i));
      const enc2 = chars.indexOf(sanitized.charAt(i + 1));
      const enc3 = chars.indexOf(sanitized.charAt(i + 2));
      const enc4 = chars.indexOf(sanitized.charAt(i + 3));

      const b1 = (enc1 << 2) | (enc2 >> 4);
      const b2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const b3 = ((enc3 & 3) << 6) | enc4;

      bytes[p++] = b1 & 0xff;
      if (enc3 !== 64) bytes[p++] = b2 & 0xff;
      if (enc4 !== 64) bytes[p++] = b3 & 0xff;
    }

    return bytes;
  } catch (e) {
    // As a last resort, return an empty buffer to avoid crashes
    return new Uint8Array();
  }
}
