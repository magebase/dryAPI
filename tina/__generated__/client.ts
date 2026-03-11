import { createClient } from "tinacms/dist/client";
import { queries } from "./types";
export const client = createClient({ cacheDir: '/home/aqua/Projects/genfix/tina/__generated__/.cache/1773261762974', url: '/api/tina/gql', token: 'null', queries,  });
export default client;
  