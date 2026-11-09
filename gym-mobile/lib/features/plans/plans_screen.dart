import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/dio_client.dart';
import '../../core/money.dart';
import '../auth/auth_notifier.dart';

class PlansScreen extends ConsumerStatefulWidget {
  const PlansScreen({super.key});

  @override
  ConsumerState<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends ConsumerState<PlansScreen> {
  List<Map<String, dynamic>> plans = [];
  List<Map<String, dynamic>> payments = [];
  bool loading = true;
  String? busyId;
  String? notice;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final dio = ref.read(dioProvider);
      final plansRes = await dio.get('/api/mobile/planes');
      final payRes = await dio.get('/api/mobile/pagos');
      plans = ((plansRes.data['plans'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      payments = ((payRes.data['payments'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      notice = null;
    } catch (_) {
      notice = 'No se pudieron cargar los planes.';
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> pay(Map<String, dynamic> plan) async {
    setState(() {
      busyId = '${plan['id']}';
      notice = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post('/api/mobile/pagos', data: {'planId': plan['id']});
      final url = '${res.data['checkoutUrl'] ?? ''}';
      if (url.isEmpty) {
        notice = 'Wompi no devolvió el enlace de pago.';
      } else {
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        notice = 'Termina el pago en Wompi. Al volver, desliza para actualizar.';
      }
    } on DioException catch (e) {
      final data = e.response?.data;
      notice = data is Map && data['error'] is String ? data['error'] as String : 'No se pudo abrir el pago.';
    } catch (_) {
      notice = 'No se pudo abrir el pago.';
    }
    if (mounted) {
      setState(() => busyId = null);
      await ref.read(authProvider.notifier).refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)));
    }
    return RefreshIndicator(
      color: const Color(0xFF38BDF8),
      backgroundColor: const Color(0xFF12182A),
      onRefresh: () async {
        await load();
        await ref.read(authProvider.notifier).refresh();
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          const _Header(),
          if (notice != null) ...[
            const SizedBox(height: 14),
            _Notice(notice!),
          ],
          const SizedBox(height: 16),
          if (plans.isEmpty)
            const _EmptyPlans()
          else
            for (final plan in plans)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: _PlanCard(
                  plan: plan,
                  busy: busyId == '${plan['id']}',
                  onPay: () => pay(plan),
                ),
              ),
          if (payments.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text('PAGOS', style: _kicker),
            const SizedBox(height: 10),
            for (final p in payments.take(6))
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _PaymentRow(payment: p),
              ),
          ],
        ],
      ),
    );
  }
}

const _kicker = TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.6, color: Color(0xFF8BA0B8));

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('PLANES', style: _kicker),
        SizedBox(height: 6),
        Text('Elige cómo entras', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, height: 1.05)),
        SizedBox(height: 8),
        Text(
          'El cobro lo hace Wompi. El plan queda activo solo cuando el pago está aprobado.',
          style: TextStyle(color: Color(0xFF9AABBE), height: 1.35),
        ),
      ],
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF2A2112),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x66FBBF24)),
      ),
      child: Text(text, style: const TextStyle(color: Color(0xFFFBBF24), height: 1.35)),
    );
  }
}

class _EmptyPlans extends StatelessWidget {
  const _EmptyPlans();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: const Color(0xFF101826),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white10),
      ),
      child: const Text('Este gimnasio todavía no publicó planes.', style: TextStyle(color: Color(0xFF9AABBE))),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.plan, required this.busy, required this.onPay});
  final Map<String, dynamic> plan;
  final bool busy;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    final kind = '${plan['kind']}' == 'tiquetera';
    final days = (plan['durationDays'] as num?)?.toInt() ?? 0;
    final credits = (plan['guestCredits'] as num?)?.toInt() ?? 0;
    final benefits = ((plan['benefits'] as List?) ?? []).map((e) => '$e').where((e) => e.trim().isNotEmpty).toList();
    final description = '${plan['description']}'.trim();
    final accent = kind ? const Color(0xFFF5C16C) : const Color(0xFF38BDF8);
    final chip = kind ? '$credits ingresos' : (days == 1 ? '1 día' : '$days días');
    final span = kind ? 'Se cierra a los $days días o al gastar los ingresos.' : (days == 1 ? 'Acceso durante el día de la compra.' : 'Acceso continuo por $days días.');

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF101826),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: accent.withValues(alpha: 0.35)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 4, color: accent),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: accent.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(chip.toUpperCase(), style: TextStyle(color: accent, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
                          ),
                          const Spacer(),
                          Text(kind ? 'TIQUETERA' : 'MEMBRESÍA', style: const TextStyle(color: Color(0xFF6E8196), fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2)),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text('${plan['name']}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, height: 1.1)),
                      const SizedBox(height: 10),
                      Text(cop((plan['price'] as num?)?.toInt() ?? 0), style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, height: 1, color: accent, letterSpacing: -0.6)),
                      const SizedBox(height: 8),
                      Text(span, style: const TextStyle(color: Color(0xFF9AABBE), height: 1.35)),
                      if (description.isNotEmpty && description != span) ...[
                        const SizedBox(height: 8),
                        Text(description, style: const TextStyle(color: Color(0xFFD5DEE8), height: 1.35)),
                      ],
                      if (benefits.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        for (final line in benefits) _Benefit(line: line, color: accent),
                      ],
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: busy ? null : onPay,
                          style: FilledButton.styleFrom(
                            backgroundColor: accent,
                            foregroundColor: const Color(0xFF071018),
                            disabledBackgroundColor: accent.withValues(alpha: 0.35),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          child: Text(busy ? 'Abriendo Wompi…' : 'Pagar', style: const TextStyle(fontWeight: FontWeight.w800)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Benefit extends StatelessWidget {
  const _Benefit({required this.line, required this.color});
  final String line;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final text = line.replaceFirst(RegExp(r'^[·•\-\s]+'), '');
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 6),
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(color: Color(0xFFE7EEF6), height: 1.3))),
        ],
      ),
    );
  }
}

class _PaymentRow extends StatelessWidget {
  const _PaymentRow({required this.payment});
  final Map<String, dynamic> payment;

  @override
  Widget build(BuildContext context) {
    final status = '${payment['status']}';
    final tone = status == 'aprobado'
        ? const Color(0xFF34D399)
        : status == 'rechazado'
            ? const Color(0xFFF87171)
            : const Color(0xFFFBBF24);
    final label = status == 'aprobado' ? 'Aprobado' : status == 'rechazado' ? 'Rechazado' : 'Pendiente';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF101826),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${payment['planName']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(label, style: TextStyle(color: tone, fontSize: 12, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          Text(cop((payment['amount'] as num?)?.toInt() ?? 0), style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}
