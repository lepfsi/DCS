import { seedAll } from './seed';
seedAll().then(() => { console.log('seed ok'); process.exit(0); });
