/** Generated once with ElevenLabs; playback never calls a paid API. */
export const TOUR_AUDIO = (index: number): string => `/audio/tour-${index + 1}.mp3`;
export const SOUNDS = {
  rain: { file: '/audio/rain.mp3', duration: 12, loop: true, prompt: 'Gentle steady rain on leaves outside a quiet university library window. Soft natural rain texture, no thunder, no voices, no music. Seamless calming ambient loop.' },
  lofi: { file: '/audio/lofi.mp3', duration: 12, loop: true, prompt: 'Soft warm ambient study room soundscape, gentle analog hum and distant soft bell-like tones, subtle vinyl texture, tranquil low energy. No speech, no melody, no strong beats. Seamless quiet background loop.' },
  cue: { file: '/audio/cue.mp3', duration: 0.5, loop: false, prompt: 'One delicate soft rounded glass chime, a warm subtle interface confirmation sound. No voice, no music, no echo tail.' },
} as const;
