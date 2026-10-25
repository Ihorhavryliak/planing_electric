import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { AuthModule } from './modules/auth/auth.module';
import { DrawingModule } from './modules/drawing/drawing.module';
import { EditorModule } from './modules/editor/editor.module';
import { EstimatesModule } from './modules/estimates/estimates.module';
import { HealthModule } from './modules/health/health.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['.env', '../../.env'],
    }),
    DatabaseModule,
    ActivityLogModule,
    AuthModule,
    EditorModule,
    EstimatesModule,
    DrawingModule,
    HealthModule,
    InvitationsModule,
    MaterialsModule,
    OrganizationsModule,
    ProjectsModule,
    UsersModule,
  ],
})
export class AppModule {}
