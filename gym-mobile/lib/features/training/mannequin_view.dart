import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/api/api_config.dart';

/// Ciclo 3D del maniquí. La página pública reproduce el mismo GLB del panel.
class MannequinView extends StatefulWidget {
  const MannequinView({super.key, required this.clipKey, this.interactive = false});

  final String clipKey;
  final bool interactive;

  @override
  State<MannequinView> createState() => _MannequinViewState();
}

class _MannequinViewState extends State<MannequinView> {
  late final WebViewController controller;

  @override
  void initState() {
    super.initState();
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0C1018))
      ..loadRequest(_url(widget.clipKey));
  }

  @override
  void didUpdateWidget(MannequinView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.clipKey != widget.clipKey) {
      controller.loadRequest(_url(widget.clipKey));
    }
  }

  Uri _url(String clip) {
    return Uri.parse('${ApiConfig.baseUrl}/maniqui?clip=${Uri.encodeQueryComponent(clip)}&bare=1');
  }

  @override
  Widget build(BuildContext context) {
    if (widget.clipKey.trim().isEmpty) {
      return const ColoredBox(
        color: Color(0xFF0C1018),
        child: Center(child: Text('Sin ciclo 3D', style: TextStyle(color: Colors.white54))),
      );
    }
    return WebViewWidget(
      controller: controller,
      gestureRecognizers: widget.interactive
          ? <Factory<OneSequenceGestureRecognizer>>{
              Factory<EagerGestureRecognizer>(() => EagerGestureRecognizer()),
            }
          : <Factory<OneSequenceGestureRecognizer>>{},
    );
  }
}
