import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { maxEnergyFor } from '../config/game.config';
import { PlayerRuntime, utcDate } from '../game/player-state';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username: username.toLowerCase() } });
  }

  /** С паролем — только для проверки логина (колонка помечена select: false) */
  findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.repo.findOne({
      where: { username: username.toLowerCase() },
      select: ['id', 'username', 'displayName', 'passwordHash'],
    });
  }

  async create(displayName: string, passwordHash: string): Promise<User> {
    const user = this.repo.create({
      username: displayName.toLowerCase(),
      displayName,
      passwordHash,
      energy: maxEnergyFor(1),
      energyUpdatedAt: new Date(),
      dailyResetDate: utcDate(Date.now()),
    });
    return this.repo.save(user);
  }

  /**
   * Пакетная запись изменённых игроков.
   * Один UPDATE на игрока, но всё в одной транзакции — дёшево и предсказуемо.
   */
  async flushPlayers(players: PlayerRuntime[]): Promise<void> {
    if (players.length === 0) return;

    await this.repo.manager.transaction(async (manager) => {
      for (const p of players) {
        await manager.update(
          User,
          { id: p.id },
          {
            balance: p.balance,
            totalEarned: p.totalEarned,
            taps: p.taps,
            energy: p.energy,
            energyUpdatedAt: new Date(p.energyUpdatedAt),
            multitapLevel: p.multitapLevel,
            energyLimitLevel: p.energyLimitLevel,
            rechargeLevel: p.rechargeLevel,
            fullEnergyUsed: p.fullEnergyUsed,
            turboUsed: p.turboUsed,
            dailyResetDate: p.dailyResetDate,
            turboUntil: p.turboUntil ? new Date(p.turboUntil) : null,
          },
        );
      }
    });
  }

  /** Топ игроков по балансу */
  async leaderboard(limit: number): Promise<
    Array<{ id: string; displayName: string; balance: number; totalEarned: number }>
  > {
    const rows = await this.repo.find({
      select: ['id', 'displayName', 'balance', 'totalEarned'],
      order: { balance: 'DESC' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      balance: r.balance,
      totalEarned: r.totalEarned,
    }));
  }

  /** Позиция игрока в общем рейтинге (1-based) */
  async rankOf(userId: string): Promise<number> {
    const raw = await this.repo
      .createQueryBuilder('u')
      .select('COUNT(*)', 'cnt')
      .where('u.balance > (SELECT balance FROM users WHERE id = :id)', { id: userId })
      .getRawOne<{ cnt: string }>();
    return Number(raw?.cnt ?? 0) + 1;
  }

  count(): Promise<number> {
    return this.repo.count();
  }

  // ── Для тестовой админки ────────────────────────────────────────

  /** Список игроков с поиском по логину */
  async searchForAdmin(query: string | undefined, limit: number) {
    const qb = this.repo
      .createQueryBuilder('u')
      .select([
        'u.id',
        'u.username',
        'u.displayName',
        'u.balance',
        'u.totalEarned',
        'u.createdAt',
      ])
      .orderBy('u.balance', 'DESC')
      .limit(limit);

    if (query) qb.where('u.username LIKE :q', { q: `%${query.toLowerCase()}%` });

    return qb.getMany();
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.repo.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
