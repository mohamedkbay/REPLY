import { build } from 'esbuild';
await build({entryPoints:['src/saas-entry.ts'],outfile:'dist/saas.mjs',bundle:true,format:'esm',platform:'node',target:'node24',logLevel:'info'});
