import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';

import { User, UserRole } from '../auth/entities/user.entity';
import { AccessPoint } from './entities/access-point.entity';
import { KioskDevice } from './entities/kiosk-device.entity';
import { KioskPairingCode } from './entities/kiosk-pairing-code.entity';
import { TenantContext } from '../common/tenant/tenant-context.service';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 8;
const PAIR_WINDOW_MS = 60_000;
const PAIR_MAX_PER_IP = 20;

type RateBucket = { count: number; resetAt: number };

export type KioskDeviceView = {
  id: string;
  name: string;
  gymId: string;
  accessPointId: string;
  createdAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
};

@Injectable()
export class KioskPairingService {
  private readonly pairBuckets = new Map<string, RateBucket>();

  constructor(
    @InjectRepository(KioskPairingCode)
    private readonly codes: Repository<KioskPairingCode>,
    @InjectRepository(KioskDevice)
    private readonly devices: Repository<KioskDevice>,
    @InjectRepository(AccessPoint)
    private readonly points: Repository<AccessPoint>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tenant: TenantContext,
  ) {}

  private pepper(): string {
    return (
      this.config.get<string>('KIOSK_PAIRING_PEPPER') ||
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      'kiosk-pairing-dev-pepper'
    );
  }

  hashCode(code: string): string {
    return createHash('sha256').update(`${this.pepper()}:${code.trim()}`).digest('hex');
  }

  private safeEqualHex(a: string, b: string): boolean {
    try {
      const ba = Buffer.from(a, 'hex');
      const bb = Buffer.from(b, 'hex');
      if (ba.length !== bb.length) return false;
      return timingSafeEqual(ba, bb);
    } catch {
      return false;
    }
  }

  private rateLimit(ip: string): void {
    const key = `pair:${ip || 'unknown'}`;
    const now = Date.now();
    const cur = this.pairBuckets.get(key);
    if (!cur || cur.resetAt <= now) {
      this.pairBuckets.set(key, { count: 1, resetAt: now + PAIR_WINDOW_MS });
      return;
    }
    if (cur.count >= PAIR_MAX_PER_IP) {
      throw new HttpException('pairing_rate_limited', HttpStatus.TOO_MANY_REQUESTS);
    }
    cur.count += 1;
  }

  async createPairingCode(input: {
    gymId: string;
    accessPointId: string;
    deviceName?: string;
    createdBy?: string | null;
  }): Promise<{ code: string; expiresAt: string; gymId: string; accessPointId: string; deviceName: string }> {
    const gymId = String(input.gymId || '').trim();
    const accessPointId = String(input.accessPointId || '').trim();
    const deviceName = String(input.deviceName || 'Kiosko').trim().slice(0, 120) || 'Kiosko';
    if (!gymId || gymId.length > 64) throw new BadRequestException('gymId_invalido');
    if (!accessPointId) throw new BadRequestException('accessPointId_requerido');

    const point = await this.points.findOne({
      where: { id: accessPointId, demoSessionId: this.tenant.scopeValue() },
    });
    if (!point || point.status !== 'ACTIVE') throw new BadRequestException('punto_invalido');

    // Invalida codigos previos vivos de la misma sede+punto.
    await this.codes.update(
      {
        gymId,
        accessPointId,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      { usedAt: new Date() },
    );

    let code = '';
    let codeHash = '';
    for (let i = 0; i < 12; i++) {
      code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      codeHash = this.hashCode(code);
      const clash = await this.codes.findOne({ where: { codeHash } });
      if (!clash) break;
      code = '';
    }
    if (!code) throw new BadRequestException('no_se_pudo_generar_codigo');

    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await this.codes.save(
      this.codes.create({
        codeHash,
        gymId,
        accessPointId,
        deviceName,
        createdBy: input.createdBy ?? null,
        expiresAt,
        usedAt: null,
        attemptCount: 0,
      }),
    );

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      gymId,
      accessPointId,
      deviceName,
    };
  }

