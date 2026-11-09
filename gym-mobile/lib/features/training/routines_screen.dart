import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/dio_client.dart';

/// La versión que el entrenador asignó, aparte de la sesión de hoy.
class TrainerRoutinesScreen extends ConsumerStatefulWidget {
  const TrainerRoutinesScreen({super.key});

  @override
  ConsumerState<TrainerRoutinesScreen> createState() => _TrainerRoutinesScreenState();
}

class _TrainerRoutinesScreenState extends ConsumerState<TrainerRoutinesScreen> {
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
      error = 'No se pudieron cargar las rutinas.';
    }
    if (mounted) setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final data = program;
    final week = data == null
        ? <Map<String, dynamic>>[]
        : ((data['week'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        children: [
          Text('Rutinas del entrenador', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 6),
          Text(
            data == null
                ? 'Aquí aparece la rutina que te asignen, con los días y los ejercicios de esa versión.'
                : '${data['name']} · versión ${data['version']}${_goal(data)}',
            style: const TextStyle(color: Colors.white70, height: 1.35),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(error!, style: const TextStyle(color: Color(0xFFFBBF24))),
            ),
          const SizedBox(height: 18),
          if (data == null)
            const _Note('Todavía no tienes una rutina asignada.')
          else if (data['missing'] == true)
            const _Note('La versión asignada ya no está disponible.')
          else if (week.isEmpty)
            const _Note('Esta rutina todavía no tiene días.')
          else
            for (final day in week) _DayBlock(day: day),
        ],
      ),
    );
  }

  String _goal(Map<String, dynamic> data) {
    final goal = '${data['goal'] ?? ''}'.trim();
    if (goal.isEmpty) return '';
    return ' · $goal';
  }
}

class _DayBlock extends StatelessWidget {
  const _DayBlock({required this.day});
  final Map<String, dynamic> day;

  @override
  Widget build(BuildContext context) {
    final today = day['today'] == true;
    final rest = day['rest'] == true;
    final items = ((day['items'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      decoration: BoxDecoration(
        color: const Color(0xFF121826),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: today ? const Color(0xFF38BDF8) : Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('${day['label']} · ${day['title']}', style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
              if (today)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF38BDF8),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: const Text('Hoy', style: TextStyle(color: Color(0xFF0A0F1C), fontSize: 11, fontWeight: FontWeight.w800)),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (rest || items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text('Sin ejercicios.', style: TextStyle(color: Colors.white54)),
            )
          else
            for (final item in items)
              InkWell(
                onTap: () => context.push('/entreno/${item['id']}', extra: item),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(
                    children: [
                      const Icon(Icons.view_in_ar_outlined, size: 18, color: Color(0xFF38BDF8)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${item['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 2),
                            Text(
                              '${item['sets']} series · ${item['reps']} · ${item['restSec']} s',
                              style: const TextStyle(color: Colors.white60, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: Colors.white38),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note(this.text);
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
