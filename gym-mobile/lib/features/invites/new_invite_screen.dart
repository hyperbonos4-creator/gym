import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gym_mobile/features/auth/auth_notifier.dart';
import 'package:url_launcher/url_launcher.dart';

class NewInviteScreen extends ConsumerStatefulWidget {
  const NewInviteScreen({super.key});

  @override
  ConsumerState<NewInviteScreen> createState() => _NewInviteScreenState();
}

class _NewInviteScreenState extends ConsumerState<NewInviteScreen> {
  final _name = TextEditingController();
  final _doc = TextEditingController();
  bool _busy = false;
  String? _error;
  Map<String, dynamic>? _issued;

  @override
  void dispose() {
    _name.dispose();
    _doc.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_name.text.trim().length < 3 || _doc.text.trim().length < 5) {
      setState(() => _error = 'La invitación necesita el nombre y el documento.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await ref.read(authProvider.notifier).createInvite(_name.text.trim(), _doc.text.trim());
      setState(() => _issued = data);
    } on DioException catch (e) {
      final msg = e.response?.data is Map ? '${(e.response!.data as Map)['error'] ?? ''}' : '';
      setState(() => _error = msg.isEmpty ? 'No se creó la invitación.' : msg);
    } catch (_) {
      setState(() => _error = 'No hubo respuesta del sistema.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final issued = _issued;
    return Scaffold(
      appBar: AppBar(title: const Text('Nueva invitación'), backgroundColor: const Color(0xFF0A0F1C)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Envía el enlace al invitado. El ingreso se descuenta cuando esa persona registra el rostro, y queda en el registro de invitados.', style: TextStyle(color: Colors.white70, height: 1.4)),
          const SizedBox(height: 16),
          if (issued == null) ...[
            TextField(controller: _name, decoration: const InputDecoration(labelText: 'Nombre del invitado', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: _doc, decoration: const InputDecoration(labelText: 'Documento del invitado', border: OutlineInputBorder())),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Color(0xFFFBBF24))),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: Padding(padding: const EdgeInsets.symmetric(vertical: 14), child: Text(_busy ? 'Generando…' : 'Generar invitación')),
            ),
          ] else ...[
            Text('${issued['guestName']}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
            Text('${issued['guestDoc']} · de parte de ${issued['ownerName']}', style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 6),
            Text('Quedan ${issued['left']} de ${issued['total']}. El descuento ocurre cuando registre el rostro.', style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 16),
            if ('${issued['enrollUrl'] ?? ''}'.isNotEmpty) ...[
              FilledButton(
                onPressed: () {
                  final text = 'Hola ${issued['guestName']}. Registra tu rostro para tu visita a Fuerza Élite:\n${issued['enrollUrl']}';
                  launchUrl(Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}'), mode: LaunchMode.externalApplication);
                },
                child: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Enviar enlace por WhatsApp')),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => launchUrl(Uri.parse('${issued['enrollUrl']}'), mode: LaunchMode.externalApplication),
                child: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Abrir registro')),
              ),
            ]
            else
              const Text('No se pudo preparar el rostro. El PIN abre una sola vez.', style: TextStyle(color: Color(0xFFFBBF24))),
            const SizedBox(height: 18),
            const Text('PIN DE RESPALDO', style: TextStyle(letterSpacing: 1.4, fontSize: 11, color: Colors.white54, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Row(
              children: [
                for (final n in '${issued['pin'] ?? ''}'.split(''))
                  Expanded(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      height: 64,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white24),
                      ),
                      child: Text(n, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            const Text('Expira en el momento en que se usa. El registro queda a tu nombre.', style: TextStyle(color: Colors.white54, fontSize: 12)),
          ],
        ],
      ),
    );
  }
}
