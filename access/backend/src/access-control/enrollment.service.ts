import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConsentService } from './consent.service';
import { AccessPointsService } from './access-points.service';
import { AccessEvent } from './entities/access-event.entity';
import { EnrolledSubject } from './entities/enrolled-subject.entity';
import { FaceTemplate } from './entities/face-template.entity';
import { VisionServiceClient } from './vision-service.client';
import { TenantContext } from '../common/tenant/tenant-context.service';

export interface CreateSubjectInput {
  fullName: string;
  kind?: string; // EMPLOYEE | CONTRACTOR | STAFF
  employeeCode?: string | null;
}

export interface UpdateSubjectInput {
  fullName?: string;
  employeeCode?: string | null;
  status?: string; // ACTIVE | DISABLED
}

/**
 * `EnrollmentService` — alta/baja de empleados y enrolamiento facial.
 *
 * Reglas:
 * - El enrolamiento exige un Biometric_Consent `ACTIVE` previo: sin
 *   consentimiento NO se envía la imagen al Vision_Service.
 * - Solo se persisten metadatos + `vectorPointId`; el embedding nunca toca
 *   Postgres.
 * - Un rechazo de calidad del Vision (`NO_FACE`/`MULTIPLE_FACES`/`LOW_QUALITY`/
 *   `SPOOF_SUSPECTED`) se traduce en 400 sin crear plantilla.
 */
@Injectable()
export class EnrollmentService implements OnModuleInit {
  private readonly logger = new Logger(EnrollmentService.name);
  private readonly dedupCheck: boolean;
  private readonly dedupThreshold: number;

  constructor(
    @InjectRepository(EnrolledSubject)
    private readonly subjects: Repository<EnrolledSubject>,
    @InjectRepository(FaceTemplate)
    private readonly templates: Repository<FaceTemplate>,
    @InjectRepository(AccessEvent)
    private readonly accessEvents: Repository<AccessEvent>,
    private readonly consents: ConsentService,
    private readonly vision: VisionServiceClient,
    private readonly accessPoints: AccessPointsService,
    private readonly tenant: TenantContext,
    config: ConfigService,
  ) {
    // Anti-duplicados: impide que un mismo rostro se registre en 2+ identidades.
    this.dedupCheck = config.get<string>('ENROLL_DEDUP_CHECK', 'true') !== 'false';
    this.dedupThreshold = config.get<number>('ENROLL_DEDUP_THRESHOLD', 0.6);
  }

  async onModuleInit(): Promise<void> {
    try {
      const n = await this.pruneAllToSingleTemplate();
      if (n > 0) this.logger.log(`Plantillas extra eliminadas al arrancar: ${n}`);
    } catch (e) {
      this.logger.warn(`No se pudo unificar plantillas al arrancar: ${(e as Error).message}`);
    }
  }

