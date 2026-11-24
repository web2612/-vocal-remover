import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';
import { MAX_FILE_BYTES, PART_BYTES, PREVIEW_SECONDS } from '../src/lib/audio/filePolicy.ts';

const MINUTE = 60_000;
const ACTIVE = new Set(['uploading', 'queued', 'validating', 'processing', 'exporting']);
const RUNNING = new Set(['validating', 'processing', 'exporting']);
const JOB_ID = /^[a-f0-9]{64}$/;
const COOKIE = '__Host-vocal-session';
const ENCODER = new TextEncoder();

class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

const fail = (status, code) => { throw new ApiError(status, code); };
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value, status = 200, extra) => Response.json(value, { status, headers: { ...headers, ...extra } });
const empty = () => new Response(null, { status: 204, headers });
const coordinator = env => env.JOBS.getByName('v1');
const stemKey = (id, lease, stem) => `jobs/${id}/${lease}/${stem}.wav`;
const inputKey = id => `jobs/${id}/input`;

async function hash(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', ENCODER.encode(text)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function sessionCookie(request) {
  return request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-vocal-session=([a-f0-9-]{36})(?:;|$)/i)?.[1];
}

async function readExact(request, length, exact = true) {
  if (!request.body || !Number.isSafeInteger(length) || length < 1 || length > PART_BYTES) fail(400, 'invalid_size');
  const data = new Uint8Array(length);
  const reader = request.body.getReader();
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > length) fail(413, 'too_large');
      data.set(value, offset);
      offset += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (exact && offset !== length) fail(400, 'invalid_size');
  return data.subarray(0, offset);
}

