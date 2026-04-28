class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.frameSize = 3200;
    this.inputSamplesPerFrame = Math.round(
      (sampleRate * this.frameSize) / this.targetSampleRate
    );
    this.inputBuffer = [];
  }

  process(inputs) {
    const channelData = inputs[0]?.[0];
    if (!channelData) {
      return true;
    }

    for (let index = 0; index < channelData.length; index += 1) {
      this.inputBuffer.push(channelData[index]);
    }

    while (this.inputBuffer.length >= this.inputSamplesPerFrame) {
      const sourceChunk = this.inputBuffer.splice(0, this.inputSamplesPerFrame);
      const pcmChunk = this.downsampleToPCM(sourceChunk);
      this.port.postMessage(pcmChunk.buffer, [pcmChunk.buffer]);
    }

    return true;
  }

  downsampleToPCM(sourceChunk) {
    if (sampleRate === this.targetSampleRate) {
      return this.floatToPCM(sourceChunk.slice(0, this.frameSize));
    }

    const pcm = new Int16Array(this.frameSize);
    const ratio = sourceChunk.length / this.frameSize;

    for (let index = 0; index < this.frameSize; index += 1) {
      const start = Math.floor(index * ratio);
      const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
      let sum = 0;
      let count = 0;

      for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
        sum += sourceChunk[sourceIndex] ?? 0;
        count += 1;
      }

      const sample = count > 0 ? sum / count : 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      pcm[index] = clamped < 0 ? clamped * 32768 : clamped * 32767;
    }

    return pcm;
  }

  floatToPCM(floatChunk) {
    const pcm = new Int16Array(this.frameSize);
    for (let index = 0; index < this.frameSize; index += 1) {
      const sample = floatChunk[index] ?? 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      pcm[index] = clamped < 0 ? clamped * 32768 : clamped * 32767;
    }
    return pcm;
  }
}

registerProcessor("pcm-recorder", PCMRecorderProcessor);
