import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { BOOSTS, BoostType } from '../../config/game.config';

/**
 * Все поля необязательные: админка шлёт только то, что реально поменяли.
 * Границы стоят не ради безопасности (авторизации тут нет вообще),
 * а чтобы случайная опечатка не сломала игровую логику — например,
 * уровень буста выше максимального сломал бы расчёт цены.
 */
export class AdminPatchDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  balance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  totalEarned?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  taps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  energy?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BOOSTS[BoostType.MULTITAP].maxLevel)
  multitapLevel?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BOOSTS[BoostType.ENERGY_LIMIT].maxLevel)
  energyLimitLevel?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BOOSTS[BoostType.RECHARGE].maxLevel)
  rechargeLevel?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fullEnergyUsed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  turboUsed?: number;
}
