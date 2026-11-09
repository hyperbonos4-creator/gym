import 'dart:async';

import 'package:flutter/material.dart';

import 'mannequin_view.dart';

class LessonScreen extends StatefulWidget {
  const LessonScreen({super.key, required this.item});
  final Map<String, dynamic> item;

  @override
  State<LessonScreen> createState() => _LessonScreenState();
}

class _LessonScreenState extends State<LessonScreen> {
  int step = 0;
  int tick = 0;
  Timer? ticker;

  List<Map<String, dynamic>> get steps => ((widget.item['steps'] as List?) ?? []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();

  @override
  void initState() {
    super.initState();
    ticker = Timer.periodic(const Duration(milliseconds: 900), (_) {
      if (!mounted || steps.isEmpty) return;
      tick += 1;
      if (tick % 3 != 0) return;
      setState(() => step = (step + 1) % steps.length);
    });
  }

  @override
  void dispose() {
    ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final cues = ((item['cues'] as List?) ?? []).map((e) => '$e').toList();
    final mistakes = ((item['mistakes'] as List?) ?? []).map((e) => '$e').toList();
    final clip = '${item['studioKey'] ?? ''}'.trim();
    return Scaffold(
      appBar: AppBar(title: Text('${item['name']}')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: AspectRatio(
              aspectRatio: 4 / 3,
              child: ColoredBox(
                color: const Color(0xFF0C1018),
                child: clip.isEmpty
                    ? const Center(child: Text('Sin ciclo 3D', style: TextStyle(color: Colors.white54)))
                    : MannequinView(clipKey: clip, interactive: true),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            clip.isEmpty ? 'Este ejercicio no tiene maniquí 3D.' : 'Maniquí 3D. Puedes girarlo. El recorrido no certifica la técnica.',
            style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.w700),
          ),
          if (clip.isEmpty && '${item['mediumNote'] ?? ''}'.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('${item['mediumNote']}', style: const TextStyle(color: Colors.white54, height: 1.35)),
            ),
          const SizedBox(height: 14),
          Text('${item['classification']} · ${item['level']} · ${item['muscle']}', style: const TextStyle(color: Color(0xFF38BDF8))),
          if (item['sets'] != null) ...[
            const SizedBox(height: 8),
            Text('${item['sets']} series · ${item['reps']} · descanso ${item['restSec']} s', style: const TextStyle(fontWeight: FontWeight.w700)),
            if ('${item['load'] ?? ''}'.trim().isNotEmpty) Text('Carga: ${item['load']}'),
            if ('${item['effort'] ?? ''}'.trim().isNotEmpty) Text('${item['effort']}'),
            if ('${item['note'] ?? ''}'.trim().isNotEmpty) Text('${item['note']}'),
            if ('${item['alternativeName'] ?? ''}'.trim().isNotEmpty) Text('Si falta el equipo: ${item['alternativeName']}'),
          ],
          const SizedBox(height: 8),
          Text('${item['why']}', style: const TextStyle(height: 1.4)),
          const SizedBox(height: 8),
          Text('Equipo: ${item['equipment']} · Tempo ${item['tempo']}'),
          const SizedBox(height: 16),
          _Block(title: 'Qué usar', text: '${item['machine']}'),
          _Block(title: 'Cómo colocarte', text: '${item['place']}'),
          _Block(title: 'Cómo agarrar', text: '${item['grip']}'),
          const SizedBox(height: 8),
          Text('Secuencia', style: Theme.of(context).textTheme.titleMedium),
          for (var i = 0; i < steps.length; i++)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: i == step % (steps.isEmpty ? 1 : steps.length) ? const Color(0xFF38BDF8) : Colors.white12),
              ),
              child: Text('${i + 1}. ${steps[i]['title']}. ${steps[i]['text']}'),
            ),
          const SizedBox(height: 18),
          Text('Señales', style: Theme.of(context).textTheme.titleMedium),
          for (final c in cues) Padding(padding: const EdgeInsets.only(top: 6), child: Text('· $c')),
          const SizedBox(height: 18),
          Text('Errores', style: Theme.of(context).textTheme.titleMedium),
          for (final m in mistakes) Padding(padding: const EdgeInsets.only(top: 6), child: Text('· $m', style: const TextStyle(color: Color(0xFFFBBF24)))),
        ],
      ),
    );
  }
}

class _Block extends StatelessWidget {
  const _Block({required this.title, required this.text});
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    if (text.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(text),
        ],
      ),
    );
  }
}
