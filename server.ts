import express from 'express';
import { config } from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ALL_BUILDINGS, UNIVERSITIES } from './src/data/campusData.ts';
import { rankStudySpaces, recommendStudySpot } from './src/utils/campusLogic.ts';

config();

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const apiKey = process.env.AI_API_KEY?.trim();

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, mode: apiKey ? 'model-enabled' : 'local' });
});

app.post('/api/ai/concierge', async (request, response) => {
  const query = typeof request.body?.query === 'string' ? request.body.query.trim().slice(0, 240) : '';
  const campusId = typeof request.body?.campusId === 'string' ? request.body.campusId : '';
  const hour = Number.isFinite(request.body?.hour) ? Number(request.body.hour) : 16;
  if (!query) return response.status(400).json({ error: 'Enter a study preference or question.' });

  const campus = UNIVERSITIES.flatMap(university => university.campuses).find(item => item.id === campusId);
  const buildings = campus?.buildings ?? ALL_BUILDINGS;
  const local = recommendStudySpot(query, buildings, hour);
  if (!apiKey || !local.match) return response.json({ ...local, source: 'local', usage: null });

  try {
    const candidates = rankStudySpaces(buildings, hour).slice(0, 18).map(spot => ({
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
    const match = rankStudySpaces(buildings, hour).find(item => item.building.id === parsed.buildingId && item.floor.level === parsed.floorLevel);
    if (!match) throw new Error('Selected floor is closed');
    return response.json({ headline: `${match.building.name} · ${match.floor.level}`, explanation: parsed.explanation.slice(0, 220), match, criteria: local.criteria, source: 'model', usage: payload.usage ?? null });
  } catch {
    return response.json({ ...local, source: 'local-fallback', usage: null });
  }
});

app.post('/api/ai/tts', async (request, response) => {
  const text = typeof request.body?.text === 'string' ? request.body.text.trim().slice(0, 1200) : '';
  if (!text) return response.status(400).json({ error: 'Text is required.' });
  if (!apiKey) return response.status(503).json({ error: 'Neural speech is not configured.', fallback: true });
  try {
    const speech = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'coral', input: text, response_format: 'mp3' }),
    });
    if (!speech.ok) throw new Error(`Speech returned ${speech.status}`);
    response.set('Content-Type', 'audio/mpeg');
    return response.send(Buffer.from(await speech.arrayBuffer()));
  } catch {
    return response.status(503).json({ error: 'Neural speech is unavailable.', fallback: true });
  }
});

async function start(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(root, 'dist')));
    app.get('*', (_request, response) => response.sendFile(path.join(root, 'dist/index.html')));
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: process.env.DISABLE_HMR === 'true' ? false : undefined }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  app.listen(port, '0.0.0.0', () => console.log(`CampusExplorer running at http://localhost:${port}`));
}

void start();
