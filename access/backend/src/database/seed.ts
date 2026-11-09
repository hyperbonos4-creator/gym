import 'reflect-metadata';
import * as bcrypt from 'bcrypt';

import { AppDataSource } from './data-source';
import { User, UserRole } from '../auth/entities/user.entity';

/**
 * Crea el usuario administrador inicial a partir de SEED_ADMIN_EMAIL /
 * SEED_ADMIN_PASSWORD. Idempotente: si ya existe, no hace nada.
 *
 *   npm run seed
 *
 * En producción exige variables de entorno (sin defaults débiles).
 */
async function seed(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  const isProd = process.env.NODE_ENV === 'production';

  if (!email || !password) {
    throw new Error(
      'SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son obligatorios (sin valores por defecto).',
    );
  }
  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres.');
  }
  if (isProd && (password === 'ChangeMe123!' || email === 'admin@office.local')) {
    throw new Error('Credenciales de ejemplo prohibidas en producción.');
  }

  await AppDataSource.initialize();

  // En dev, asegura el esquema antes de insertar. En producción: migraciones.
  if (process.env.DB_SYNCHRONIZE === 'true' && !isProd) {
    await AppDataSource.synchronize();
  }

  const users = AppDataSource.getRepository(User);

  const existing = await users.findOne({ where: { email } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`Admin ya existe: ${email}`);
    await AppDataSource.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = users.create({
    email,
    passwordHash,
    firstName: 'Admin',
    lastName: 'Office',
    role: UserRole.ADMIN,
    isActive: true,
  });
  await users.save(admin);
  // eslint-disable-next-line no-console
  console.log(`Admin creado: ${email}`);
  await AppDataSource.destroy();
}

void seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed falló:', err);
  process.exit(1);
});
