export type SoundMode = 'off' | 'lofi' | 'rain';

export interface Soundscape {
  setMode: (mode: SoundMode) => void;
  cue: (frequency?: number) => void;
  sing: () => void;
  dispose: () => void;
}

export function createSoundscape(): Soundscape {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let sources: AudioNode[] = [];
  let oscillators: AudioScheduledSourceNode[] = [];

  const stop = () => {
    oscillators.forEach(oscillator => { try { oscillator.stop(); } catch { /* already stopped */ } });
    sources.forEach(source => source.disconnect());
    sources = [];
    oscillators = [];
  };

  const ensure = () => {
    if (context && master) return { context, master };
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = .32;
    master.connect(context.destination);
    return { context, master };
  };

  const setMode = (mode: SoundMode) => {
    stop();
    if (mode === 'off') return;
    const audio = ensure();
    void audio.context.resume();
    const length = audio.context.sampleRate * 4;
    const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) { last = (last + .025 * (Math.random() * 2 - 1)) / 1.025; data[i] = last; }
    const noise = audio.context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = audio.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mode === 'rain' ? 780 : 430;
    const gain = audio.context.createGain();
    gain.gain.value = mode === 'rain' ? .85 : .4;
    noise.connect(filter).connect(gain).connect(audio.master);
    noise.start();
    sources.push(noise, filter, gain);
    oscillators.push(noise);
    if (mode === 'rain') return;
    [261.63, 329.63, 392, 493.88].forEach((frequency, index) => {
      const oscillator = audio.context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency / 2;
      const noteGain = audio.context.createGain();
      noteGain.gain.value = .015 - index * .002;
      oscillator.connect(noteGain).connect(audio.master);
      oscillator.start();
      sources.push(noteGain);
      oscillators.push(oscillator);
    });
  };

  const cue = (frequency = 520) => {
    if (!context || !master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, context.currentTime + .18);
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.04, context.currentTime + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .28);
    oscillator.connect(gain).connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + .3);
  };

  const sing = (): void => {
    const audio = ensure();
    void audio.context.resume();
    const notes = [392, 440, 523.25, 440, 392, 329.63, 392];
    const start = audio.context.currentTime + .03;
    notes.forEach((frequency, index) => {
      const oscillator = audio.context.createOscillator();
      const gain = audio.context.createGain();
      const at = start + index * .23;
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, at);
      oscillator.frequency.linearRampToValueAtTime(frequency * .97, at + .18);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.linearRampToValueAtTime(.09, at + .03);
      gain.gain.exponentialRampToValueAtTime(.0001, at + .21);
      oscillator.connect(gain).connect(audio.context.destination);
      oscillator.start(at);
      oscillator.stop(at + .22);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  };

  return { setMode, cue, sing, dispose: () => { stop(); void context?.close(); context = master = null; } };
}
