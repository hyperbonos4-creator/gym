import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_config.dart';
import '../../core/api/dio_client.dart';

class UpdateBanner extends ConsumerStatefulWidget {
  const UpdateBanner({super.key});

  @override
  ConsumerState<UpdateBanner> createState() => _UpdateBannerState();
}

class _UpdateBannerState extends ConsumerState<UpdateBanner> {
  String? notes;
  bool available = false;
  bool busy = false;
  double progress = 0;

  @override
  void initState() {
    super.initState();
    check();
  }

  Future<void> check() async {
    try {
      final info = await PackageInfo.fromPlatform();
      final local = int.tryParse(info.buildNumber) ?? 0;
      final res = await ref.read(dioProvider).get('/api/mobile/version');
      final remote = (res.data['build'] as num?)?.toInt() ?? 0;
      if (!mounted) return;
      setState(() {
        available = remote > local;
        notes = '${res.data['notes'] ?? ''}'.trim();
      });
    } catch (_) {
      /* sin red, la app sigue con lo que ya tiene */
    }
  }

  Future<void> install() async {
    setState(() {
      busy = true;
      progress = 0;
    });
    try {
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/VISIONYX.apk');
      await ref.read(dioProvider).download(
        '/api/mobile/app',
        file.path,
        onReceiveProgress: (got, total) {
          if (!mounted || total <= 0) return;
          setState(() => progress = got / total);
        },
      );
      final opened = await OpenFilex.open(file.path, type: 'application/vnd.android.package-archive');
      if (opened.type != ResultType.done) {
        await launchUrl(Uri.parse('${ApiConfig.baseUrl}/instalar'), mode: LaunchMode.externalApplication);
      }
    } on DioException {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No se pudo descargar la actualización.')));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!available) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF38BDF8)),
        color: const Color(0xFF38BDF8).withValues(alpha: 0.08),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Hay una actualización', style: TextStyle(fontWeight: FontWeight.w800)),
          if (notes != null && notes!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(notes!, style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ],
          const SizedBox(height: 10),
          if (busy && progress > 0)
            LinearProgressIndicator(value: progress, color: const Color(0xFF38BDF8), backgroundColor: Colors.white12),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: busy ? null : install,
            child: Text(busy ? 'Descargando…' : 'Actualizar'),
          ),
        ],
      ),
    );
  }
}
