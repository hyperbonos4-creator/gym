import * as http from 'http';
import * as https from 'https';
import { networkInterfaces } from 'os';
import { createConnection } from 'net';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { buildDigestAuthHeader, parseDigestChallenge } from './hikvision/digest-auth';
import { Camera } from './entities/camera.entity';
import { CreateCameraDto, UpdateCameraDto } from './dto/camera.dto';

/** Vista pública de una cámara: sin `rtspUrl` (contiene credenciales). */
export type CameraView = Omit<Camera, 'rtspUrl'>;

export interface ProbeResult {
  ok: boolean;
  /** 'http_snapshot' | 'isapi_digest' | 'isapi_basic' | 'unreachable' */
  method: string;
  thumbnailB64: string | null;
  detail: string | null;
}

export interface ScanCandidate {
  ip: string;
  port: number;
  /** 'hikvision' | 'dahua' | 'generic' */
  brand: string;
  /** URL RTSP sugerida para guardar */
  rtspUrl: string;
  /** URL snapshot HTTP que funcionó o fue retada */
  snapshotUrl: string;
  thumbnailB64: string | null;
  method: string;
}

export interface ScanResult {
  subnet: string;
  scanned: number;
  found: ScanCandidate[];
  durationMs: number;
}

@Injectable()
export class CamerasService {
  constructor(
    @InjectRepository(Camera)
    private readonly cameras: Repository<Camera>,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(dto: CreateCameraDto): Promise<CameraView> {
    const cam = this.cameras.create({
      name: dto.name,
      rtspUrl: dto.rtspUrl,
      externalKey: dto.externalKey ?? null,
      nvrChannel: dto.nvrChannel ?? null,
      status: 'ACTIVE',
    });
    return this.toView(await this.cameras.save(cam));
  }

  async list(): Promise<CameraView[]> {
    const rows = await this.cameras.find({ order: { name: 'ASC' } });
    return rows.map((r) => this.toView(r));
  }

  async update(id: string, dto: UpdateCameraDto): Promise<CameraView> {
    const cam = await this.cameras.findOne({ where: { id } });
    if (!cam) throw new NotFoundException('camera_not_found');
    if (dto.name !== undefined) cam.name = dto.name;
    if (dto.rtspUrl !== undefined) cam.rtspUrl = dto.rtspUrl;
    if (dto.externalKey !== undefined) cam.externalKey = dto.externalKey;
    if (dto.nvrChannel !== undefined) cam.nvrChannel = dto.nvrChannel;
    if (dto.status !== undefined) cam.status = dto.status;
    return this.toView(await this.cameras.save(cam));
  }

  async remove(id: string): Promise<void> {
    const res = await this.cameras.delete({ id });
    if (!res.affected) throw new NotFoundException('camera_not_found');
  }

  // ── Probe ─────────────────────────────────────────────────────────────────

  /**
   * Prueba si una URL de cámara responde y devuelve un thumbnail JPEG en b64.
   * Acepta rtsp://user:pass@host/... o http://user:pass@host/snapshot.jpg
   * Nunca lanza excepción.
   */
  async probe(url: string): Promise<ProbeResult> {
    const trimmed = url.trim();

    if (/^https?:\/\//i.test(trimmed)) {
      const buf = await this.fetchHttpDirect(trimmed);
      if (buf) return { ok: true, method: 'http_snapshot', thumbnailB64: buf.toString('base64'), detail: null };
      return { ok: false, method: 'http_snapshot', thumbnailB64: null, detail: 'no_response' };
    }

    let parsed: URL;
    try { parsed = new URL(trimmed); }
    catch { return { ok: false, method: 'parse_error', thumbnailB64: null, detail: 'invalid_url' }; }

    const host = parsed.hostname;
    const port = parseInt(parsed.port || '80', 10);
    const user = decodeURIComponent(parsed.username || '');
    const pass = decodeURIComponent(parsed.password || '');

    for (const ch of [101, 102, 1]) {
      const path = `/ISAPI/Streaming/channels/${ch}/picture`;
      const buf = await this.isapiDigest(host, port, path, user, pass);
      if (buf) return { ok: true, method: 'isapi_digest', thumbnailB64: buf.toString('base64'), detail: `ch${ch}` };
      const buf2 = await this.isapiBasic(host, port, path, user, pass);
      if (buf2) return { ok: true, method: 'isapi_basic', thumbnailB64: buf2.toString('base64'), detail: `ch${ch}` };
    }

    for (const p of ['/cgi-bin/snapshot.cgi', '/snapshot.jpg', '/jpg/image.jpg']) {
      const buf = await this.httpGet(host, port, p, user, pass);
      if (buf) return { ok: true, method: 'http_snapshot', thumbnailB64: buf.toString('base64'), detail: p };
    }

    return { ok: false, method: 'unreachable', thumbnailB64: null, detail: 'unreachable' };
  }

  // ── Network scan ──────────────────────────────────────────────────────────

  /**
   * Descubre cámaras IP en la subred local automáticamente.
   *
   * 1. Detecta la subred /24 de la primera interfaz privada del servidor
   * 2. TCP-probe paralelo (concurrencia 30) en puerto 80 con timeout 600ms
   * 3. Para cada host con puerto abierto intenta ISAPI (Hikvision) y CGI (Dahua)
   *    con contraseñas comunes — 401 ya confirma que es una cámara
   * 4. Devuelve candidatos con thumbnail si respondieron, o thumbnailB64=null
   *    si necesitan credenciales que no se probaron
   */
  async scan(
    subnet?: string,
    creds: Array<{ user: string; pass: string }> = [
      { user: 'admin', pass: 'admin' },
      { user: 'admin', pass: '12345' },
      { user: 'admin', pass: '123456' },
      { user: 'admin', pass: '' },
    ],
  ): Promise<ScanResult> {
    const t0 = Date.now();
    const net = subnet?.trim() || this.detectSubnet();
    const ips = Array.from({ length: 254 }, (_, i) => `${net}.${i + 1}`);

    // Ping TCP paralelo (puerto 80, concurrencia 30)
    const CONCURRENCY = 30;
    const alive: string[] = [];
    for (let i = 0; i < ips.length; i += CONCURRENCY) {
      const batch = ips.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map((ip) => this.tcpProbe(ip, 80, 600)));
      results.forEach((open, idx) => { if (open) alive.push(batch[idx]); });
    }

    // Identificar cámaras en paralelo
    const found: ScanCandidate[] = (
      await Promise.all(alive.map((ip) => this.identifyCamera(ip, 80, creds)))
    ).filter((c): c is ScanCandidate => c !== null);

    found.sort((a, b) => parseInt(a.ip.split('.')[3]) - parseInt(b.ip.split('.')[3]));

    return { subnet: net, scanned: ips.length, found, durationMs: Date.now() - t0 };
  }

