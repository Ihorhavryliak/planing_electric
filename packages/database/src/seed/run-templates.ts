import { main } from './templates';

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
