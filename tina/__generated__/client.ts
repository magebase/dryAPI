import { createClient } from "tinacms/dist/client";
import { queries } from "./types";
export const client = createClient({ cacheDir: '/home/aqua/Projects/genfix/tina/__generated__/.cache/1773386774256', url: '/api/tina/gql', token: 'null', queries,  });
export default client;
  