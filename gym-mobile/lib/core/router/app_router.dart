import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gym_mobile/features/auth/auth_notifier.dart';
import 'package:gym_mobile/features/auth/login_screen.dart';
import 'package:gym_mobile/features/invites/new_invite_screen.dart';
import 'package:gym_mobile/features/shell/main_shell.dart';
import 'package:gym_mobile/features/splash/splash_screen.dart';
import 'package:gym_mobile/features/training/lesson_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen<AuthState>(authProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final loc = state.matchedLocation;
      if (!auth.ready) return loc == '/splash' ? null : '/splash';
      final inAuth = loc == '/login' || loc == '/splash';
      if (!auth.signedIn) return inAuth && loc != '/splash' ? null : '/login';
      if (inAuth) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/home', builder: (_, _) => const MainShell()),
      GoRoute(path: '/invitar', builder: (_, _) => const NewInviteScreen()),
      GoRoute(
        path: '/entreno/:id',
        builder: (_, state) => LessonScreen(item: state.extra is Map ? Map<String, dynamic>.from(state.extra as Map) : const {}),
      ),
    ],
  );
});
