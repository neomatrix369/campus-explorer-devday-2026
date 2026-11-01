export function startNarration(text: string, neuralAvailable: boolean, onEnd: () => void): () => void {
  const controller = new AbortController();
  let audio: HTMLAudioElement | null = null;
  let stopped = false;
  let url: string | null = null;
  const finish = () => { if (!stopped) onEnd(); };
  const fallback = () => {
    if (stopped || !('speechSynthesis' in window)) { finish(); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = .95;
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };
  if (neuralAvailable) {
    fetch('/api/ai/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: controller.signal })
      .then(async response => {
        if (!response.ok) { fallback(); return; }
        url = URL.createObjectURL(await response.blob());
        audio = new Audio(url);
        audio.onended = finish;
        audio.onerror = fallback;
        void audio.play().catch(fallback);
      }).catch(() => { if (!stopped) fallback(); });
  } else fallback();
  return () => {
    stopped = true;
    controller.abort();
    audio?.pause();
    if (url) URL.revokeObjectURL(url);
    window.speechSynthesis?.cancel();
  };
}
