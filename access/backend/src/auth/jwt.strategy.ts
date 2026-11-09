import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';

import { getJwtAccessSecret } from '../config/jwt.config';
import { User, UserRole } from './entities/user.entity';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  purpose?: string;
  enrollSubjectId?: string;
  deviceId?: string;
  gymId?: string;
  accessPointId?: string;
  jti?: string;
}

/**
 * Estrategia JWT: valida el access token y resuelve el `User` activo.
 * Soporta tokens de enrolamiento acotados (purpose=enroll).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtAccessSecret(config),
    });
  }

  async validate(payload: JwtPayload): Promise<User & { enrollSubjectId?: string; tokenPurpose?: string; jti?: string; kioskDeviceId?: string; kioskGymId?: string; kioskAccessPointId?: string }> {
    const user = await this.users.findOne({ where: { id: payload.sub, isActive: true } });
    if (!user) throw new UnauthorizedException('usuario_invalido');
    const enriched = user as User & { enrollSubjectId?: string; tokenPurpose?: string; jti?: string; kioskDeviceId?: string; kioskGymId?: string; kioskAccessPointId?: string };
    if (payload.purpose === 'enroll' && payload.enrollSubjectId) {
      enriched.enrollSubjectId = payload.enrollSubjectId;
      enriched.tokenPurpose = 'enroll';
      enriched.jti = payload.jti;
    }
    if (payload.purpose === 'kiosk' && payload.deviceId && payload.accessPointId && payload.gymId && payload.jti) {
      // Nunca heredar privilegios ADMIN del emisor: el kiosko es OPERATOR acotado.
      enriched.role = UserRole.OPERATOR;
      enriched.tokenPurpose = 'kiosk';
      enriched.kioskDeviceId = payload.deviceId;
      enriched.kioskGymId = payload.gymId;
      enriched.kioskAccessPointId = payload.accessPointId;
      enriched.jti = payload.jti;
    }
    return enriched;
  }
}
