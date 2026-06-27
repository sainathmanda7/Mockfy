class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bytesWritten = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bytesWritten++] = channelData[i];

      if (this.bytesWritten >= this.bufferSize) {
        this.flush();
      }
    }

    return true;
  }

  flush() {
    // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
    const i16 = new Int16Array(this.bufferSize);
    for (let i = 0; i < this.bufferSize; i++) {
      let s = Math.max(-1, Math.min(1, this.buffer[i]));
      i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    this.port.postMessage(i16.buffer, [i16.buffer]);
    this.bytesWritten = 0;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
