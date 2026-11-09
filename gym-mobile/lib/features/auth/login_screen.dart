import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gym_mobile/features/auth/auth_notifier.dart';
import 'package:gym_mobile/features/update/update_banner.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _doc = TextEditingController();
  final _phone = TextEditingController();

  @override
  void dispose() {
    _doc.dispose();
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
          children: [
            const UpdateBanner(),
            const Text('FUERZA ÉLITE', style: TextStyle(letterSpacing: 3, fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF38BDF8))),
            const SizedBox(height: 12),
            const Text('Tu pase', style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text('Entra con el documento y el WhatsApp de tu ficha. Desde aquí generas las invitaciones del gimnasio.', style: TextStyle(color: Colors.white70, height: 1.4)),
            const SizedBox(height: 28),
            TextField(
              controller: _doc,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Documento', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'WhatsApp', border: OutlineInputBorder()),
            ),
            if (auth.error != null) ...[
              const SizedBox(height: 12),
              Text(auth.error!, style: const TextStyle(color: Color(0xFFFBBF24))),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: auth.loading
                  ? null
                  : () => ref.read(authProvider.notifier).login(_doc.text.trim(), _phone.text.trim()),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Text(auth.loading ? 'Entrando…' : 'Entrar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
