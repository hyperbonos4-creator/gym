import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'mannequin_view.dart';
import '../../core/api/dio_client.dart';

class TrainingScreen extends ConsumerStatefulWidget {
  const TrainingScreen({super.key});

  @override
  ConsumerState<TrainingScreen> createState() => _TrainingScreenState();
}

class _TrainingScreenState extends ConsumerState<TrainingScreen> {
  Map<String, dynamic>? program;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final res = await ref.read(dioProvider).get('/api/mobile/entreno');
      final raw = res.data['program'];
      program = raw is Map ? Map<String, dynamic>.from(raw) : null;
      error = null;
    } catch (_) {
      error = 'No se pudo cargar el entreno.';
    }
    if (mounted) setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final data = program;
    final missing = data?['missing'] == true;
    final upcoming = data?['upcoming'] == true;
    final rest = data?['rest'] == true;
    final session = data == null
        ? <Map<String, dynamic>>[]
        : ((data['items'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        children: [
          Text('Tu entreno', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 6),
          Text(
            data == null
                ? 'Cuando tu entrenador te asigne una rutina, la sesión de hoy aparece aquí.'
                : '${data['name']} · versión ${data['version']}',
            style: const TextStyle(color: Colors.white70, height: 1.35),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(error!, style: const TextStyle(color: Color(0xFFFBBF24))),
            ),
          const SizedBox(height: 18),
          if (data == null)
            const _EmptyCard(text: 'Todavía no tienes una rutina asignada.')
          else if (missing)
            const _EmptyCard(text: 'La versión asignada ya no está disponible.')
          else if (upcoming)
            _EmptyCard(text: 'Tu rutina empieza el ${data['startDate']}.')
          else ...[
            Text(
              rest ? '${data['todayLabel']} · Descanso' : '${data['todayLabel']} · ${data['todayTitle']}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            if (rest)
              const _EmptyCard(text: 'Hoy no hay ejercicios. La siguiente sesión sigue en la rutina que te asignaron.')
            else
              for (final item in session) _SessionCard(item: item),
          ],
        ],
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.item});
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final clip = '${item['studioKey'] ?? ''}'.trim();
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF121826),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white12),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/entreno/${item['id']}', extra: item),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 16 / 10,
              child: clip.isEmpty
                  ? const ColoredBox(
                      color: Color(0xFF0C1018),
                      child: Center(child: Text('Sin ciclo 3D', style: TextStyle(color: Colors.white54))),
                    )
                  : MannequinView(clipKey: clip),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${item['classification']} · ${item['level']}',
                    style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text('${item['name']}', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 4),
                  Text('${item['muscle']} · ${item['equipment']}', style: const TextStyle(color: Colors.white70)),
                  if (item['sets'] != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      '${item['sets']} series · ${item['reps']} · ${item['restSec']} s descanso',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white12),
      ),
      child: Text(text, style: const TextStyle(color: Colors.white54, height: 1.4)),
    );
  }
}
