import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';

import { getJwtAccessSecret } from '../config/jwt.config';
import { User } from './entities/user.entity';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  purpose?: string;
  enrollSubjectId?: string;
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

  async validate(payload: JwtPayload): Promise<User & { enrollSubjectId?: string; tokenPurpose?: string; jti?: string }> {
    const user = await this.users.findOne({ where: { id: payload.sub, isActive: true } });
    if (!user) throw new UnauthorizedException('usuario_invalido');
    const enriched = user as User & { enrollSubjectId?: string; tokenPurpose?: string; jti?: string };
    if (payload.purpose === 'enroll' && payload.enrollSubjectId) {
      enriched.enrollSubjectId = payload.enrollSubjectId;
      enriched.tokenPurpose = 'enroll';
      enriched.jti = payload.jti;
    }
    return enriched;
  }
}