  /**
   * La ficha del gimnasio y la identidad de la puerta deben ser el mismo id.
   * Si la fila se perdió (base recreada, alta vieja), se vuelve a crear con
   * ese id y con consentimiento, para que el enlace ya enviado sirva.
   */
  async ensureSubject(
    input: { id: string; fullName: string; employeeCode?: string | null },
    actorId: string,
  ): Promise<EnrolledSubject> {
    const fullName = input.fullName.trim().slice(0, 160);
    const employeeCode = input.employeeCode?.trim().slice(0, 64) || null;
    let subject = await this.subjects.findOne({ where: { id: input.id } });
    if (!subject) {
      await this.subjects.query(
        `INSERT INTO enrolled_subjects (id, full_name, kind, employee_code, status, demo_session_id, created_at, updated_at)
         VALUES ($1, $2, 'EMPLOYEE', $3, 'ACTIVE', NULL, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [input.id, fullName, employeeCode],
      );
      subject = await this.subjects.findOne({ where: { id: input.id } });
      if (!subject) throw new NotFoundException('enrolled_subject_not_found');
      this.logger.log(`Identidad de puerta restaurada subject=${subject.id}`);
    } else {
      let dirty = false;
      if (fullName && subject.fullName !== fullName) {
        subject.fullName = fullName;
        dirty = true;
      }
      if (employeeCode && subject.employeeCode !== employeeCode) {
        subject.employeeCode = employeeCode;
        dirty = true;
      }
      if (subject.demoSessionId && !this.tenant.isDemo()) {
        subject.demoSessionId = null;
        dirty = true;
      }
      if (dirty) subject = await this.subjects.save(subject);
    }
    if (!(await this.consents.hasActiveConsent(subject.id))) {
      await this.consents.grant(
        subject.id,
        { purpose: 'Control de acceso facial — gimnasio', policyVersion: '1.0' },
        actorId,
      );
    }
    return subject;
  }

  async createSubject(input: CreateSubjectInput): Promise<EnrolledSubject> {
    const subject = this.subjects.create({
      fullName: input.fullName,
      kind: input.kind ?? 'EMPLOYEE',
      employeeCode: input.employeeCode ?? null,
      status: 'ACTIVE',
      demoSessionId: this.tenant.demoSessionId(),
    });
    return this.subjects.save(subject);
  }

  listSubjects(): Promise<EnrolledSubject[]> {
    return this.subjects.find({
      where: { demoSessionId: this.tenant.scopeValue() },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Lista de empleados con su estado operativo para la consola: biometría
   * registrada, consentimiento vigente y último acceso concedido. Pensado para
   * que el administrador vea de un vistazo "quién puede entrar".
   */
  async listSubjectsDetailed(): Promise<
    Array<
      EnrolledSubject & {
        hasBiometrics: boolean;
        templateCount: number;
        hasPortrait: boolean;
        hasConsent: boolean;
        lastAccessAt: Date | null;
      }
    >
  > {
    const subjects = await this.subjects.find({
      where: { demoSessionId: this.tenant.scopeValue() },
      order: { createdAt: 'DESC' },
    });
    const photoIds = await this.portraitIdSet(subjects.map((s) => s.id));
    return Promise.all(
      subjects.map(async (s) => {
        const [templateCount, hasConsent, lastEvent] = await Promise.all([
          this.templates.count({ where: { subjectId: s.id } }),
          this.consents.hasActiveConsent(s.id),
          this.accessEvents.findOne({
            where: { subjectId: s.id, decision: 'GRANTED' },
            order: { recordedAt: 'DESC' },
          }),
        ]);
        return {
          ...s,
          hasBiometrics: templateCount > 0,
          templateCount,
          hasPortrait: photoIds.has(s.id),
          hasConsent,
          lastAccessAt: lastEvent?.recordedAt ?? null,
        };
      }),
    );
  }

  async getSubject(subjectId: string): Promise<EnrolledSubject> {
    const subject = await this.subjects.findOne({
      where: { id: subjectId, demoSessionId: this.tenant.scopeValue() },
    });
    if (!subject) throw new NotFoundException('enrolled_subject_not_found');
    return subject;
  }

  async updateSubject(subjectId: string, input: UpdateSubjectInput): Promise<EnrolledSubject> {
    const subject = await this.getSubject(subjectId);
    if (input.fullName !== undefined) subject.fullName = input.fullName;
    if (input.employeeCode !== undefined) subject.employeeCode = input.employeeCode;
    if (input.status !== undefined) subject.status = input.status;
    return this.subjects.save(subject);
  }

  async hasBiometrics(subjectId: string): Promise<boolean> {
    const n = await this.templates.count({ where: { subjectId } });
    return n > 0;
  }

  /**
   * Un socio con plantilla Y foto de ficha no vuelve a capturar. Si hay
   * plantillas viejas sin retrato (enrolamientos previos), se permite una
   * recaptura para guardar el frame frontal.
   */
  async assertCanEnroll(subjectId: string): Promise<void> {
    await this.getSubject(subjectId);
    if ((await this.hasBiometrics(subjectId)) && (await this.hasPortrait(subjectId))) {
      throw new ConflictException({
        code: 'already_enrolled',
        reason: 'already_enrolled',
        message: 'Este acceso ya tiene un rostro registrado. No hace falta volver a enrolar.',
      });
    }
  }

  async hasPortrait(subjectId: string): Promise<boolean> {
    const rows: Array<{ ok: number | boolean }> = await this.subjects.query(
      `SELECT 1 AS ok FROM enrolled_subjects WHERE id = $1 AND portrait_jpeg IS NOT NULL LIMIT 1`,
      [subjectId],
    );
    return rows.length > 0;
  }

  async getPortrait(subjectId: string): Promise<Buffer | null> {
    await this.getSubject(subjectId);
    const rows: Array<{ portrait_jpeg: Buffer | Uint8Array | null }> = await this.subjects.query(
      `SELECT portrait_jpeg FROM enrolled_subjects WHERE id = $1 LIMIT 1`,
      [subjectId],
    );
    const raw = rows[0]?.portrait_jpeg;
    if (!raw) return null;
    return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  }

  // ── Enrolamiento ─────────────────────────────────────────────────────
  async enroll(subjectId: string, imageB64: string): Promise<FaceTemplate> {
    await this.assertCanEnroll(subjectId);

    const consented = await this.consents.hasActiveConsent(subjectId);
    if (!consented) throw new ForbiddenException('no_active_consent');

    // Anti-duplicados: un mismo rostro no puede pertenecer a dos identidades.
    // Si el rostro ya coincide con OTRO sujeto por encima del umbral, se rechaza
    // (evita que el kiosko "dude" entre identidades clonadas).
    if (this.dedupCheck) {
      try {
        const rec = await this.vision.recognize(imageB64, { matchThreshold: this.dedupThreshold });
        if (
          rec.face &&
          rec.label &&
          rec.label !== 'unknown' &&
          rec.label !== subjectId &&
          rec.score >= this.dedupThreshold
        ) {
          const other = await this.subjects.findOne({ where: { id: rec.label } });
          this.logger.warn(
            `Enrolamiento RECHAZADO por duplicado: rostro de subject=${subjectId} coincide con ${rec.label} (score=${rec.score})`,
          );
          throw new ConflictException({
            code: 'face_already_enrolled',
            reason: 'face_already_enrolled',
            message: other
              ? `Este rostro ya está registrado como "${other.fullName}". Una persona solo puede tener una identidad.`
              : 'Este rostro ya está registrado en otra identidad.',
          });
        }
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        // Si el chequeo falla por otra causa (vision caído), no bloquea el alta.
        this.logger.warn(`Chequeo anti-duplicados omitido: ${(e as Error).message}`);
      }
    }

    // Una sola plantilla por socio: borra vectores previos antes de enrolar.
    await this.replaceTemplates(subjectId);

    const result = await this.vision.enroll(subjectId, imageB64);
    if (!result.ok || !result.vectorPointId) {
      throw new BadRequestException({
        code: 'enrollment_rejected',
        reason: result.reason ?? 'UNKNOWN',
      });
    }

    const template = this.templates.create({
      subjectId,
      vectorPointId: result.vectorPointId,
      model: result.model ?? 'ARCFACE',
      dim: result.dim ?? 512,
      quality: result.quality ?? null,
    });
    const saved = await this.templates.save(template);
    await this.savePortrait(subjectId, imageB64);
    this.logger.log(`Plantilla enrolada (subject=${subjectId}, point=${saved.vectorPointId})`);

    // Puerta única: un empleado enrolado queda habilitado automáticamente en las
    // puertas (sin paso manual). Configurable con AUTO_AUTHORIZE_ENROLLED=false.
    await this.accessPoints.authorizeSubjectEverywhere(subjectId);
    return saved;
  }

  listTemplates(subjectId: string): Promise<FaceTemplate[]> {
    return this.templates.find({ where: { subjectId } });
  }

  /** Borra una plantilla concreta (vector + metadatos), validando pertenencia. */
  async deleteTemplate(subjectId: string, templateId: string): Promise<void> {
    const template = await this.templates.findOne({ where: { id: templateId, subjectId } });
    if (!template) throw new NotFoundException('face_template_not_found');
    await this.vision.deleteTemplate(template.vectorPointId);
    await this.templates.delete({ id: templateId });
  }

  /** Derecho de supresión: borra toda la biometría del sujeto y lo deshabilita. */
  async eraseBiometrics(subjectId: string): Promise<{ deletedTemplates: number }> {
    await this.getSubject(subjectId);
    const { deletedTemplates } = await this.consents.revoke(subjectId);
    await this.subjects.query(
      `UPDATE enrolled_subjects SET status = 'DISABLED', portrait_jpeg = NULL WHERE id = $1`,
      [subjectId],
    );
    return { deletedTemplates };
  }

  /** JPEG del frame LOOK_CENTER (la misma imagen que genera el embedding). */
  private async savePortrait(subjectId: string, imageB64: string): Promise<void> {
    const raw = imageB64.includes(',') ? imageB64.split(',')[1] : imageB64;
    let buf: Buffer;
    try {
      buf = Buffer.from(raw, 'base64');
    } catch {
      this.logger.warn(`Retrato inválido subject=${subjectId}`);
      return;
    }
    if (buf.length < 400 || buf.length > 2_500_000) {
      this.logger.warn(`Retrato fuera de rango subject=${subjectId} bytes=${buf.length}`);
      return;
    }
    await this.subjects.query(`UPDATE enrolled_subjects SET portrait_jpeg = $1 WHERE id = $2`, [
      buf,
      subjectId,
    ]);
  }

  private async replaceTemplates(subjectId: string): Promise<void> {
    const existing = await this.templates.find({ where: { subjectId } });
    for (const t of existing) {
      try {
        await this.vision.deleteTemplate(t.vectorPointId);
      } catch (e) {
        this.logger.warn(`No se pudo borrar vector ${t.vectorPointId}: ${(e as Error).message}`);
      }
    }
    if (existing.length > 0) await this.templates.delete({ subjectId });
  }

  private async pruneAllToSingleTemplate(): Promise<number> {
    const grouped: Array<{ subjectId: string; n: string }> = await this.templates
      .createQueryBuilder('t')
      .select('t.subject_id', 'subjectId')
      .addSelect('COUNT(*)', 'n')
      .groupBy('t.subject_id')
      .having('COUNT(*) > 1')
      .getRawMany();
    let deleted = 0;
    for (const row of grouped) {
      deleted += await this.pruneToSingleTemplate(row.subjectId);
    }
    return deleted;
  }

  private async pruneToSingleTemplate(subjectId: string): Promise<number> {
    const all = await this.templates.find({
      where: { subjectId },
      order: { createdAt: 'DESC' },
    });
    let deleted = 0;
    for (const t of all.slice(1)) {
      try {
        await this.vision.deleteTemplate(t.vectorPointId);
      } catch (e) {
        this.logger.warn(`No se pudo borrar vector extra ${t.vectorPointId}: ${(e as Error).message}`);
      }
      await this.templates.delete({ id: t.id });
      deleted += 1;
    }
    return deleted;
  }

  private async portraitIdSet(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows: Array<{ id: string }> = await this.subjects.query(
      `SELECT id FROM enrolled_subjects WHERE portrait_jpeg IS NOT NULL AND id = ANY($1::uuid[])`,
      [ids],
    );
    return new Set(rows.map((r) => r.id));
  }
}
