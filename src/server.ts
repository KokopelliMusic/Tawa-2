import { Application, config } from "./deps.ts";
import router from "./routes.ts";

const env = config()
const PORT = env.PORT || 3000;
const HOST = env.HOST || 'localhost';

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

console.log(`Server running on port ${PORT}`);

app.listen(`${HOST}:${PORT}`);
