import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Si el JWT trae purpose=enroll + enrollSubjectId, solo permite operar sobre ese sujeto
 * y bloquea rutas administrativas peligrosas.
 */
@Injectable()
export class EnrollScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const enrollSubjectId = req.user?.enrollSubjectId as string | undefined;
    const purpose = req.user?.tokenPurpose as string | undefined;
    if (purpose !== 'enroll' || !enrollSubjectId) return true;

    const path: string = String(req.route?.path || req.url || '');
    const method = String(req.method || '').toUpperCase();
    const paramId = req.params?.id as string | undefined;

    // Rutas permitidas para enrolamiento acotado
    const allowed =
      (paramId && paramId === enrollSubjectId) ||
      path.includes('enroll-session') ||
      false;

    // Bloquear listados, creación de sujetos, puertas, etc.
    const blockedPatterns = [
      /subjects$/, // list/create without :id
      /points/,
      /authorizations/,
      /events/,
      /door/,
      /recognize/,
      /demo/,
    ];
    if (blockedPatterns.some((re) => re.test(path)) && !paramId) {
      throw new ForbiddenException('enroll_scope');
    }
    if (paramId && paramId !== enrollSubjectId) {
      throw new ForbiddenException('enroll_scope_subject');
    }
    // No permitir DELETE de biometrics de otros (ya cubierto por paramId)
    if (method === 'DELETE' && paramId && paramId !== enrollSubjectId) {
      throw new ForbiddenException('enroll_scope_subject');
    }
    if (!allowed && paramId !== enrollSubjectId) {
      throw new ForbiddenException('enroll_scope');
    }
    return true;
  }
}
