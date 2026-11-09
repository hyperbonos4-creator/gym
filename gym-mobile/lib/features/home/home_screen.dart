import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gym_mobile/features/auth/auth_notifier.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key, this.guests = false});
  final bool guests;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    return RefreshIndicator(
      onRefresh: () => ref.read(authProvider.notifier).refresh(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          if (!guests) ...[
            Text(auth.ownerName, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            _AccessCard(auth: auth),
            const SizedBox(height: 12),
            _PassCard(auth: auth),
            const SizedBox(height: 16),
          ] else ...[
            Text('Invitados', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 6),
            Text(auth.total < 1
                ? 'No tienes un pase de invitados activo. Sin ese plan no se pueden generar invitaciones.'
                : 'Puedes enviar ${auth.disponibles}. Quedan ${auth.left} de ${auth.total}${auth.apartados > 0 ? ' · ${auth.apartados} sin registrar el rostro' : ''}'),
            const SizedBox(height: 16),
          ],
          FilledButton(
            onPressed: auth.disponibles < 1 ? null : () => context.push('/invitar'),
            child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 14),
              child: Text('Generar invitación'),
            ),
          ),
          const SizedBox(height: 22),
          if (!guests) const Text('Últimos invitados', style: TextStyle(fontWeight: FontWeight.w700)),
          if (!guests) const SizedBox(height: 8),
          if (auth.invitations.isEmpty)
            const Text('Todavía no hay invitaciones.', style: TextStyle(color: Colors.white54)),
          ...auth.invitations.map((row) => _InviteTile(row)),
        ],
      ),
    );
  }
}

class _AccessCard extends StatelessWidget {
  const _AccessCard({required this.auth});
  final AuthState auth;

  @override
  Widget build(BuildContext context) {
    final live = auth.accessLive;
    final label = live == 'activa'
        ? 'Puede entrar'
        : live == 'suspendida'
            ? 'Membresía en pausa'
            : live == 'vencida'
                ? 'Membresía vencida'
                : 'Sin plan vigente';
    final detail = auth.accessPlan.isEmpty
        ? 'Elige un plan para activar el acceso.'
        : '${auth.accessPlan}${auth.accessEnds.isEmpty ? '' : ' · hasta ${auth.accessEnds}'}${live == 'activa' ? ' · ${auth.accessDays} días' : ''}';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white12),
        color: Colors.white.withValues(alpha: 0.04),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(detail),
        ],
      ),
    );
  }
}

class _PassCard extends StatelessWidget {
  const _PassCard({required this.auth});
  final AuthState auth;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Pase de invitados', style: TextStyle(color: Colors.white60)),
          const SizedBox(height: 6),
          Text('${auth.left}', style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w800, height: 1)),
          Text('de ${auth.total}${auth.until.isEmpty ? '' : ' · hasta ${auth.until}'}${auth.apartados > 0 ? ' · ${auth.apartados} esperando registro' : ''}', style: const TextStyle(color: Colors.white70)),
        ],
      ),
    );
  }
}

class _InviteTile extends StatelessWidget {
  const _InviteTile(this.row);
  final Invite row;

  @override
  Widget build(BuildContext context) {
    final used = row.status == 'used';
    final via = row.entryVia == 'rostro' ? 'por rostro' : row.entryVia == 'pin' ? 'por PIN' : '';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(row.guestName, style: const TextStyle(fontWeight: FontWeight.w700)),
          Text(row.guestDoc, style: const TextStyle(color: Colors.white54, fontSize: 12)),
          const SizedBox(height: 4),
          Text(
            used
                ? 'Ingresó $via · de parte de ${row.ownerName}${row.creditsLeftAfter == null ? '' : ' · quedan ${row.creditsLeftAfter}'}'
                : (row.enrolledAt != null && row.enrolledAt!.isNotEmpty)
                    ? 'Rostro registrado · se descontó 1 ingreso'
                    : row.status == 'pending'
                        ? 'Enlace enviado · el ingreso se descuenta al registrar el rostro'
                        : row.status == 'cancelled'
                            ? 'Anulada'
                            : 'Venció sin usarse',
            style: TextStyle(color: used ? const Color(0xFF34D399) : const Color(0xFF38BDF8), fontSize: 13),
          ),
        ],
      ),
    );
  }
}