async function streamStem(bucket, key, request) {
  const object = await bucket.head(key);
  if (!object) return json({ code: 'expired' }, 410);
  const responseHeaders = {
    ...headers, 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Content-Length': String(object.size),
  };
  const range = request.headers.get('Range');
  if (!range) {
    const read = request.method === 'HEAD' ? object : await bucket.get(key);
    if (!read) return json({ code: 'expired' }, 410);
    return new Response(request.method === 'HEAD' ? null : read.body, { headers: responseHeaders });
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const offset = match?.[1] ? Number(match[1]) : Math.max(0, object.size - Number(match?.[2]));
  const end = match?.[1] && match[2] ? Math.min(object.size - 1, Number(match[2])) : object.size - 1;
  if (!match || !Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset > end) {
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${object.size}` } });
  }
  const length = end - offset + 1;
  const read = request.method === 'HEAD' ? object : await bucket.get(key, { range: { offset, length } });
  if (!read) return json({ code: 'expired' }, 410);
  return new Response(request.method === 'HEAD' ? null : read.body, {
    status: 206, headers: {
      ...responseHeaders, 'Content-Length': String(length), 'Content-Range': `bytes ${offset}-${end}/${object.size}`,
    },
  });
}

export default {
  async fetch(request, env) {
    try {
      const { pathname } = new URL(request.url);
      if (pathname === '/api/v1/session' && request.method === 'GET') {
        if (env.CLOUD_ENABLED !== 'true') fail(503, 'disabled');
        const session = sessionCookie(request) ?? crypto.randomUUID();
        return json({}, 200, { 'Set-Cookie': `${COOKIE}=${session}; Path=/; SameSite=Strict; Secure; HttpOnly; Max-Age=3600` });
      }

      // Bridge: Forward API requests directly to PHP Multi-Provider Gateway if configured
      if (env.PROVIDER_GATEWAY_URL && (pathname.startsWith('/api/v1/admin/') || pathname.startsWith('/api/v1/jobs') || pathname.startsWith('/api/v1/temporary-input') || pathname === '/api/v1/health')) {
        const { search } = new URL(request.url);
        const targetUrl = env.PROVIDER_GATEWAY_URL.replace(/\/$/, '') + pathname + search;
        return await fetch(targetUrl, {
          method: request.method,
          headers: request.headers,
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        });
      }

      const cookie = sessionCookie(request);
      if (!cookie) fail(404, 'not_found');
      if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('Origin') !== env.SITE_ORIGIN) fail(403, 'origin');
      const owner = await hash(cookie);
      const authHeaders = new Headers(request.headers);
      authHeaders.set('X-Job-Owner', owner);

      if (pathname === '/api/v1/jobs' && request.method === 'POST') {
        if (env.CLOUD_ENABLED !== 'true') fail(503, 'disabled');
        const token = request.headers.get('Idempotency-Key');
        if (!/^[a-f0-9-]{36}$/i.test(token ?? '')) fail(400, 'invalid_request');
        authHeaders.set('X-Job-Id', await hash(owner + token));
      }
      const jobPath = /^\/api\/v1\/jobs\/([a-f0-9]{64})(?:\/(parts|start|stems)(?:\/(\w+))?)?$/.exec(pathname);
      if (pathname !== '/api/v1/jobs' && !jobPath) fail(404, 'not_found');
      if (jobPath?.[2] === 'stems') {
        if (!['GET', 'HEAD'].includes(request.method) || !['vocals', 'instrumental'].includes(jobPath[3])) fail(404, 'not_found');
        const job = await coordinator(env).owned(jobPath[1], owner);
        if (!job) fail(404, 'not_found');
        if (job.deadline <= Date.now()) fail(410, 'expired');
        if (job.state !== 'complete') fail(409, 'results_unavailable');
        return await streamStem(env.AUDIO, stemKey(job.id, job.lease, jobPath[3]), request);
      }
      return await coordinator(env).fetch(new Request(request, { headers: authHeaders }));
    } catch (error) {
      return publicError(error);
    }
  },

  async queue(batch, env) {
    const jobs = coordinator(env);
    for (const message of batch.messages) {
      if (!JOB_ID.test(message.body?.id ?? '')) { message.ack(); continue; }
      const claim = await jobs.claim(message.body.id);
      if (claim === 'busy') { message.retry({ delaySeconds: 10 }); continue; }
      if (!claim) { message.ack(); continue; }
      let outcome = { code: 'processor_unavailable' };
      try {
        if (env.PROVIDER_GATEWAY_URL) {
          try {
            const gatewayUrl = env.PROVIDER_GATEWAY_URL.replace(/\/$/, '') + '/api/v1/jobs';
            const inputObject = await env.AUDIO.get(inputKey(claim.id));
            if (inputObject) {
              const formData = new FormData();
              formData.append('audio', await inputObject.blob(), `job-${claim.id}.${claim.format}`);
              const gwRes = await fetch(gatewayUrl, {
                method: 'POST',
                headers: env.ADMIN_SECRET_KEY ? { 'X-Admin-Key': env.ADMIN_SECRET_KEY } : {},
                body: formData,
                signal: AbortSignal.timeout(Math.max(1, claim.deadline - Date.now())),
              });
              if (gwRes.ok) {
                const gwData = await gwRes.json();
                if (gwData.vocalsUrl && gwData.instrumentalUrl) {
                  const [vocalRes, instRes] = await Promise.all([
                    fetch(gwData.vocalsUrl),
                    fetch(gwData.instrumentalUrl)
                  ]);
                  if (vocalRes.ok && instRes.ok) {
                    await Promise.all([
                      env.AUDIO.put(stemKey(claim.id, claim.lease, 'vocals'), vocalRes.body, { httpMetadata: { contentType: 'audio/wav' } }),
                      env.AUDIO.put(stemKey(claim.id, claim.lease, 'instrumental'), instRes.body, { httpMetadata: { contentType: 'audio/wav' } })
                    ]);
                    outcome = { duration: gwData.duration || 60 };
                  }
                }
              }
            }
          } catch (gwErr) {
            console.error('Provider gateway fallback to container:', gwErr);
          }
        }

        if (!outcome.duration) {
          const response = await env.PROCESSOR.getByName(`slot-${claim.slot}`).run(claim);
          outcome = response;
        }
      } catch {
        console.error('Cloud audio processor unavailable');
        outcome = { code: 'processor_unavailable' };
      }
      await jobs.finish(claim.id, claim.lease, outcome);
      message.ack();
    }
  },
  scheduled(_event, env, context) {
    context.waitUntil(coordinator(env).sweep());
  },
};

function publicError(error) {
  if (error instanceof ApiError) return json({ code: error.message }, error.status);
  console.error('Cloud job operation failed');
  return json({ code: 'unavailable' }, 503);
}

export class JobCoordinator extends DurableObject {
  locks = new Map();
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, created INTEGER NOT NULL, record TEXT NOT NULL
    )`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS jobs_created ON jobs(created)');
  }

  lock(id, work) {
    const pending = (this.locks.get(id) ?? Promise.resolve()).then(work);
    const settled = pending.catch(() => {});
    this.locks.set(id, settled);
    return pending.finally(() => { if (this.locks.get(id) === settled) this.locks.delete(id); });
  }

  get(id) {
    const row = this.sql.exec('SELECT record FROM jobs WHERE id = ?', id).toArray()[0];
    return row && JSON.parse(row.record);
  }

  save(job) {
    this.sql.exec(`INSERT INTO jobs VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET record = excluded.record`, job.id, job.owner, job.created, JSON.stringify(job));
  }

  recent() {
    return this.sql.exec('SELECT record FROM jobs WHERE created >= ?', Date.now() - 48 * 60 * MINUTE)
      .toArray().map(row => JSON.parse(row.record));
  }

  owned(id, owner) {
    const job = this.get(id);
    return job?.owner === owner ? job : null;
  }

  async fetch(request) {
    try {
      const owner = request.headers.get('X-Job-Owner');
      const path = new URL(request.url).pathname;
      if (path === '/api/v1/jobs' && request.method === 'POST') {
        const id = request.headers.get('X-Job-Id');
        if (!JOB_ID.test(id ?? '')) fail(400, 'invalid_request');
        let data;
        try { data = JSON.parse(new TextDecoder().decode(await readExact(request, 1024, false))); }
        catch { fail(400, 'invalid_request'); }
        return await this.lock(id, () => this.create(id, owner, data));
      }
      const match = /^\/api\/v1\/jobs\/([a-f0-9]{64})(?:\/(parts|start)(?:\/(\d+))?)?$/.exec(path);
      if (!match) fail(404, 'not_found');
      const [, id, action, number] = match;
      return await this.lock(id, async () => {
        const job = this.owned(id, owner);
        if (!job) fail(404, 'not_found');
        if (!action && request.method === 'DELETE') {
          if (job.state !== 'cancelled') {
            this.end(job, 'cancelled');
            await this.clean(job);
          }
          return empty();
        }
        if (job.deadline <= Date.now()) fail(410, 'expired');
        if (!action && request.method === 'GET') {
          return json({ state: job.state, percent: job.percent, duration: job.duration,
            expiresAt: job.deadline, code: job.code });
        }
        if (action === 'parts' && request.method === 'PUT') return this.putPart(job, Number(number), request);
        if (action === 'start' && !number && request.method === 'POST') return this.start(job);
        fail(404, 'not_found');
      });
    } catch (error) {
      return publicError(error);
    }
  }

  create(id, owner, data) {
    if (!data || typeof data !== 'object') fail(400, 'invalid_request');
    const { size, format, mode } = data;
    if (size > MAX_FILE_BYTES) fail(413, 'too_large');
    if (!Number.isSafeInteger(size) || size < 12 || !['mp3', 'wav'].includes(format) || typeof mode !== 'string' ||
        !Object.hasOwn(PREVIEW_SECONDS, mode)) fail(400, 'invalid_request');
    const previous = this.owned(id, owner);
    if (previous && (previous.size !== size || previous.format !== format || previous.mode !== mode)) fail(409, 'invalid_request');
    if (previous) return json({ id, uploadExpiresAt: previous.created + 10 * MINUTE, partSize: PART_BYTES });
    const now = Date.now();
    const jobs = this.recent();
    const utcStart = Math.floor(now / (24 * 60 * MINUTE)) * 24 * 60 * MINUTE;
    if (jobs.filter(job => job.created >= utcStart).length >= 20 ||
        jobs.some(job => job.owner === owner && ACTIVE.has(job.state) && job.deadline > now)) fail(429, 'capacity');
    this.save({ id, owner, size, format, mode, created: now, deadline: now + 10 * MINUTE,
      parts: {}, stems: {}, state: 'uploading', percent: 0 });
    return json({ id, uploadExpiresAt: now + 10 * MINUTE, partSize: PART_BYTES }, 201);
  }

  async putPart(job, number, request) {
    if (job.state !== 'uploading') fail(409, 'invalid_state');
    const length = Math.min(PART_BYTES, job.size - PART_BYTES * (number - 1));
    if (!Number.isInteger(number) || number < 1 || length < 1) fail(400, 'invalid_part');
    const body = await readExact(request, length);
    let upload;
    if (job.inputUpload) upload = this.env.AUDIO.resumeMultipartUpload(inputKey(job.id), job.inputUpload);
    else {
      upload = await this.env.AUDIO.createMultipartUpload(inputKey(job.id));
      job.inputUpload = upload.uploadId;
      this.save(job);
    }
    job.parts[number] = await upload.uploadPart(number, body);
    this.save(job);
    return empty();
  }

  async start(job) {
    if (job.state === 'queued') {
      if (!job.dispatched) await this.dispatch(job);
      return json({ id: job.id }, 202);
    }
    if (RUNNING.has(job.state) || job.state === 'complete') return json({ id: job.id }, 202);
    if (job.state !== 'uploading') fail(409, 'invalid_state');
    const count = Math.ceil(job.size / PART_BYTES);
    const parts = Array.from({ length: count }, (_, index) => job.parts[index + 1]);
    if (!job.inputUpload || parts.some(part => !part)) fail(409, 'incomplete_upload');
    const key = inputKey(job.id);
    const existing = await this.env.AUDIO.head(key);
    const object = existing ?? await this.env.AUDIO.resumeMultipartUpload(key, job.inputUpload).complete(parts);
    if (object.size !== job.size) fail(400, 'invalid_size');
    job.inputUpload = undefined;
    job.parts = {};
    job.state = 'queued';
    job.deadline = Date.now() + 5 * MINUTE;
    job.percent = 25;
    this.save(job);
    await this.dispatch(job);
    return json({ id: job.id }, 202);
  }

  async dispatch(job) {
    await this.env.SEPARATION.send({ id: job.id });
    job.dispatched = true;
    this.save(job);
  }

  claim(id) {
    return this.lock(id, () => {
      const job = this.get(id);
      const now = Date.now();
      if (!job || job.state !== 'queued' || job.deadline <= now) return null;
      const occupied = this.recent().filter(item => item.slot !== undefined && item.runningUntil > now);
      const slot = [0, 1].find(candidate => !occupied.some(item => item.slot === candidate));
      if (slot === undefined) return 'busy';
      job.state = 'validating';
      job.slot = slot;
      job.lease = crypto.randomUUID();
      job.deadline = now + 10 * MINUTE;
      job.runningUntil = job.deadline;
      this.save(job);
      return { id, slot, lease: job.lease, size: job.size, mode: job.mode, format: job.format, deadline: job.deadline };
    });
  }

  activeAttempt(id, lease, slot) {
    const job = this.get(id);
    return job && job.lease === lease && job.slot === slot && RUNNING.has(job.state) && job.deadline > Date.now();
  }

  updateProgress(id, lease, slot, state, percent) {
    return this.lock(id, () => {
      if (!this.activeAttempt(id, lease, slot)) return false;
      const job = this.get(id);
      job.state = state;
      job.percent = Math.max(job.percent, percent);
      this.save(job);
      return true;
    });
  }

  output(id, lease, slot, stem, method, number, data) {
    return this.lock(id, async () => {
      if (!this.activeAttempt(id, lease, slot)) return json({ code: 'expired' }, 410);
      const job = this.get(id);
      const key = stemKey(id, lease, stem);
      let output = job.stems[stem];
      if (method === 'POST' && number === 0) {
        if (!output) {
          const upload = await this.env.AUDIO.createMultipartUpload(key, { httpMetadata: { contentType: 'audio/wav' } });
          output = { upload: upload.uploadId, parts: [] };
          job.stems[stem] = output;
          this.save(job);
        }
      } else if (method === 'PUT' && data?.byteLength && data.byteLength <= PART_BYTES &&
          output?.upload && number === output.parts.length + 1 && number <= 14) {
        const upload = this.env.AUDIO.resumeMultipartUpload(key, output.upload);
        output.parts.push(await upload.uploadPart(number, data));
        this.save(job);
      } else if (method === 'POST' && number === -1 && output?.upload && output.parts.length) {
        const upload = this.env.AUDIO.resumeMultipartUpload(key, output.upload);
        await upload.complete(output.parts);
        job.stems[stem] = { complete: true };
        this.save(job);
      } else fail(400, 'invalid_part');
      return empty();
    });
  }

  finish(id, lease, outcome) {
    return this.lock(id, async () => {
      const job = this.get(id);
      if (!job || job.lease !== lease) return;
      job.slot = undefined;
      job.runningUntil = undefined;
      if (ACTIVE.has(job.state)) {
        if (job.deadline <= Date.now()) this.end(job, 'failed', 'timeout');
        else if (job.stems.vocals?.complete && job.stems.instrumental?.complete &&
            Number.isFinite(outcome.duration) && outcome.duration >= 1 && outcome.duration <= 600) {
          job.state = 'complete';
          job.percent = 100;
          job.duration = outcome.duration;
          job.deadline = Date.now() + 15 * MINUTE;
        } else this.end(job, 'failed', outcome.code === 'invalid_audio' ? 'invalid_audio' : 'processor_unavailable');
      }
      this.save(job);
      await this.clean(job);
    });
  }

  end(job, state, code = state) {
    job.state = state;
    job.code = code;
    job.deadline = Date.now() + 5 * MINUTE;
    this.save(job);
  }

  async clean(job) {
    try {
      const bucket = this.env.AUDIO;
      if (job.inputUpload) {
        const key = inputKey(job.id);
        if (!await bucket.head(key)) await bucket.resumeMultipartUpload(key, job.inputUpload).abort();
        job.inputUpload = undefined;
      }
      if (!job.inputDeleted) {
        await bucket.delete(inputKey(job.id));
        job.inputDeleted = true;
        job.parts = {};
      }
      if (job.state !== 'complete' && job.lease) {
        for (const stem of ['vocals', 'instrumental']) {
          const key = stemKey(job.id, job.lease, stem);
          const output = job.stems[stem];
          if (output?.upload && !await bucket.head(key)) await bucket.resumeMultipartUpload(key, output.upload).abort();
          await bucket.delete(key);
          delete job.stems[stem];
        }
      }
      this.save(job);
    } catch {
      this.save(job);
      console.error('Temporary cloud audio cleanup will retry');
    }
  }

  async sweep() {
    for (const entry of this.recent()) {
      await this.lock(entry.id, async () => {
        const job = this.get(entry.id);
        if (job.deadline <= Date.now() && (ACTIVE.has(job.state) || job.state === 'complete')) {
          this.end(job, 'expired');
        }
        if (job.state === 'queued' && !job.dispatched) {
          await this.dispatch(job).catch(() => console.error('Cloud audio queue dispatch will retry'));
        }
        const pendingCleanup = !job.inputDeleted || (job.state !== 'complete' && Object.keys(job.stems).length);
        if (!ACTIVE.has(job.state) && pendingCleanup) await this.clean(job);
        if (!ACTIVE.has(job.state) && job.inputDeleted && !Object.keys(job.stems).length &&
            job.created < Date.now() - 24 * 60 * MINUTE) {
          this.sql.exec('DELETE FROM jobs WHERE id = ?', job.id);
        }
      });
    }
  }
}

export class Processor extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    if (ctx.container?.running) {
      void ctx.blockConcurrencyWhile(() => ctx.container.setInactivityTimeout(2 * MINUTE));
    }
  }

  async run(attempt) {
    const container = this.ctx.container;
    if (!container.running) {
      await container.interceptOutboundHttp('audio.internal',
        this.ctx.exports.AudioGateway({ props: { slot: attempt.slot } }));
      container.start({ image: container.images.base, instance: 'standard-3', enableInternet: false });
      await container.setInactivityTimeout(2 * MINUTE);
    }
    const port = container.getTcpPort(8080);
    const readyBy = Math.min(attempt.deadline, Date.now() + 90_000);
    while (Date.now() < readyBy) {
      try {
        const response = await port.fetch('http://container/health', { signal: AbortSignal.timeout(1000) });
        await response.body?.cancel();
        if (response.ok) {
          const result = await this.separate(port, attempt);
          return result;
        }
      } catch (error) {
        if (error instanceof ApiError) throw error;
      }
      await scheduler.wait(500);
    }
    throw new Error('Container readiness timed out');
  }

  async separate(port, attempt) {
    try {
      const response = await port.fetch('http://container/separate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt),
        signal: AbortSignal.timeout(Math.max(1, attempt.deadline - Date.now())),
      });
      return await response.json();
    } catch {
      // A broken connection can leave the container computing the old attempt.
      await this.ctx.container.destroy().catch(() => {});
      fail(503, 'processor_unavailable');
    }
  }
}

