import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './common/mail/mail.module';
import { RealtimeModule } from './common/realtime/realtime.module';
import { SecurityModule } from './common/security/security.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { DrawingModule } from './modules/drawing/drawing.module';
import { EditorModule } from './modules/editor/editor.module';
import { EstimatesModule } from './modules/estimates/estimates.module';
import { ExportsModule } from './modules/exports/exports.module';
import { HealthModule } from './modules/health/health.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
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
    MailModule,
    RealtimeModule,
    SecurityModule,
    ActivityLogModule,
    AdminModule,
    AuthModule,
    EditorModule,
    EstimatesModule,
    ExportsModule,
    DrawingModule,
    HealthModule,
    InvitationsModule,
    MaterialsModule,
    NotificationsModule,
    OrganizationsModule,
    ProjectsModule,
    UsersModule,
  ],
})
export class AppModule {}
