export function startNarration(text: string, audioUrl: string, onEnd: () => void): () => void {
  let stopped = false;
  let finished = false;
  let fallbackStarted = false;
  const audio = new Audio(audioUrl);
  const finish = (): void => {
    if (stopped || finished) return;
    finished = true;
    onEnd();
  };
  const fallback = (): void => {
    if (stopped || fallbackStarted) return;
    fallbackStarted = true;
    audio.pause();
    if (!('speechSynthesis' in window)) { finish(); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = .95;
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };
  audio.onended = finish;
  audio.onerror = fallback;
  void audio.play().catch(fallback);
  return () => {
    stopped = true;
    audio.onended = audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    window.speechSynthesis?.cancel();
  };
}
