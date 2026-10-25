import { Global, Module } from '@nestjs/common';
import { SignedLinksService } from './signed-links.service';

@Global()
@Module({
  providers: [SignedLinksService],
  exports: [SignedLinksService],
})
export class SecurityModule {}