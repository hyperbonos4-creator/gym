import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsOptional, IsString } from 'class-validator';

import { EnrollScopeGuard } from '../auth/guards/enroll-scope.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

import { CamerasService } from './cameras.service';
import { CreateCameraDto, UpdateCameraDto } from './dto/camera.dto';
import { AccessPoint } from '../access-control/entities/access-point.entity';

class ProbeCameraDto {
  @IsString()
  url: string;
}

class ScanCameraDto {
  /** Subred a escanear, ej: "192.168.100". Si se omite se detecta automáticamente. */
  @IsOptional()
  @IsString()
  subnet?: string;
}

class LinkPointDto {
  @IsString()
  accessPointId: string;

  @IsOptional()
  @IsString()
  externalKey?: string;
}

@ApiTags('Cameras')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, EnrollScopeGuard)
@Controller('cameras')
export class CamerasController {
  constructor(
    private readonly cameras: CamerasService,
    @InjectRepository(AccessPoint)
    private readonly accessPoints: Repository<AccessPoint>,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Registra una cámara IP (no expone el rtspUrl).' })
  create(@Body() dto: CreateCameraDto) {
    return this.cameras.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Lista las cámaras (sin credenciales).' })
  list() {
    return this.cameras.list();
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Edita una cámara.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCameraDto) {
    return this.cameras.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Elimina una cámara.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.cameras.remove(id);
    return { ok: true };
  }

  /** Prueba una URL antes de guardarla. Devuelve { ok, method, thumbnailB64, detail }. */
  @Post('probe')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Prueba conectividad de una URL de cámara y devuelve thumbnail.' })
  probe(@Body() dto: ProbeCameraDto) {
    return this.cameras.probe(dto.url);
  }

  /**
   * Escanea la red local buscando cámaras IP.
   * Delega al facial_webhook.py corriendo en el host (tiene acceso a la LAN real).
   * El backend Docker NO puede alcanzar la LAN directamente.
   */
  @Post('scan')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Descubre cámaras IP en la red — proxy al host via facial_webhook.' })
  async scan(@Body() dto: ScanCameraDto): Promise<unknown> {
    const webhookUrl = (process.env.FACIAL_WEBHOOK_URL ?? 'http://host.docker.internal:8787').replace(/\/$/, '');
    const subnet = dto.subnet ?? '192.168.100';
    const url = `${webhookUrl}/scan?subnet=${encodeURIComponent(subnet)}`;

    return new Promise((resolve) => {
      const lib: typeof import('http') = require('http');
      const req = lib.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
          catch { resolve({ error: 'invalid_json', subnet, scanned: 0, found: [], durationMs: 0 }); }
        });
      });
      req.setTimeout(85_000, () => {
        req.destroy();
        resolve({ error: 'timeout', subnet, scanned: 0, found: [], durationMs: 0 });
      });
      req.on('error', (err: Error) => {
        resolve({
          error: `facial_webhook no está corriendo. Ejecuta: python facial_webhook.py (${err.message})`,
          webhookUrl,
          subnet, scanned: 0, found: [], durationMs: 0,
        });
      });
    });
  }

  /** Vincula una cámara registrada a un punto de acceso (kiosko). */
  @Post(':id/link-point')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Vincula la cámara a un punto de acceso (kiosko).' })
  async linkPoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkPointDto,
  ) {
    const cam = await this.cameras.update(id, {
      ...(dto.externalKey !== undefined ? { externalKey: dto.externalKey } : {}),
    });
    await this.accessPoints.update({ id: dto.accessPointId }, { cameraId: id });
    const ap = await this.accessPoints.findOne({ where: { id: dto.accessPointId } });
    return { ok: true, camera: cam, accessPointId: ap?.id ?? dto.accessPointId };
  }
}
