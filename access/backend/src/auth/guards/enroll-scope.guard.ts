import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Un JWT con purpose=enroll solo puede preparar el rostro de SU sujeto.
 * No lista cámaras, no emite otro token, no toca puertas ni otras fichas.
 * El registro del celular usa: confirmar la ficha, leerla, pedir el reto y enviarlo.
 */
@Injectable()
export class EnrollScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const enrollSubjectId = req.user?.enrollSubjectId as string | undefined;
    const purpose = req.user?.tokenPurpose as string | undefined;
    if (purpose !== 'enroll' || !enrollSubjectId) return true;

    const method = String(req.method || 'GET').toUpperCase();
    const url = String(req.originalUrl || req.url || '').split('?')[0];

    if (method === 'POST' && /\/subjects\/ensure$/.test(url)) {
      if (String(req.body?.id || '') !== enrollSubjectId) {
        throw new ForbiddenException('enroll_scope_subject');
      }
      return true;
    }

    const own = (suffix: string) => url.endsWith(`/subjects/${enrollSubjectId}${suffix}`);
    if (method === 'GET' && (own('') || own('/templates') || own('/portrait'))) return true;
    if (method === 'POST' && (own('/liveness/challenge') || own('/liveness/enroll') || own('/consent'))) {
      return true;
    }

    throw new ForbiddenException('enroll_scope');
  }
}
