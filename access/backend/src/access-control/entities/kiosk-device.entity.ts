import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Tablet/kiosko vinculado a una sede (gymId de gym-web) y a un access_point.
 * El JWT de dispositivo lleva purpose=kiosk + deviceId + jti; si revokedAt
 * no es null, el token deja de valer de inmediato.
 */
@Entity('kiosk_devices')
export class KioskDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** ID de sede en gym-web (no es FK de access). */
  @Index('idx_kiosk_devices_gym')
  @Column({ name: 'gym_id', type: 'varchar', length: 64 })
  gymId: string;

  @Index('idx_kiosk_devices_point')
  @Column({ name: 'access_point_id', type: 'uuid' })
  accessPointId: string;

  /** jti del JWT vigente (hex). Unico mientras no este revocado. */
  @Index('idx_kiosk_devices_jti', { unique: true })
  @Column({ name: 'token_jti', type: 'varchar', length: 64 })
  tokenJti: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
