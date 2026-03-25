import { createClient } from "tinacms/dist/client";
import { queries } from "./types";
export const client = createClient({ cacheDir: '/home/aqua/Projects/dryapi/tina/__generated__/.cache/1774411132145', url: '/admin/api/tina/gql', token: 'null', queries,  });
export default client;
  