import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConsentService } from './consent.service';
import {
  AccessDecision,
  AccessReason,
  ACCESS_EVENT_DECIDED,
  AccessEventDecidedPayload,
} from './access-control.types';
import { AccessEvent } from './entities/access-event.entity';
import { AccessPoint } from './entities/access-point.entity';
import { EnrolledSubject } from './entities/enrolled-subject.entity';
import {
  AuthorizationSchedule,
  SubjectAuthorization,
} from './entities/subject-authorization.entity';
import { DOOR_CONTROLLER } from './door/door-controller.port';
import type { DoorControllerPort } from './door/door-controller.port';
import { DoorStateService } from './door/door-state.service';
import { TenantContext } from '../common/tenant/tenant-context.service';

interface DecisionOutcome {
  decision: AccessDecision;
  reason: AccessReason;
  subjectId: string | null;
}

/**
 * `AccessControlService` — corazón del control de acceso.
 *
 * Aplica la **política de dominio** con precedencia **fail-secure** y, solo si
 * concede, solicita la apertura de la puerta. Persiste un Access_Event
 * append-only y emite un evento de dominio para la UI.
 *
 * Invariante: NINGÚN camino degradado abre la puerta. Liveness bajo, identidad
 * desconocida, sin consentimiento, score bajo o falta de autorización ⇒
 * `DENIED` y `door_actuated=false`.
 */
