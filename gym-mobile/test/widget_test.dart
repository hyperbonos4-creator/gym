import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_mobile/main.dart';

void main() {
  testWidgets('la app muestra VISIONYX', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: FuerzaEliteApp()));
    expect(find.text('VISIONYX'), findsOneWidget);
  });
}
