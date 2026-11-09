import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

import { envValidationSchema } from './config/env.validation';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CamerasModule } from './cameras/cameras.module';
import { AccessControlModule } from './access-control/access-control.module';
import { TenantModule } from './common/tenant/tenant.module';
import { AssistantModule } from './assistant/assistant.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    EventEmitterModule.forRoot(),
    // UI del kiosko + consola admin (estáticos), servidos en /kiosk.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/kiosk',
      serveStaticOptions: {
        setHeaders(res, filePath) {
          if (/\.(wasm|task|mjs)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        // CLI uses data-source.ts; keep the same table name here for ops clarity.
        migrations: [join(__dirname, 'database', 'migrations', '*.{js,ts}')],
        migrationsTableName: 'typeorm_migrations',
        migrationsRun: false,
        synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
      }),
    }),
    AuthModule,
    CamerasModule,
    AccessControlModule,
    TenantModule,
    AssistantModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
