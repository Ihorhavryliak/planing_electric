import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MaterialsController } from './materials.controller';
import { MaterialsRepository } from './materials.repository';
import { MaterialsService } from './materials.service';

@Module({
  imports: [AuthModule],
  providers: [MaterialsRepository, MaterialsService],
  controllers: [MaterialsController],
  exports: [MaterialsService, MaterialsRepository],
})
export class MaterialsModule {}
