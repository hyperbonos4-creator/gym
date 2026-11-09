import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { KioskPairingService } from '../kiosk-pairing.service';

/**
 * JWT purpose=kiosk: solo reconocimiento/estado/eventos de SU access_point.
 * Nada de admin, otras sedes, sujetos, puntos ajenos ni diagnosticos.
 */
@Injectable()
export class KioskScopeGuard implements CanActivate {
  constructor(private readonly pairing: KioskPairingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const purpose = req.user?.tokenPurpose as string | undefined;
    if (purpose !== 'kiosk') return true;

    const deviceId = req.user?.kioskDeviceId as string | undefined;
    const accessPointId = req.user?.kioskAccessPointId as string | undefined;
    const gymId = req.user?.kioskGymId as string | undefined;
    const jti = req.user?.jti as string | undefined;
    if (!deviceId || !accessPointId || !gymId || !jti) {
      throw new ForbiddenException('kiosk_scope_incomplete');
    }

    try {
      await this.pairing.assertActiveDevice(deviceId, jti);
    } catch {
      throw new UnauthorizedException('dispositivo_revocado');
    }

    void this.pairing.touchLastSeen(deviceId).catch(() => undefined);

    const method = String(req.method || 'GET').toUpperCase();
    const url = String(req.originalUrl || req.url || '').split('?')[0];

    const ownPoint = (suffix: string) =>
      url === `/api/v1/access/points/${accessPointId}${suffix}` ||
      url.endsWith(`/access/points/${accessPointId}${suffix}`);

    if (method === 'GET' && (url.endsWith('/access/points') || url === '/api/v1/access/points')) {
      return true;
    }

    if (method === 'POST' && (ownPoint('/recognize') || ownPoint('/recognize-image'))) {
      return true;
    }

    if (method === 'GET' && (ownPoint('/snapshot') || ownPoint('/stream-token') || ownPoint('/door-status'))) {
      return true;
    }

    if (method === 'GET' && (url.endsWith('/access/events') || url === '/api/v1/access/events')) {
      const qPoint = String(req.query?.accessPointId || '');
      if (qPoint && qPoint !== accessPointId) throw new ForbiddenException('kiosk_scope_point');
      req.query = { ...(req.query || {}), accessPointId };
      return true;
    }

    if (method === 'POST' && /\/access\/events\/[^/]+\/manual-open$/.test(url)) {
      return true;
    }

    if (method === 'GET' && (url.endsWith('/auth/me') || url === '/api/v1/auth/me')) {
      return true;
    }

    if (method === 'POST' && /\/access\/kiosk\/devices\/[^/]+\/heartbeat$/.test(url)) {
      return true;
    }

    throw new ForbiddenException('kiosk_scope');
  }
}
