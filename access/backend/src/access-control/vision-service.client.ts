import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TenantContext } from '../common/tenant/tenant-context.service';

/** Resultado de enrolamiento devuelto por el Vision_Service (`/enroll`). */
export interface VisionEnrollResult {
  ok: boolean;
  vectorPointId?: string | null;
  model?: string | null;
  dim?: number | null;
  quality?: number | null;
  reason?: string | null; // NO_FACE | MULTIPLE_FACES | LOW_QUALITY | SPOOF_SUSPECTED
}

/** Error de disponibilidad del Vision_Service (canal caído / timeout). */
export class VisionServiceUnavailableError extends Error {
  constructor(detail: string) {
    super(`vision_service_unavailable: ${detail}`);
    this.name = 'VisionServiceUnavailableError';
  }
}

/** Resultado de reconocimiento 1:N de un frame (`/recognize`). */
export interface VisionRecognizeResult {
  ok: boolean;
  /** false => no se detectó rostro en el frame. */
  face: boolean;
  /** subject_id reconocido, o "unknown". */
  label: string | null;
  /** similitud 1:N [0,1]. */
  score: number;
  /** liveness pasivo [0,1]. 0 cuando el detector no está instalado. */
  livenessScore: number;
  /** PASSIVE, o UNAVAILABLE si el detector anti-foto no está instalado. */
  livenessMode: string;
  livenessAvailable: boolean;
  bbox: number[] | null;
  frameWidth: number | null;
  frameHeight: number | null;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Observación de una acción del reto, revalidada por el Vision. */
export interface VisionActionObservation {
  action: string;
  satisfied: boolean;
  yawRatio: number | null;
  hasFace: boolean;
  passiveScore: number | null;
}

/** Resultado de la revalidación de liveness activo (`/liveness/active`). */
export interface VisionActiveLivenessResult {
  ok: boolean;
  observed: VisionActionObservation[];
  passiveScore: number;
  passiveAvailable: boolean;
  reason: string | null;
  /** Liveness pasivo del frame frontal (LOOK_CENTER) — toma fiable para el gate. */
  centerPassiveScore: number;
  centerPassiveAvailable: boolean;
  identityMinSimilarity: number;
  identityAvailable: boolean;
}

/**
 * Cliente del microservicio `vision` (FastAPI + ONNX). Gestiona plantillas
 * (`/enroll`, `DELETE /templates/:id`), reconocimiento (`/recognize`) y
 * revalidación de liveness activo (`/liveness/active`). El espacio de nombres
 * del Vector_Store (`conjunto_id`) se fija al `SITE_ID` de la oficina.
 *
 * fail-secure / fail-loud, confidencialidad (nunca devuelve embeddings ni
 * loguea el token), `fetchFn` inyectable para tests.
 */
@Injectable()
export class VisionServiceClient {
  private readonly logger = new Logger(VisionServiceClient.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  /** Timeout ampliado para el liveness activo (procesa varios frames en CPU). */
  private readonly activeLivenessTimeoutMs: number;
  /** Espacio de nombres del sitio (reemplaza el `conjuntoId` de URBAN). */
  readonly siteId: string;

  /** Sustituible en tests. Por defecto usa el `fetch` global (Node 18+). */
  fetchFn: FetchLike = (input, init) => fetch(input, init);

  constructor(
    private readonly config: ConfigService,
    private readonly tenant?: TenantContext,
  ) {
    this.baseUrl = (
      this.config.get<string>('VISION_SERVICE_URL') ?? 'http://localhost:8200'
    ).replace(/\/+$/, '');
    this.token = this.config.get<string>('VISION_SERVICE_TOKEN') ?? '';
    this.timeoutMs = this.config.get<number>('VISION_SERVICE_TIMEOUT_MS', 5000);
    this.activeLivenessTimeoutMs = this.config.get<number>(
      'VISION_ACTIVE_LIVENESS_TIMEOUT_MS',
      45000,
    );
    this.siteId = this.config.get<string>('SITE_ID') ?? 'office';
  }

  /**
   * Espacio de nombres del Vector_Store para el tenant ACTUAL. En una sesión de
   * demo aísla la colección por sesión (`faces_demo_<id>`); fuera del demo usa
   * el `SITE_ID` base. Así el reconocimiento de un demo NUNCA cruza rostros de
   * otra persona.
   */
  private conjuntoId(): string {
    return this.tenant ? this.tenant.visionNamespace(this.siteId) : this.siteId;
  }

  /** Genera un Face_Template a partir de una imagen base64. */
  async enroll(subjectId: string, imageB64: string): Promise<VisionEnrollResult> {
    const res = await this.post('/enroll', {
      conjunto_id: this.conjuntoId(),
      subject_id: subjectId,
      image_b64: imageB64,
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new VisionServiceUnavailableError(`enroll status ${res.status}`);
    return {
      ok: Boolean(body.ok),
      vectorPointId: (body.vector_point_id as string) ?? null,
      model: (body.model as string) ?? null,
      dim: (body.dim as number) ?? null,
      quality: (body.quality as number) ?? null,
      reason: (body.reason as string) ?? null,
    };
  }

  /**
   * Reconoce 1:N un frame de la cámara del Access_Point (kiosko/terminal).
   * Devuelve el veredicto de identidad + liveness; la decisión fail-secure la
   * toma el dominio (`AccessControlService.decide`). Ningún embedding viaja.
   */
  async recognize(
    imageB64: string,
    opts: { externalCameraKey?: string | null; matchThreshold?: number } = {},
  ): Promise<VisionRecognizeResult> {
    const res = await this.post('/recognize', {
      conjunto_id: this.conjuntoId(),
      image_b64: imageB64,
      ...(opts.externalCameraKey ? { external_camera_key: opts.externalCameraKey } : {}),
      ...(opts.matchThreshold != null ? { match_threshold: opts.matchThreshold } : {}),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new VisionServiceUnavailableError(`recognize status ${res.status}`);
    const livenessAvailable = body.liveness_available !== false;
    return {
      ok: Boolean(body.ok),
      face: Boolean(body.face),
      label: (body.label as string) ?? null,
      score: Number(body.score ?? 0),
      livenessScore: livenessAvailable ? Number(body.liveness_score ?? 0) : 0,
      livenessMode: livenessAvailable ? ((body.liveness_mode as string) ?? 'PASSIVE') : 'UNAVAILABLE',
      livenessAvailable,
      bbox: Array.isArray(body.bbox) ? (body.bbox as number[]) : null,
      frameWidth: body.frame_width != null ? Number(body.frame_width) : null,
      frameHeight: body.frame_height != null ? Number(body.frame_height) : null,
    };
  }

  /** Borra una plantilla concreta del Vector_Store (revocación / supresión). */
  async deleteTemplate(pointId: string): Promise<number> {
    const url = `/templates/${encodeURIComponent(pointId)}?conjunto_id=${encodeURIComponent(this.conjuntoId())}`;
    const res = await this.send('DELETE', url);
    if (!res.ok) throw new VisionServiceUnavailableError(`deleteTemplate status ${res.status}`);
    const body = (await res.json()) as { deleted?: number };
    return body.deleted ?? 0;
  }

  /**
   * Elimina por completo la colección Qdrant del tenant actual (autodestrucción
   * de una sesión de demo). Idempotente: 404 => ya no existe. Best-effort.
   */
  async dropCollection(): Promise<boolean> {
    const url = `/collections/${encodeURIComponent(this.conjuntoId())}`;
    try {
      const res = await this.send('DELETE', url);
      return res.ok || res.status === 404;
    } catch (err) {
      this.logger.warn(`dropCollection falló: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Revalida server-side un reto de liveness ACTIVO: un frame clave por acción.
   * El Vision estima pose (yaw) y liveness pasivo por frame y reporta; el
   * Backend decide. Devuelve observaciones + score pasivo del conjunto.
   */
  async activeLiveness(
    framesB64: string[],
    actions: string[],
  ): Promise<VisionActiveLivenessResult> {
    const res = await this.post(
      '/liveness/active',
      {
        conjunto_id: this.conjuntoId(),
        frames_b64: framesB64,
        actions,
      },
      this.activeLivenessTimeoutMs,
    );
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new VisionServiceUnavailableError(`liveness/active status ${res.status}`);
    const observed = Array.isArray(body.observed) ? (body.observed as Record<string, unknown>[]) : [];
    return {
      ok: Boolean(body.ok),
      observed: observed.map((o) => ({
        action: String(o.action),
        satisfied: Boolean(o.satisfied),
        yawRatio: o.yaw_ratio != null ? Number(o.yaw_ratio) : null,
        hasFace: Boolean(o.has_face),
        passiveScore: o.passive_score != null ? Number(o.passive_score) : null,
      })),
      passiveScore: Number(body.passive_score ?? 0),
      passiveAvailable: Boolean(body.passive_available),
      reason: (body.reason as string) ?? null,
      centerPassiveScore: Number(body.center_passive_score ?? 0),
      centerPassiveAvailable: Boolean(body.center_passive_available),
      identityMinSimilarity: Number(body.identity_min_similarity ?? 1),
      identityAvailable: Boolean(body.identity_available),
    };
  }

  /** Salud del Vision_Service. */
  async health(): Promise<{ ok: boolean; detail: Record<string, unknown> | null }> {
    try {
      const res = await this.send('GET', '/health');
      const body = (await res.json()) as Record<string, unknown>;
      return { ok: res.ok && body.status === 'ok', detail: body };
    } catch (err) {
      this.logger.warn(`Vision_Service no responde: ${(err as Error).message}`);
      return { ok: false, detail: null };
    }
  }

  // ── helpers de transporte ──────────────────────────────────────────
  private post(path: string, payload: unknown, timeoutMs?: number): Promise<Response> {
    return this.send('POST', path, JSON.stringify(payload), timeoutMs);
  }

  private async send(
    method: string,
    path: string,
    body?: string,
    timeoutMs?: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);
    try {
      return await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      throw new VisionServiceUnavailableError((err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }
}
