import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gym_mobile/core/api/dio_client.dart';
import 'package:gym_mobile/core/storage/secure_storage.dart';

class Invite {
  Invite({
    required this.id,
    required this.guestName,
    required this.guestDoc,
    required this.status,
    this.pin,
    this.enrollUrl = '',
    this.entryVia,
    this.ownerName = '',
    this.creditsLeftAfter,
    this.usedAt,
    this.enrolledAt,
  });

  final String id;
  final String guestName;
  final String guestDoc;
  final String status;
  final String? pin;
  final String enrollUrl;
  final String? entryVia;
  final String ownerName;
  final int? creditsLeftAfter;
  final String? usedAt;
  final String? enrolledAt;

  factory Invite.fromJson(Map<String, dynamic> json) {
    return Invite(
      id: '${json['id'] ?? ''}',
      guestName: '${json['guestName'] ?? ''}',
      guestDoc: '${json['guestDoc'] ?? ''}',
      status: '${json['status'] ?? ''}',
      pin: json['pin']?.toString(),
      enrollUrl: '${json['enrollUrl'] ?? ''}',
      entryVia: json['entryVia']?.toString(),
      ownerName: '${json['ownerName'] ?? ''}',
      creditsLeftAfter: json['creditsLeftAfter'] is num ? (json['creditsLeftAfter'] as num).toInt() : null,
      usedAt: json['usedAt']?.toString(),
      enrolledAt: json['enrolledAt']?.toString(),
    );
  }
}

class AuthState {
  const AuthState({
    this.ready = false,
    this.loading = false,
    this.token,
    this.ownerName = '',
    this.left = 0,
    this.total = 0,
    this.until = '',
    this.disponibles = 0,
    this.apartados = 0,
    this.accessPlan = '',
    this.accessLive = '',
    this.accessEnds = '',
    this.accessDays = 0,
    this.invitations = const [],
    this.error,
  });

  final bool ready;
  final bool loading;
  final String? token;
  final String ownerName;
  final int left;
  final int total;
  final String until;
  final int disponibles;
  final int apartados;
  final String accessPlan;
  final String accessLive;
  final String accessEnds;
  final int accessDays;
  final List<Invite> invitations;
  final String? error;

  bool get signedIn => token != null && token!.isNotEmpty;

  AuthState copyWith({
    bool? ready,
    bool? loading,
    String? token,
    String? ownerName,
    int? left,
    int? total,
    String? until,
    int? disponibles,
    int? apartados,
    String? accessPlan,
    String? accessLive,
    String? accessEnds,
    int? accessDays,
    List<Invite>? invitations,
    String? error,
    bool clearError = false,
  }) {
    return AuthState(
      ready: ready ?? this.ready,
      loading: loading ?? this.loading,
      token: token ?? this.token,
      ownerName: ownerName ?? this.ownerName,
      left: left ?? this.left,
      total: total ?? this.total,
      until: until ?? this.until,
      disponibles: disponibles ?? this.disponibles,
      apartados: apartados ?? this.apartados,
      accessPlan: accessPlan ?? this.accessPlan,
      accessLive: accessLive ?? this.accessLive,
      accessEnds: accessEnds ?? this.accessEnds,
      accessDays: accessDays ?? this.accessDays,
      invitations: invitations ?? this.invitations,
      error: clearError ? null : error ?? this.error,
    );
  }
}

class AuthNotifier extends Notifier<AuthState> {
  final _storage = SecureStorageService();
  late final DioClient _api = DioClient(_storage);

  @override
  AuthState build() => const AuthState();

  Future<void> restore() async {
    String? token;
    try {
      token = await _storage.getToken();
    } catch (_) {
      state = const AuthState(ready: true);
      return;
    }
    if (token == null || token.isEmpty) {
      state = const AuthState(ready: true);
      return;
    }
    state = state.copyWith(token: token, ready: false);
    final ok = await refresh();
    if (!ok) {
      await _storage.clear();
      state = const AuthState(ready: true);
      return;
    }
    state = state.copyWith(ready: true);
  }

  Future<bool> login(String doc, String phone) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final res = await _api.dio.post('/api/mobile/login', data: {'doc': doc, 'phone': phone});
      final data = Map<String, dynamic>.from(res.data as Map);
      final token = '${data['token'] ?? ''}';
      await _storage.saveToken(token);
      state = state.copyWith(
        loading: false,
        ready: true,
        token: token,
        ownerName: '${data['ownerName'] ?? ''}',
        left: (data['left'] as num?)?.toInt() ?? 0,
        total: (data['total'] as num?)?.toInt() ?? 0,
        until: '${data['until'] ?? ''}',
        disponibles: (data['disponibles'] as num?)?.toInt() ?? (data['left'] as num?)?.toInt() ?? 0,
        apartados: (data['apartados'] as num?)?.toInt() ?? 0,
      );
      await refresh();
      return true;
    } on DioException catch (e) {
      final msg = e.response?.data is Map ? '${(e.response!.data as Map)['error'] ?? ''}' : '';
      state = state.copyWith(loading: false, ready: true, error: msg.isEmpty ? 'No se pudo entrar.' : msg);
      return false;
    } catch (_) {
      state = state.copyWith(loading: false, ready: true, error: 'No hubo respuesta del sistema.');
      return false;
    }
  }

  Future<bool> refresh() async {
    try {
      final res = await _api.dio.get('/api/mobile/me');
      final data = Map<String, dynamic>.from(res.data as Map);
      final rows = (data['invitations'] as List? ?? const [])
          .map((e) => Invite.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      final acceso = data['acceso'] is Map ? Map<String, dynamic>.from(data['acceso'] as Map) : null;
      state = state.copyWith(
        ownerName: '${data['ownerName'] ?? state.ownerName}',
        left: (data['left'] as num?)?.toInt() ?? 0,
        total: (data['total'] as num?)?.toInt() ?? 0,
        until: '${data['until'] ?? ''}',
        disponibles: (data['disponibles'] as num?)?.toInt() ?? (data['left'] as num?)?.toInt() ?? 0,
        apartados: (data['apartados'] as num?)?.toInt() ?? 0,
        accessPlan: acceso == null ? '' : '${acceso['planName'] ?? ''}',
        accessLive: acceso == null ? '' : '${acceso['live'] ?? ''}',
        accessEnds: acceso == null ? '' : '${acceso['endsOn'] ?? ''}',
        accessDays: (acceso?['days'] as num?)?.toInt() ?? 0,
        invitations: rows,
        clearError: true,
      );
      return true;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return false;
      return state.signedIn;
    } catch (_) {
      return state.signedIn;
    }
  }

  Future<Map<String, dynamic>?> createInvite(String name, String doc) async {
    final res = await _api.dio.post('/api/mobile/invitaciones', data: {
      'guestName': name,
      'guestDoc': doc,
    });
    await refresh();
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> logout() async {
    await _storage.clear();
    state = const AuthState(ready: true);
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
