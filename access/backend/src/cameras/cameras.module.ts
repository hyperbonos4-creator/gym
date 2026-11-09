import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CamerasController } from './cameras.controller';
import { CamerasService } from './cameras.service';
import { Camera } from './entities/camera.entity';
import { AccessPoint } from '../access-control/entities/access-point.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Camera, AccessPoint])],
  controllers: [CamerasController],
  providers: [CamerasService],
  exports: [TypeOrmModule],
})
export class CamerasModule {}
