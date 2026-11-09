import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/dio_client.dart';

class NutritionScreen extends ConsumerStatefulWidget {
  const NutritionScreen({super.key});

  @override
  ConsumerState<NutritionScreen> createState() => _NutritionScreenState();
}

class _NutritionScreenState extends ConsumerState<NutritionScreen> {
  Map<String, dynamic>? data;
  bool loading = true;
  String? error;
  final note = TextEditingController();

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    note.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final res = await ref.read(dioProvider).get('/api/mobile/nutricion');
      data = Map<String, dynamic>.from(res.data as Map);
      error = null;
    } catch (_) {
      error = 'No se pudo cargar tu alimentación.';
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> send(Map<String, dynamic> body) async {
    try {
      await ref.read(dioProvider).post('/api/mobile/nutricion', data: body);
      note.clear();
      await load();
    } catch (_) {
      if (mounted) setState(() => error = 'No se pudo guardar el registro.');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null && data == null) {
      return Center(child: Text(error!, style: const TextStyle(color: Colors.white70)));
    }
    final plan = (data?['planName'] ?? '').toString();
    final meals = (data?['meals'] as List?) ?? const [];
    final habits = (data?['habits'] as List?) ?? const [];
    final logs = (data?['logs'] as List?) ?? const [];
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          const Text('Mi alimentación', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          const Text('Tu guía del día y tus hábitos.', style: TextStyle(color: Colors.white54)),
          const SizedBox(height: 14),
          if (plan.isEmpty)
            const Text('Todavía no tienes una guía asignada.', style: TextStyle(color: Colors.white70))
          else ...[
            Text('$plan · versión ${data?['version'] ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF38BDF8))),
            const SizedBox(height: 10),
            for (final raw in meals)
              _MealCard(meal: Map<String, dynamic>.from(raw as Map), onNote: (slot) => send({'kind': 'comida', 'slot': slot, 'note': note.text, 'done': true})),
          ],
          const SizedBox(height: 16),
          const Text('Hábitos de hoy', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          if (habits.isEmpty) const Text('Sin hábitos acordados.', style: TextStyle(color: Colors.white54)),
          for (final raw in habits)
            _HabitRow(
              habit: Map<String, dynamic>.from(raw as Map),
              done: logs.any((row) => row is Map && row['habitId'] == raw['id'] && row['done'] == true),
              onTap: () => send({'kind': 'habito', 'habitId': raw['id'], 'done': true, 'note': note.text}),
            ),
          const SizedBox(height: 8),
          TextField(
            controller: note,
            style: const TextStyle(color: Colors.white),
            decoration: const InputDecoration(hintText: 'Observación del día, si quieres dejarla', hintStyle: TextStyle(color: Colors.white38)),
          ),
          if ((data?['routineName'] ?? '').toString().isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Text('Rutina vigente: ${data?['routineName']}. Registrar la comida no cambia el entrenamiento.', style: const TextStyle(color: Colors.white38, fontSize: 12)),
            ),
          if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(error!, style: const TextStyle(color: Colors.orangeAccent))),
        ],
      ),
    );
  }
}

class _MealCard extends StatelessWidget {
  const _MealCard({required this.meal, required this.onNote});
  final Map<String, dynamic> meal;
  final ValueChanged<String> onNote;

  @override
  Widget build(BuildContext context) {
    const labels = {'desayuno': 'Desayuno', 'almuerzo': 'Almuerzo', 'merienda': 'Merienda', 'cena': 'Cena'};
    final slot = (meal['slot'] ?? '').toString();
    final items = (meal['items'] as List?) ?? const [];
    return Card(
      color: const Color(0xFF151D2E),
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(labels[slot] ?? slot, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            if (items.isEmpty) const Text('Sin alimentos', style: TextStyle(color: Colors.white54)),
            for (final raw in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(_line(Map<String, dynamic>.from(raw as Map)), style: const TextStyle(color: Colors.white70)),
              ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(onPressed: () => onNote(slot), child: const Text('Registrar esta comida')),
            ),
          ],
        ),
      ),
    );
  }

  String _line(Map<String, dynamic> item) {
    final name = (item['label'] ?? '').toString();
    final portion = (item['portion'] ?? '').toString();
    final alt = (item['alternatives'] ?? '').toString();
    final detail = (item['detail'] ?? '').toString();
    return [
      name,
      if (portion.isNotEmpty) portion,
      if (alt.isNotEmpty) 'alternativa: $alt',
      if (detail.isNotEmpty) detail,
    ].join(' · ');
  }
}

class _HabitRow extends StatelessWidget {
  const _HabitRow({required this.habit, required this.done, required this.onTap});
  final Map<String, dynamic> habit;
  final bool done;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(done ? Icons.check_circle : Icons.circle_outlined, color: done ? const Color(0xFF38BDF8) : Colors.white38),
      title: Text((habit['label'] ?? '').toString()),
      onTap: done ? null : onTap,
    );
  }
}