@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(
    @InjectRepository(AccessPoint)
    private readonly accessPoints: Repository<AccessPoint>,
    @InjectRepository(SubjectAuthorization)
    private readonly authorizations: Repository<SubjectAuthorization>,
    @InjectRepository(AccessEvent)
    private readonly accessEvents: Repository<AccessEvent>,
    @InjectRepository(EnrolledSubject)
    private readonly subjects: Repository<EnrolledSubject>,
    private readonly consents: ConsentService,
    @Inject(DOOR_CONTROLLER)
    private readonly door: DoorControllerPort,
    private readonly doorState: DoorStateService,
    private readonly emitter: EventEmitter2,
    private readonly tenant: TenantContext,
  ) {}

  /**
   * Aplica `decide()` a una lectura facial, actúa la puerta solo si concede
   * (fail-secure) y persiste/emite el Access_Event. Devuelve el evento + el
   * outcome para que el kiosko muestre el veredicto al instante.
   */
  async evaluateFaceAndActuate(input: {
    ap: AccessPoint;
    label: string | null;
    matchScore: number;
    livenessScore: number;
    livenessMode?: string;
    snapshotUrl?: string | null;
    recordedAt?: Date;
    /** Prueba ofrecida al terminar el registro. No abre el torniquete ni cuenta como ingreso. */
    preview?: boolean;
  }): Promise<{ event: AccessEvent; outcome: DecisionOutcome }> {
    const outcome = await this.decide(
      input.ap,
      input.label,
      input.matchScore,
      input.livenessScore,
      input.livenessMode ?? 'PASSIVE',
    );

    const preview = input.preview === true;
    let doorActuated = false;
    if (!preview && outcome.decision === AccessDecision.GRANTED) {
      const result = await this.door.open(await this.actuatorFor(input.ap));
      doorActuated = result.actuated;
      if (doorActuated) {
        // Estado en vivo de la puerta (ABRIENDO→ABIERTA→re-bloqueo) para el kiosko.
        const subject = outcome.subjectId
          ? await this.subjects.findOne({ where: { id: outcome.subjectId, demoSessionId: this.tenant.scopeValue() } })
          : null;
        const name = subject?.fullName ?? null;
        this.doorState.pulse(input.ap.id, { openedBy: name });
        // Invitado de un pase: el rostro abre una sola vez. El siguiente reconocimiento niega.
        if (subject?.employeeCode?.startsWith('guest:')) {
          await this.authorizations.update({ subjectId: subject.id }, { validUntil: new Date() });
        }
      } else {
        this.logger.warn(
          `Acceso concedido pero el actuador no abrió (ap=${input.ap.id}): ${result.detail ?? 'sin detalle'}`,
        );
      }
    }

    const event = await this.persistAndEmit({
      accessPointId: input.ap.id,
      subjectId: outcome.subjectId,
      matchScore: input.matchScore,
      livenessScore: input.livenessScore,
      livenessMode: input.livenessMode ?? 'PASSIVE',
      decision: outcome.decision,
      reason: preview ? AccessReason.DEMO : outcome.reason,
      doorActuated,
      actorId: null,
      snapshotUrl: input.snapshotUrl ?? null,
      recordedAt: input.recordedAt ?? new Date(),
    });
    return { event, outcome };
  }

  /**
   * Política de decisión con precedencia fail-secure. El orden importa: el
   * liveness se evalúa antes que la autorización para que un intento con una
   * foto de un empleado real se deniegue como `LIVENESS_FAILED` (anti-spoofing).
   */
  async decide(
    ap: AccessPoint,
    label: string | null,
    matchScore: number,
    livenessScore: number,
    livenessMode = 'PASSIVE',
  ): Promise<DecisionOutcome> {
    const deny = (reason: AccessReason, subjectId: string | null = null): DecisionOutcome => ({
      decision: AccessDecision.DENIED,
      reason,
      subjectId,
    });

    // 1. Identidad: desconocido o por debajo del umbral de match.
    if (!label || label === 'unknown' || matchScore < Number(ap.matchThreshold)) {
      return deny(AccessReason.UNKNOWN_SUBJECT);
    }

    const subject = await this.subjects.findOne({
      where: { id: label, demoSessionId: this.tenant.scopeValue() },
    });
    if (!subject) return deny(AccessReason.UNKNOWN_SUBJECT);
    if (subject.status !== 'ACTIVE') return deny(AccessReason.NOT_AUTHORIZED, subject.id);

    // 2. Liveness (gate anti-spoofing) — antes que autorización.
    // UNAVAILABLE: el detector no está instalado. Un 0 ahí no es una foto.
    const livenessMeasured = livenessMode !== 'UNAVAILABLE';
    if (livenessMeasured && livenessScore < Number(ap.livenessThreshold)) {
      return deny(AccessReason.LIVENESS_FAILED, subject.id);
    }

    // 2b. Puntos de seguridad alta exigen reto ACTIVO (parpadeo/giro).
    if (livenessMeasured && ap.securityLevel === 'HIGH' && livenessMode !== 'ACTIVE') {
      return deny(AccessReason.CHALLENGE_REQUIRED, subject.id);
    }

    // 3. Consentimiento vigente (defensivo; sin él no debería haber plantilla).
    const consented = await this.consents.hasActiveConsent(subject.id);
    if (!consented) return deny(AccessReason.NO_CONSENT, subject.id);

    // 4. Autorización en este punto.
    const auth = await this.authorizations.findOne({
      where: { subjectId: subject.id, accessPointId: ap.id },
    });
    if (!auth) return deny(AccessReason.NOT_AUTHORIZED, subject.id);

    const until = auth.validUntil ? new Date(auth.validUntil).getTime() : 0;
    if (!until || until <= Date.now()) {
      return deny(AccessReason.MEMBERSHIP_EXPIRED, subject.id);
    }

    // 5. Franja horaria.
    if (!this.isWithinSchedule(auth.schedule, new Date())) {
      return deny(AccessReason.OUT_OF_SCHEDULE, subject.id);
    }

    return { decision: AccessDecision.GRANTED, reason: AccessReason.MATCHED, subjectId: subject.id };
  }

  /**
   * La tablet reconoce en «Entrada principal», que no tiene relé.
   * Si solo hay un torniquete cableado, la concesión lo usa.
   * Con dos o más relés no se adivina cuál abrir.
   */
  private async actuatorFor(ap: AccessPoint): Promise<AccessPoint> {
    const kind = (ap.controllerKind ?? 'NONE').toUpperCase();
    if (kind !== 'NONE' && ap.controllerRef) return ap;
    const points = await this.accessPoints.find({ where: { demoSessionId: this.tenant.scopeValue() } });
    const wired = points.filter((p) => {
      const k = (p.controllerKind ?? 'NONE').toUpperCase();
      return k !== 'NONE' && Boolean(p.controllerRef);
    });
    if (wired.length === 1) {
      this.logger.log(`La puerta «${ap.name}» no tiene actuador. La apertura sale por «${wired[0].name}».`);
      return wired[0];
    }
    return ap;
  }

  /** Hora de Bogotá. El servidor corre en UTC; el horario del plan no. */
  private bogotaClock(when: Date): { day: number; minutes: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(when);
    const value = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const hour = Number(value('hour')) % 24;
    return { day: days[value('weekday')] ?? 0, minutes: hour * 60 + Number(value('minute') || 0) };
  }

  /** `null`/sin ventana => 24/7. Evalúa día y rango "HH:mm" en Bogotá. */
  isWithinSchedule(schedule: AuthorizationSchedule | null, when: Date): boolean {
    if (!schedule) return true;
    const clock = this.bogotaClock(when);
    if (schedule.days && schedule.days.length > 0 && !schedule.days.includes(clock.day)) {
      return false;
    }
    if (schedule.from && schedule.to) {
      const [fh, fm] = schedule.from.split(':').map(Number);
      const [th, tm] = schedule.to.split(':').map(Number);
      const from = fh * 60 + fm;
      const to = th * 60 + tm;
      if (clock.minutes < from || clock.minutes > to) return false;
    }
    return true;
  }

  async getEvent(accessEventId: string): Promise<AccessEvent | null> {
    return this.accessEvents.findOne({
      where: { id: accessEventId, demoSessionId: this.tenant.scopeValue() },
    });
  }

    /** Apertura manual por un operador tras una denegación (auditada). */
  async manualOpen(accessEventId: string, actorId: string): Promise<AccessEvent> {
    const denied = await this.accessEvents.findOne({
      where: { id: accessEventId, demoSessionId: this.tenant.scopeValue() },
    });
    if (!denied) throw new NotFoundException('access_event_not_found');

    const ap = await this.accessPoints.findOne({
      where: { id: denied.accessPointId, demoSessionId: this.tenant.scopeValue() },
    });
    if (!ap) throw new NotFoundException('access_point_not_found');

    const result = await this.door.open(await this.actuatorFor(ap));
    if (result.actuated) this.doorState.pulse(ap.id, { openedBy: 'Operador (apertura manual)' });
    return this.persistAndEmit({
      accessPointId: ap.id,
      subjectId: denied.subjectId,
      matchScore: null,
      livenessScore: null,
      livenessMode: null,
      decision: AccessDecision.GRANTED,
      reason: AccessReason.MANUAL,
      doorActuated: result.actuated,
      actorId,
      snapshotUrl: denied.snapshotUrl,
      recordedAt: new Date(),
    });
  }

  /** Apertura de prueba directa (admin) — valida el actuador y anima la puerta. */
  async testOpenDoor(
    accessPointId: string,
    actorId: string,
  ): Promise<{ actuated: boolean; status: ReturnType<DoorStateService['getStatus']> }> {
    const ap = await this.accessPoints.findOne({
      where: { id: accessPointId, demoSessionId: this.tenant.scopeValue() },
    });
    if (!ap) throw new NotFoundException('access_point_not_found');
    const result = await this.door.open(await this.actuatorFor(ap));
    if (result.actuated) this.doorState.pulse(ap.id, { openedBy: 'Prueba (admin)' });
    await this.persistAndEmit({
      accessPointId: ap.id,
      subjectId: null,
      matchScore: null,
      livenessScore: null,
      livenessMode: null,
      decision: result.actuated ? AccessDecision.GRANTED : AccessDecision.DENIED,
      reason: AccessReason.MANUAL,
      doorActuated: result.actuated,
      actorId,
      snapshotUrl: null,
      recordedAt: new Date(),
    });
    return { actuated: result.actuated, status: this.doorState.getStatus(ap.id) };
  }

  /** Estado en vivo de la puerta para el kiosko/admin. */
  doorStatus(accessPointId: string): ReturnType<DoorStateService['getStatus']> {
    return this.doorState.getStatus(accessPointId);
  }

  /** Ping trivial a la base de datos para el panel de diagnóstico. */
  async pingDb(): Promise<{ ok: boolean }> {
    try {
      await this.accessEvents.count();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  /** Feed/histórico de eventos de acceso, paginado. */
  listEvents(
    filters: { accessPointId?: string; decision?: string; subjectId?: string; limit?: number } = {},
  ): Promise<AccessEvent[]> {
    const where: Record<string, unknown> = { demoSessionId: this.tenant.scopeValue() };
    if (filters.accessPointId) where.accessPointId = filters.accessPointId;
    if (filters.decision) where.decision = filters.decision;
    const subjectId = String(filters.subjectId || '');
    if (subjectId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subjectId)) {
        return Promise.resolve([]);
      }
      where.subjectId = subjectId;
    }
    const asked = Number.isFinite(filters.limit) ? Number(filters.limit) : 50;
    const cap = 2000;
    return this.accessEvents.find({
      where,
      order: { recordedAt: 'DESC' },
      take: Math.min(Math.max(asked, 1), cap),
    });
  }

  // ── helpers ──────────────────────────────────────────────────────────
  private async persistAndEmit(data: {
    accessPointId: string;
    subjectId: string | null;
    matchScore: number | null;
    livenessScore: number | null;
    livenessMode: string | null;
    decision: AccessDecision;
    reason: AccessReason;
    doorActuated: boolean;
    actorId: string | null;
    snapshotUrl: string | null;
    recordedAt: Date;
  }): Promise<AccessEvent> {
    const row = this.accessEvents.create({
      accessPointId: data.accessPointId,
      subjectId: data.subjectId,
      demoSessionId: this.tenant.demoSessionId(),
      matchScore: data.matchScore,
      livenessScore: data.livenessScore,
      livenessMode: data.livenessMode,
      decision: data.decision,
      reason: data.reason,
      doorActuated: data.doorActuated,
      actorId: data.actorId,
      snapshotUrl: data.snapshotUrl,
      recordedAt: data.recordedAt,
    });
    const saved = await this.accessEvents.save(row);

    const payload: AccessEventDecidedPayload = {
      accessEventId: saved.id,
      accessPointId: saved.accessPointId,
      subjectId: saved.subjectId,
      decision: data.decision,
      reason: data.reason,
      doorActuated: data.doorActuated,
      snapshotUrl: saved.snapshotUrl,
      recordedAt: saved.recordedAt,
    };
    this.emitter.emit(ACCESS_EVENT_DECIDED, payload);
    return saved;
  }
}
