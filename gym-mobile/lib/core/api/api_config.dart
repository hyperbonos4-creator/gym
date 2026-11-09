/// Dirección del sistema del gimnasio.
/// Para otro servidor: flutter run --dart-define=API_BASE_URL=https://...
class ApiConfig {
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://gym.198-199-82-161.sslip.io',
  );
}
