import { createClient } from "tinacms/dist/client";
import { queries } from "./types";
export const client = createClient({ cacheDir: '/home/aqua/Projects/genfix/tina/__generated__/.cache/1773205669992', url: 'http://localhost:4001/graphql', token: 'null', queries,  });
export default client;
  