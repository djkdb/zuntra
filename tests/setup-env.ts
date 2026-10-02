import { config } from "dotenv";

// Tests always run against the dedicated test database, never the dev one.
config({ path: ".env.test", override: true, quiet: true });