  private detectSubnet(): string {
    const ifaces = networkInterfaces();
    for (const list of Object.values(ifaces)) {
      for (const iface of list ?? []) {
        if (iface.family !== 'IPv4' || iface.internal) continue;
        const ip = iface.address;
        if (
          /^192\.168\./.test(ip) ||
          /^10\./.test(ip) ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
        ) {
          const p = ip.split('.');
          return `${p[0]}.${p[1]}.${p[2]}`;
        }
      }
    }
    return '192.168.1';
  }

  private tcpProbe(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const sock = createConnection({ host, port });
      const timer = setTimeout(() => { sock.destroy(); resolve(false); }, timeoutMs);
      sock.on('connect', () => { clearTimeout(timer); sock.destroy(); resolve(true); });
      sock.on('error', () => { clearTimeout(timer); resolve(false); });
    });
  }

  private async identifyCamera(
    ip: string,
    port: number,
    creds: Array<{ user: string; pass: string }>,
  ): Promise<ScanCandidate | null> {
    const hikPaths = [
      '/ISAPI/Streaming/channels/101/picture',
      '/ISAPI/Streaming/channels/102/picture',
    ];
    const genericPaths = [
      '/cgi-bin/snapshot.cgi',
      '/snapshot.jpg',
      '/jpg/image.jpg',
      '/onvif/snapshot',
      '/tmpfs/snap.jpg',
    ];

    // Hikvision ISAPI — solo detectar, NO probar credenciales automáticamente
    // (evita bloqueo de la cámara por intentos fallidos)
    for (const path of hikPaths) {
      const r = await this.httpGetRaw(ip, port, path, null, 1200);
      if (r.status === 200 && r.body.length > 500) {
        return this.buildCandidate(ip, port, path, 'hikvision', 'isapi_open', r.body, '');
      }
      if (r.status === 401) {
        // Confirmado cámara Hikvision — NO probar credenciales para evitar bloqueo
        // El usuario las ingresa manualmente en el UI
        return this.buildCandidate(ip, port, path, 'hikvision', 'auth_needed', null, '');
      }
    }

    // Dahua / genérica — igual, solo detectar
    for (const path of genericPaths) {
      const r = await this.httpGetRaw(ip, port, path, null, 1200);
      if (r.status === 200 && r.body.length > 500) {
        return this.buildCandidate(ip, port, path, 'dahua', 'http_open', r.body, '');
      }
      if (r.status === 401) {
        return this.buildCandidate(ip, port, path, 'generic', 'auth_needed', null, '');
      }
    }

    return null;
  }

  private buildCandidate(
    ip: string, port: number, snapshotPath: string,
    brand: string, method: string,
    body: Buffer | null, credHint: string,
  ): ScanCandidate {
    const [user = '', pass = ''] = credHint ? credHint.split(':') : [];
    const auth = user ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
    const rtspPath = brand === 'hikvision'
      ? '/Streaming/Channels/101'
      : brand === 'dahua' ? '/cam/realmonitor?channel=1&subtype=0' : '/stream1';
    const rtspUrl = `rtsp://${auth}${ip}:554${rtspPath}`;
    const snapshotUrl = `http://${auth}${ip}${port !== 80 ? `:${port}` : ''}${snapshotPath}`;
    return {
      ip, port, brand, rtspUrl, snapshotUrl,
      thumbnailB64: body && body.length > 500 ? body.toString('base64') : null,
      method,
    };
  }

  // ── Red helpers ───────────────────────────────────────────────────────────

  private fetchHttpDirect(urlStr: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      let u: URL;
      try { u = new URL(urlStr); } catch { resolve(null); return; }
      const lib = u.protocol === 'https:' ? https : http;
      const headers: Record<string, string> = {};
      if (u.username) {
        headers['Authorization'] = `Basic ${Buffer.from(
          `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`,
        ).toString('base64')}`;
      }
      const req = lib.request(
        { hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: u.pathname + u.search, method: 'GET', headers, timeout: 6000 },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300 && chunks.length)
              resolve(Buffer.concat(chunks));
            else resolve(null);
          });
        },
      );
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.on('error', () => resolve(null));
      req.end();
    });
  }

  private httpGet(host: string, port: number, path: string, user: string, pass: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const headers: Record<string, string> = {};
      if (user) headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
      const req = http.request(
        { hostname: host, port, path, method: 'GET', headers, timeout: 4000 },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300 && chunks.length)
              resolve(Buffer.concat(chunks));
            else resolve(null);
          });
        },
      );
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.on('error', () => resolve(null));
      req.end();
    });
  }

  private async isapiDigest(host: string, port: number, path: string, user: string, pass: string): Promise<Buffer | null> {
    const first = await this.httpGetRaw(host, port, path, null);
    if (first.status === 200 && first.body.length) return first.body;
    if (first.status !== 401 || !first.www) return null;
    const challenge = parseDigestChallenge(first.www);
    if (!challenge) return null;
    const authHeader = buildDigestAuthHeader({ username: user, password: pass, method: 'GET', uri: path, challenge });
    const second = await this.httpGetRaw(host, port, path, authHeader);
    return second.status === 200 && second.body.length ? second.body : null;
  }

  private async isapiBasic(host: string, port: number, path: string, user: string, pass: string): Promise<Buffer | null> {
    const auth = user ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : null;
    const r = await this.httpGetRaw(host, port, path, auth);
    return r.status === 200 && r.body.length ? r.body : null;
  }

  private httpGetRaw(
    host: string, port: number, path: string, authHeader: string | null, timeoutMs = 4000,
  ): Promise<{ status: number; body: Buffer; www: string | null }> {
    return new Promise((resolve) => {
      const headers: Record<string, string> = {};
      if (authHeader) headers['Authorization'] = authHeader;
      const req = http.request(
        { hostname: host, port, path, method: 'GET', headers, timeout: timeoutMs },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              body: Buffer.concat(chunks),
              www: (Array.isArray(res.headers['www-authenticate'])
                ? res.headers['www-authenticate'][0]
                : res.headers['www-authenticate']) ?? null,
            }),
          );
        },
      );
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: Buffer.alloc(0), www: null }); });
      req.on('error', () => resolve({ status: 0, body: Buffer.alloc(0), www: null }));
      req.end();
    });
  }

  private toView(cam: Camera): CameraView {
    const { rtspUrl: _omit, ...view } = cam;
    void _omit;
    return view;
  }
}
