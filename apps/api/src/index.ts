import { app, boot } from './app';

const port = Number(process.env.API_PORT ?? 3001);
boot().then(() => app.listen(port, () => console.log(`dcs-api P1 on :${port}`)));