export class AudioGateway extends WorkerEntrypoint {
  async fetch(request) {
    try {
      const { slot } = this.ctx.props;
      const [, id, lease, action, stem, part] = new URL(request.url).pathname.split('/');
      if (!JOB_ID.test(id ?? '') || !/^[0-9a-f-]{36}$/i.test(lease ?? '')) fail(404, 'not_found');
      const jobs = coordinator(this.env);
      if (!await jobs.activeAttempt(id, lease, slot)) fail(410, 'expired');
      if (action === 'active' && request.method === 'GET') return empty();
      if (action === 'input' && request.method === 'GET') {
        const object = await this.env.AUDIO.get(inputKey(id));
        if (!object) fail(410, 'expired');
        return new Response(object.body, { headers: { ...headers, 'Content-Length': String(object.size) } });
      }
      if (action === 'progress' && request.method === 'POST') {
        const { state, percent } = await request.json();
        if (!['validating', 'processing', 'exporting'].includes(state) ||
            !Number.isInteger(percent) || percent < 25 || percent > 99) fail(400, 'invalid_request');
        if (!await jobs.updateProgress(id, lease, slot, state, percent)) fail(410, 'expired');
        return empty();
      }
      if (action === 'stem' && ['vocals', 'instrumental'].includes(stem)) {
        // Streamed HTTP stays on a fetch interface. Convert only the bounded part before Durable Object RPC.
        const length = Number(request.headers.get('X-Part-Bytes'));
        const body = request.method === 'PUT' ? await readExact(request, length) : null;
        return await jobs.output(id, lease, slot, stem, request.method, Number(part), body);
      }
      fail(404, 'not_found');
    } catch (error) {
      return publicError(error);
    }
  }
}
