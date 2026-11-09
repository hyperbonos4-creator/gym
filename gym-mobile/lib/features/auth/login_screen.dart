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
  final _otp = TextEditingController();
  bool _awaitingOtp = false;

  @override
  void dispose() {
    _doc.dispose();
    _phone.dispose();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final notifier = ref.read(authProvider.notifier);
    if (!_awaitingOtp) {
      final step = await notifier.login(_doc.text.trim(), _phone.text.trim());
      if (!mounted) return;
      if (step == 'otp') {
        setState(() => _awaitingOtp = true);
      }
      return;
    }
    await notifier.login(_doc.text.trim(), _phone.text.trim(), code: _otp.text.trim());
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
            Text(
              _awaitingOtp
                  ? 'Te enviamos un código por WhatsApp. Escríbelo para entrar.'
                  : 'Entra con el documento y el WhatsApp de tu ficha. Te mandaremos un código de verificación.',
              style: const TextStyle(color: Colors.white70, height: 1.4),
            ),
            const SizedBox(height: 28),
            TextField(
              controller: _doc,
              enabled: !_awaitingOtp,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Documento', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phone,
              enabled: !_awaitingOtp,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'WhatsApp', border: OutlineInputBorder()),
            ),
            if (_awaitingOtp) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _otp,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Código WhatsApp', border: OutlineInputBorder()),
              ),
            ],
            if (auth.error != null) ...[
              const SizedBox(height: 12),
              Text(auth.error!, style: const TextStyle(color: Color(0xFFFBBF24))),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: auth.loading ? null : _submit,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Text(auth.loading ? 'Espera…' : (_awaitingOtp ? 'Verificar código' : 'Enviar código')),
              ),
            ),
            if (_awaitingOtp) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: auth.loading
                    ? null
                    : () => setState(() {
                          _awaitingOtp = false;
                          _otp.clear();
                        }),
                child: const Text('Cambiar documento'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
