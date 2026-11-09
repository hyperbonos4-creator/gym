String cop(int value) {
  final raw = value.abs().toString();
  final buf = StringBuffer(value < 0 ? '-' : '');
  for (var i = 0; i < raw.length; i++) {
    if (i > 0 && (raw.length - i) % 3 == 0) buf.write('.');
    buf.write(raw[i]);
  }
  return '\$$buf';
}
