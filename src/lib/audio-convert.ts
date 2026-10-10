/**
 * Decode any browser-playable audio file and re-encode it as 16 kHz mono WAV.
 * This normalizes mislabeled or unusual files (e.g. voice notes renamed to .mp3)
 * into a format the transcription service always accepts.
 */
export async function toWavFile(file: File): Promise<File> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const wav = encodeWav(buf);
    const name = file.name.replace(/\.\w+$/, "") || "recording";
    return new File([wav], `${name}.wav`, { type: "audio/wav" });
  } finally {
    void ctx.close();
  }
}

function encodeWav(audio: AudioBuffer): Blob {
  const targetRate = 16000;
  const ratio = audio.sampleRate / targetRate;
  const outLen = Math.ceil(audio.length / ratio);
  const out = new Float32Array(outLen);
  // Mix all channels to mono with simple decimation.
  for (let ch = 0; ch < audio.numberOfChannels; ch++) {
    const data = audio.getChannelData(ch);
    for (let i = 0; i < outLen; i++) {
      out[i] += data[Math.min(audio.length - 1, Math.floor(i * ratio))] / audio.numberOfChannels;
    }
  }
  const bytes = new ArrayBuffer(44 + outLen * 2);
  const v = new DataView(bytes);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + outLen * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, targetRate, true);
  v.setUint32(28, targetRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, "data");
  v.setUint32(40, outLen * 2, true);
  for (let i = 0; i < outLen; i++) {
    const s = Math.max(-1, Math.min(1, out[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}
