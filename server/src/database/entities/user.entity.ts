import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** pg отдаёт bigint строкой — приводим к number (значения далеко ниже 2^53) */
const bigintTransformer = {
  to: (value: number) => Math.round(value ?? 0),
  from: (value: string | null) => (value === null ? 0 : Number(value)),
};

@Entity('users')
@Index('idx_users_balance', ['balance'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Логин в нижнем регистре — уникальный ключ входа */
  @Index('idx_users_username', { unique: true })
  @Column({ type: 'varchar', length: 32 })
  username: string;

  /** Имя как ввёл пользователь — только для отображения */
  @Column({ type: 'varchar', length: 32 })
  displayName: string;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  // ── Экономика ────────────────────────────────────────────────
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  balance: number;

  /** Заработано за всё время — по нему считается лига */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  totalEarned: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  taps: number;

  // ── Энергия (ленивый пересчёт от energyUpdatedAt) ────────────
  @Column({ type: 'double precision', default: 1000 })
  energy: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  energyUpdatedAt: Date;

  // ── Уровни бустов ────────────────────────────────────────────
  @Column({ type: 'int', default: 1 })
  multitapLevel: number;

  @Column({ type: 'int', default: 1 })
  energyLimitLevel: number;

  @Column({ type: 'int', default: 1 })
  rechargeLevel: number;

  // ── Дневные бустеры ──────────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  fullEnergyUsed: number;

  @Column({ type: 'int', default: 0 })
  turboUsed: number;

  /** Дата (UTC, YYYY-MM-DD) последнего сброса дневных лимитов */
  @Column({ type: 'varchar', length: 10, default: '1970-01-01' })
  dailyResetDate: string;

  @Column({ type: 'timestamptz', nullable: true })
  turboUntil: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
