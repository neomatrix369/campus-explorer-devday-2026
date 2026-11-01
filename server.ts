import express from 'express';
import { config } from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { TOUR_STOPS } from './src/data/tour.ts';
import { TOUR_AUDIO } from './src/data/audio.ts';
import { ALL_BUILDINGS, UNIVERSITIES } from './src/data/campusData.ts';
import { explainStudySpot, parseStudyQuery, rankStudySpaces, recommendStudySpot, spotCriteria } from './src/utils/campusLogic.ts';

config();

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const apiKey = process.env.AI_API_KEY?.trim();

function estimatedModelCost(usage: unknown): number | null {
  if (!process.env.AI_INPUT_USD_PER_M?.trim() || !process.env.AI_OUTPUT_USD_PER_M?.trim()) return null;
  const inputRate = Number(process.env.AI_INPUT_USD_PER_M);
  const outputRate = Number(process.env.AI_OUTPUT_USD_PER_M);
  const tokens = usage as { input_tokens?: number; output_tokens?: number } | null;
  if (!tokens || !Number.isFinite(inputRate) || !Number.isFinite(outputRate) || inputRate < 0 || outputRate < 0) return null;
  if (!Number.isFinite(tokens.input_tokens) || !Number.isFinite(tokens.output_tokens)) return null;
  return Number(((tokens.input_tokens! * inputRate + tokens.output_tokens! * outputRate) / 1_000_000).toFixed(6));
}

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, mode: apiKey ? 'model-enabled' : 'local', speech: existsSync(path.join(root, 'public/audio/tour-1.mp3')) ? 'elevenlabs-bundled' : 'browser' });
});

let petMode: 'desktop' | 'tour' = 'desktop';
let petTourExpiresAt = 0;
const localPetRequest = (address: string | undefined): boolean =>
  address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';

app.get('/api/pet/mode', (request, response) => {
  if (!localPetRequest(request.socket.remoteAddress)) return response.sendStatus(403);
  if (petMode === 'tour' && Date.now() > petTourExpiresAt) petMode = 'desktop';
  return response.json({ mode: petMode });
});

app.post('/api/pet/mode', (request, response) => {
  if (!localPetRequest(request.socket.remoteAddress)) return response.sendStatus(403);
  if (request.body?.mode !== 'desktop' && request.body?.mode !== 'tour') return response.status(400).json({ error: 'Invalid pet mode.' });
  petMode = request.body.mode;
  petTourExpiresAt = petMode === 'tour' ? Date.now() + 10_000 : 0;
  return response.json({ mode: petMode });
});

app.post('/api/ai/concierge', async (request, response) => {
  const query = typeof request.body?.query === 'string' ? request.body.query.trim().slice(0, 240) : '';
  const campusId = typeof request.body?.campusId === 'string' ? request.body.campusId : '';
  const preference = parseStudyQuery(query);
  const hour = preference.startHour ?? (Number.isFinite(request.body?.hour) ? Number(request.body.hour) : 16);
  if (!query) return response.status(400).json({ error: 'Enter a study preference or question.' });

  const campus = UNIVERSITIES.flatMap(university => university.campuses).find(item => item.id === campusId);
  const buildings = campus?.buildings ?? ALL_BUILDINGS;
  const local = recommendStudySpot(query, buildings, hour);
  if (!apiKey || !local.match) return response.json({ ...local, source: 'local', usage: null, costUsd: 0 });

  try {
    const candidates = rankStudySpaces(buildings, hour, preference).slice(0, 18).map(spot => ({
      buildingId: spot.building.id, floorLevel: spot.floor.level, name: spot.building.name,
      floorName: spot.floor.name, type: spot.floor.type, seatsFreeEstimate: spot.seatsFree,
      noiseEstimate: spot.noise, sockets: spot.floor.sockets, water: spot.floor.water,
    }));
    const modelResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(9000),
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4.1-mini',
        store: false,
        instructions: 'You are a helpful London campus study assistant. Select exactly one listed building and floor. Treat all occupancy and noise as estimates. Never claim real-time data or a confirmed booking. Keep the explanation under 35 words.',
        input: JSON.stringify({ query, localHour: hour, candidates }),
        text: { format: { type: 'json_schema', name: 'campus_recommendation', strict: true, schema: {
          type: 'object', additionalProperties: false,
          properties: { buildingId: { type: 'string' }, floorLevel: { type: 'string' }, explanation: { type: 'string' } },
          required: ['buildingId', 'floorLevel', 'explanation'],
        } } },
      }),
    });
    if (!modelResponse.ok) throw new Error(`Model returned ${modelResponse.status}`);
    const payload = await modelResponse.json() as { output?: { content?: { type: string; text?: string }[] }[]; usage?: unknown };
    const content = payload.output?.flatMap(item => item.content ?? []).find(item => item.type === 'output_text')?.text;
    if (!content) throw new Error('Empty model response');
    const parsed = JSON.parse(content) as { buildingId: string; floorLevel: string; explanation: string };
    const selected = candidates.find(item => item.buildingId === parsed.buildingId && item.floorLevel === parsed.floorLevel);
    if (!selected) throw new Error('Model selected an unavailable floor');
    const match = rankStudySpaces(buildings, hour, preference).find(item => item.building.id === parsed.buildingId && item.floor.level === parsed.floorLevel);
    if (!match) throw new Error('Selected floor is closed');
    const modelExplanation = parsed.explanation.slice(0, 180);
    const explanation = /\b(live|real.time|verified|guaranteed|reserved|booked|confirmed)\b/i.test(modelExplanation)
      ? explainStudySpot(match, hour)
      : `${modelExplanation} Figures are estimates; verify access and availability.`;
    const criteria = spotCriteria(match);
    return response.json({ headline: `${match.building.name} · ${match.floor.level}`, explanation, match, criteria, source: 'model', usage: payload.usage ?? null, costUsd: estimatedModelCost(payload.usage) });
  } catch {
    return response.json({ ...local, source: 'local-fallback', usage: null, costUsd: null });
  }
});

// Only serve the pre-generated tour. Public visitors cannot trigger paid generation.
app.post('/api/ai/tts', (request, response) => {
  const index = TOUR_STOPS.findIndex(stop => stop.narration === request.body?.text);
  if (index < 0) return response.status(400).json({ error: 'Choose a supported tour stop.' });
  const file = path.join(root, 'public', TOUR_AUDIO(index));
  if (!existsSync(file)) return response.status(503).json({ error: 'Tour audio unavailable.', fallback: true });
  return response.type('audio/mpeg').sendFile(file);
});

async function start(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(root, 'dist')));
    app.get('*', (_request, response) => response.sendFile(path.join(root, 'dist/index.html')));
  } else {
    const hmrPort = port + 20_000;
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: { port: hmrPort, clientPort: hmrPort } }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  app.listen(port, '0.0.0.0', () => console.log(`CampusExplorer running at http://localhost:${port}`));
}

void start();
