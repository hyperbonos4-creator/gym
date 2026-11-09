import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Codigo de 6 digitos (almacenado como hash SHA-256) para vincular una tablet.
 * Un solo uso, TTL corto (10 min). Los intentos fallidos se rate-limitan aparte.
 */
@Entity('kiosk_pairing_codes')
export class KioskPairingCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_kiosk_pairing_hash', { unique: true })
  @Column({ name: 'code_hash', type: 'varchar', length: 64 })
  codeHash: string;

  @Column({ name: 'gym_id', type: 'varchar', length: 64 })
  gymId: string;

  @Column({ name: 'access_point_id', type: 'uuid' })
  accessPointId: string;

  @Column({ name: 'device_name', type: 'varchar', length: 120, default: 'Kiosko' })
  deviceName: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
