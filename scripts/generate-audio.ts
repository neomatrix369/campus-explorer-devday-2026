import { config } from 'dotenv';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { TOUR_STOPS } from '../src/data/tour.ts';
import { SOUNDS, TOUR_AUDIO } from '../src/data/audio.ts';

config({ quiet: true });
const key = process.env.ELEVENLABS_API_KEY?.trim();
if (!key) throw new Error('Set ELEVENLABS_API_KEY on the server before generating audio.');
const voice = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
const model = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const manifestPath = 'public/audio/manifest.json';
type AudioCredit = { provider: string; fingerprint: string; model: string; characters: number; createdAt: string };
const manifest: Record<string, AudioCredit> = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(() => ({}));
await mkdir('public/audio', { recursive: true });

async function generate(file: string, endpoint: string, body: Record<string, unknown>): Promise<void> {
  const fingerprint = createHash('sha256').update(JSON.stringify({ endpoint, body })).digest('hex');
  if (manifest[file]?.fingerprint === fingerprint && await readFile(`public${file}`).then(() => true).catch(() => false)) return;
  const response = await fetch(`https://api.elevenlabs.io/v1/${endpoint}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': key!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`ElevenLabs audio generation failed (${response.status}). No credentials or response body logged.`);
  if (!response.headers.get('content-type')?.startsWith('audio/')) throw new Error('Expected audio from ElevenLabs.');
  await writeFile(`public${file}`, Buffer.from(await response.arrayBuffer()));
  manifest[file] = { provider: 'ElevenLabs', fingerprint, model: String(body.model_id), characters: Number(response.headers.get('character-cost') ?? String(body.text).length), createdAt: new Date().toISOString() };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Generated ${file}`);
}

for (const [index, stop] of TOUR_STOPS.entries()) await generate(TOUR_AUDIO(index), `text-to-speech/${encodeURIComponent(voice)}`, {
  text: stop.narration, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75 },
});
for (const sound of Object.values(SOUNDS)) await generate(sound.file, 'sound-generation', {
  text: sound.prompt, duration_seconds: sound.duration, loop: sound.loop, prompt_influence: 0.3, model_id: 'eleven_text_to_sound_v2',
});