  async redeemCode(
    rawCode: string,
    opts: { deviceName?: string; ip?: string } = {},
  ): Promise<{ token: string; device: KioskDeviceView; accessPointId: string; gymId: string }> {
    this.rateLimit(opts.ip || 'unknown');

    const digits = String(rawCode || '').replace(/\D/g, '');
    if (digits.length !== 6) throw new UnauthorizedException('codigo_invalido');

    const codeHash = this.hashCode(digits);
    const row = await this.codes.findOne({ where: { codeHash } });
    if (!row) throw new UnauthorizedException('codigo_invalido');

    if (row.usedAt) throw new UnauthorizedException('codigo_usado');
    if (row.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('codigo_expirado');
    if (row.attemptCount >= MAX_CODE_ATTEMPTS) throw new HttpException('codigo_bloqueado', HttpStatus.TOO_MANY_REQUESTS);

    // Defensa en profundidad: re-hash timing-safe (aunque la busqueda ya uso el hash).
    if (!this.safeEqualHex(row.codeHash, codeHash)) {
      row.attemptCount += 1;
      await this.codes.save(row);
      throw new UnauthorizedException('codigo_invalido');
    }

    const point = await this.points.findOne({ where: { id: row.accessPointId } });
    if (!point || point.status !== 'ACTIVE') throw new UnauthorizedException('punto_invalido');

    const issuer =
      (row.createdBy &&
        (await this.users.findOne({ where: { id: row.createdBy, isActive: true } }))) ||
      (await this.users.findOne({
        where: { role: UserRole.ADMIN, isActive: true, demoSessionId: IsNull() },
        order: { createdAt: 'ASC' },
      }));
    if (!issuer) throw new UnauthorizedException('sin_emisor');

    const jti = randomBytes(16).toString('hex');
    const name = String(opts.deviceName || row.deviceName || 'Kiosko').trim().slice(0, 120) || 'Kiosko';

    const device = await this.devices.save(
      this.devices.create({
        name,
        gymId: row.gymId,
        accessPointId: row.accessPointId,
        tokenJti: jti,
        createdBy: issuer.id,
        lastSeenAt: new Date(),
        revokedAt: null,
      }),
    );

    row.usedAt = new Date();
    await this.codes.save(row);

    const expiresIn = this.config.get<string>('KIOSK_DEVICE_TTL', '365d');
    const token = this.jwt.sign(
      {
        sub: issuer.id,
        email: issuer.email,
        role: UserRole.OPERATOR,
        purpose: 'kiosk',
        deviceId: device.id,
        gymId: device.gymId,
        accessPointId: device.accessPointId,
        jti,
      },
      { expiresIn } as JwtSignOptions,
    );

    return {
      token,
      device: this.toView(device),
      accessPointId: device.accessPointId,
      gymId: device.gymId,
    };
  }

  async listDevices(gymId?: string): Promise<KioskDeviceView[]> {
    const where: { gymId?: string; revokedAt: ReturnType<typeof IsNull> } = { revokedAt: IsNull() };
    if (gymId) where.gymId = gymId;
    const rows = await this.devices.find({ where, order: { createdAt: 'DESC' } });
    return rows.map((d) => this.toView(d));
  }

  async listDevicesIncludingRevoked(gymId: string): Promise<KioskDeviceView[]> {
    const rows = await this.devices.find({
      where: { gymId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return rows.map((d) => this.toView(d));
  }

  async revokeDevice(id: string, gymId?: string): Promise<KioskDeviceView> {
    const device = await this.devices.findOne({ where: { id } });
    if (!device) throw new BadRequestException('dispositivo_no_encontrado');
    if (gymId && device.gymId !== gymId) throw new ForbiddenException('gym_prohibido');
    if (!device.revokedAt) {
      device.revokedAt = new Date();
      await this.devices.save(device);
    }
    return this.toView(device);
  }

  async touchLastSeen(deviceId: string): Promise<void> {
    await this.devices.update({ id: deviceId, revokedAt: IsNull() }, { lastSeenAt: new Date() });
  }

  async assertActiveDevice(deviceId: string, jti: string): Promise<KioskDevice> {
    const device = await this.devices.findOne({ where: { id: deviceId } });
    if (!device || device.revokedAt) throw new UnauthorizedException('dispositivo_revocado');
    if (device.tokenJti !== jti) throw new UnauthorizedException('dispositivo_revocado');
    return device;
  }

  private toView(d: KioskDevice): KioskDeviceView {
    return {
      id: d.id,
      name: d.name,
      gymId: d.gymId,
      accessPointId: d.accessPointId,
      createdAt: d.createdAt.toISOString(),
      lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
      revokedAt: d.revokedAt ? d.revokedAt.toISOString() : null,
    };
  }
}
