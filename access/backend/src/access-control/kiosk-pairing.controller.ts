import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { KioskPairingService } from './kiosk-pairing.service';

@ApiTags('Kiosk pairing')
@Controller('access')
export class KioskPairingController {
  constructor(private readonly pairing: KioskPairingService) {}

  /** Publico: la tablet canjea el codigo por un token de dispositivo. */
  @Post('kiosk/pair')
  @ApiOperation({ summary: 'Vincula tablet con codigo de 6 digitos (un uso, 10 min).' })
  pair(
    @Body() body: { code?: string; deviceName?: string },
    @Ip() ip: string,
    @Headers('x-forwarded-for') xff?: string,
  ) {
    const clientIp = (xff || '').split(',')[0]?.trim() || ip || 'unknown';
    return this.pairing.redeemCode(String(body?.code || ''), {
      deviceName: body?.deviceName,
      ip: clientIp,
    });
  }

  @Post('kiosk/pairing-codes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Genera codigo de vinculacion (panel).' })
  createCode(
    @CurrentUser() user: User,
    @Body() body: { gymId?: string; accessPointId?: string; deviceName?: string },
  ) {
    return this.pairing.createPairingCode({
      gymId: String(body?.gymId || ''),
      accessPointId: String(body?.accessPointId || ''),
      deviceName: body?.deviceName,
      createdBy: user.id,
    });
  }

  @Get('kiosk/devices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista tablets vinculadas (por sede).' })
  list(@Query('gymId') gymId?: string, @Query('includeRevoked') includeRevoked?: string) {
    const gym = String(gymId || '').trim();
    if (!gym) return this.pairing.listDevices();
    if (includeRevoked === '1' || includeRevoked === 'true') {
      return this.pairing.listDevicesIncludingRevoked(gym);
    }
    return this.pairing.listDevices(gym);
  }

  @Delete('kiosk/devices/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoca una tablet (el token deja de valer).' })
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('gymId') gymId?: string,
  ) {
    return this.pairing.revokeDevice(id, gymId ? String(gymId) : undefined);
  }

  @Post('kiosk/devices/:id/heartbeat')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualiza lastSeen de la tablet.' })
  async heartbeat(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User & { kioskDeviceId?: string }) {
    if (user.kioskDeviceId && user.kioskDeviceId !== id) {
      return { ok: false };
    }
    await this.pairing.touchLastSeen(id);
    return { ok: true };
  }
}
